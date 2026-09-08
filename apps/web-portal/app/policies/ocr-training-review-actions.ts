"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator, requirePolicyOcrTrainingViewer } from "@/lib/policy-ocr-training-access";
import {
  createSanitizedTrainingCandidate,
  type TrainingDatabaseReference,
  type TrainingProposal,
  parseReviewerDate,
  sanitizeEvidenceNote,
} from "@/lib/policy-ocr-training";
import { loadPolicyOcrTrainingReference } from "@/lib/policy-ocr-training-reference";
import { sendResendEmail } from "@/lib/resend-email";

const QUEUE_PATH = "/policies/ocr-training";
const REVIEW_NOTIFICATION_BCC = "it@insureit.in";
const REVIEW_CHECKLIST = [
  "insurer",
  "package_product",
  "current_policy_number",
  "dates",
  "idv",
  "od_4814",
  "portal_tp_net_b_7367",
  "cpa_opted_no",
  "cpa_zero",
  "registration_status",
  "class_misd",
  "chassis_engine",
] as const;

type ReviewTask = {
  id: string;
  training_label_id: string;
  assigned_reviewer_profile_id: string;
  assignment_version: number;
  status: "assigned" | "in_review" | "completed" | "rejected" | "cancelled";
  field_questions?: Array<{ key: string; issue: string; prompt: string; allowedAnswers: string[] }>;
};

function formText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedEmail(value: string) {
  const email = value.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

export type AssignPolicyOcrReviewState = { status: "idle" | "success" | "error"; message: string | null };

export async function assignPolicyOcrReviewTask(
  _previousState: AssignPolicyOcrReviewState,
  formData: FormData,
): Promise<AssignPolicyOcrReviewState> {
  try {
    const operator = await requirePolicyOcrTrainingOperator();
    const labelId = formText(formData, "training_label_id");
    const email = normalizedEmail(formText(formData, "reviewer_email") ?? "");
    if (!labelId) throw new Error("Training label reference is missing.");
    if (!email) throw new Error("Enter a valid existing portal-user email.");

    const admin = createSupabaseAdminClient();
    const { data: label, error: labelError } = await admin
      .from("policy_ocr_training_labels")
      .select("id,policy_document_id")
      .eq("id", labelId)
      .maybeSingle<{ id: string; policy_document_id: string }>();
    if (labelError || !label) throw new Error("The OCR training item could not be loaded.");

    const reviewer = await resolveExistingPortalReviewer(admin, email);
    const { data: document, error: documentError } = await admin
      .from("policy_documents")
      .select("id,file_name,policy_id")
      .eq("id", label.policy_document_id)
      .eq("document_type", "policy_copy")
      .maybeSingle<{ id: string; file_name: string | null; policy_id: string | null }>();
    if (documentError || !document) throw new Error("The private policy copy could not be loaded.");

    const { data: policy } = document.policy_id
      ? await admin.from("policies").select("policy_type,insurance_companies(name)").eq("id", document.policy_id).maybeSingle<{ policy_type: string | null; insurance_companies: { name: string } | null }>()
      : { data: null };
    if (!policy || !/iffco/i.test(policy.insurance_companies?.name ?? "") || !/^package$/i.test(policy.policy_type ?? "")) {
      throw new Error("This reviewer workflow is currently available only for IFFCO-Tokio Package policies.");
    }

    const { data: existing, error: existingError } = await admin
      .from("policy_ocr_training_review_tasks")
      .select("id,training_label_id,assigned_reviewer_profile_id,assignment_version,status")
      .eq("training_label_id", labelId)
      .maybeSingle<ReviewTask>();
    if (existingError) throw new Error("The reviewer task could not be loaded.");

    let task: ReviewTask;
    let assignmentChanged = false;
    if (existing && existing.assigned_reviewer_profile_id === reviewer.profileId && existing.status !== "cancelled") {
      task = existing;
    } else if (existing) {
      const { data: updated, error: updateError } = await admin
        .from("policy_ocr_training_review_tasks")
        .update({
          assigned_reviewer_profile_id: reviewer.profileId,
          assigned_by_profile_id: operator.id,
          assignment_version: existing.assignment_version + 1,
          status: "assigned",
          checklist: {},
          reviewer_note: null,
          assigned_at: new Date().toISOString(),
          started_at: null,
          completed_at: null,
        })
        .eq("id", existing.id)
        .eq("assignment_version", existing.assignment_version)
        .select("id,training_label_id,assigned_reviewer_profile_id,assignment_version,status")
        .single<ReviewTask>();
      if (updateError || !updated) throw new Error("The reviewer task could not be assigned.");
      task = updated;
      assignmentChanged = true;
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("policy_ocr_training_review_tasks")
        .insert({
          training_label_id: labelId,
          assigned_reviewer_profile_id: reviewer.profileId,
          assigned_by_profile_id: operator.id,
        })
        .select("id,training_label_id,assigned_reviewer_profile_id,assignment_version,status")
        .single<ReviewTask>();
      if (insertError || !inserted) throw new Error("The reviewer task could not be assigned.");
      task = inserted;
      assignmentChanged = true;
    }

    const idempotencyKey = `policy-ocr-review:${task.id}:${task.assignment_version}`;
    const { data: existingNotification, error: notificationLookupError } = await admin
      .from("policy_ocr_training_review_notifications")
      .select("id,status,idempotency_key,attempts")
      .eq("review_task_id", task.id)
      .eq("assignment_version", task.assignment_version)
      .maybeSingle<{ id: string; status: "pending" | "sent" | "failed"; idempotency_key: string; attempts: number }>();
    if (notificationLookupError) throw new Error("The reviewer notification audit could not be loaded.");
    if (existingNotification?.status === "sent" && !assignmentChanged) {
      return { status: "success", message: "This reviewer is already assigned and notified." };
    }

    const { data: notification, error: notificationError } = await admin
      .from("policy_ocr_training_review_notifications")
      .upsert({
        review_task_id: task.id,
        assignment_version: task.assignment_version,
        recipient_profile_id: reviewer.profileId,
        idempotency_key: existingNotification?.idempotency_key ?? idempotencyKey,
        status: "pending",
        last_error: null,
      }, { onConflict: "review_task_id,assignment_version" })
      .select("id,idempotency_key,attempts")
      .single<{ id: string; idempotency_key: string; attempts: number }>();
    if (notificationError || !notification) throw new Error("The reviewer notification audit could not be created.");

    const subject = "INSUREIT Policy OCR review task";
    const portalUrl = buildPortalReviewUrl(task.id);
    const text = buildReviewerEmail({
      fileName: document.file_name,
      insurer: policy?.insurance_companies?.name ?? null,
      product: policy?.policy_type ?? null,
      taskId: task.id,
      portalUrl,
    });

    try {
      const result = await sendResendEmail({
        to: email,
        bcc: [REVIEW_NOTIFICATION_BCC],
        subject,
        text,
        idempotencyKey: notification.idempotency_key,
      });
      await admin
        .from("policy_ocr_training_review_notifications")
        .update({
          status: "sent",
          attempts: notification.attempts + 1,
          provider_message_id: result.id,
          last_error: null,
          sent_at: new Date().toISOString(),
        })
        .eq("id", notification.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "notification_failed";
      const auditError = message === "resend_configuration_missing" ? message : "resend_request_failed";
      await admin
        .from("policy_ocr_training_review_notifications")
        .update({
          status: "failed",
          attempts: notification.attempts + 1,
          last_error: auditError,
        })
        .eq("id", notification.id);
      throw new Error(message === "resend_configuration_missing"
        ? "Reviewer assigned, but Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL; no notification was marked sent."
        : "Reviewer assigned, but the notification could not be sent. Retry after checking Resend.");
    }

    revalidatePath(QUEUE_PATH);
    return { status: "success", message: `Assigned to ${email} and sent a secure portal notification.` };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The reviewer task could not be assigned." };
  }
}

export type ReviewerChecklistState = { status: "idle" | "success" | "error"; message: string | null };

export async function startPolicyOcrReviewTask(
  _previousState: ReviewerChecklistState,
  formData: FormData,
): Promise<ReviewerChecklistState> {
  try {
    const viewer = await requirePolicyOcrTrainingViewer();
    if (viewer.isOperator) throw new Error("Assigned reviewer action is not available to the training operator.");
    const task = await loadAssignedTask(formText(formData, "review_task_id"), viewer.profile.id);
    if (["completed", "rejected", "cancelled"].includes(task.status)) throw new Error("This reviewer task is no longer open.");
    const admin = createSupabaseAdminClient();
    const { data: updated, error } = await admin
      .from("policy_ocr_training_review_tasks")
      .update({ status: task.status === "assigned" ? "in_review" : task.status, started_at: task.status === "assigned" ? new Date().toISOString() : undefined })
      .eq("id", task.id)
      .eq("assigned_reviewer_profile_id", viewer.profile.id)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error || !updated) throw new Error("The reviewer task could not be started.");
    revalidatePath(QUEUE_PATH);
    return { status: "success", message: null };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The reviewer task could not be started." };
  }
}

export async function completePolicyOcrReviewTask(
  _previousState: ReviewerChecklistState,
  formData: FormData,
): Promise<ReviewerChecklistState> {
  try {
    const viewer = await requirePolicyOcrTrainingViewer();
    if (viewer.isOperator) throw new Error("Assigned reviewer action is not available to the training operator.");
    const task = await loadAssignedTask(formText(formData, "review_task_id"), viewer.profile.id);
    if (["completed", "rejected", "cancelled"].includes(task.status)) throw new Error("This reviewer task is no longer open.");
    const checklist = Object.fromEntries(REVIEW_CHECKLIST.map((key) => [key, formData.get(`check_${key}`) === "on"]));
    if (!task.field_questions?.length && REVIEW_CHECKLIST.some((key) => !checklist[key])) {
      throw new Error("Complete every review answer after verifying the private policy copy.");
    }
    const structuredAnswers = Object.fromEntries((task.field_questions ?? []).map((question) => {
      const answer = formText(formData, `answer_${question.key}`);
      if (!answer || !question.allowedAnswers.includes(answer)) throw new Error(`Choose an answer for ${question.key}.`);
      const correctValue = answer === "provide_correct_value"
        ? sanitizeTrainingFeedbackValue(formText(formData, `correct_value_${question.key}`))
        : null;
      if (answer === "provide_correct_value" && !correctValue) throw new Error(`Enter a sanitized value for ${question.key}, or choose withhold.`);
      return [question.key, { answer, correctValue }];
    }));
    if (task.field_questions?.length && Object.keys(structuredAnswers).length !== task.field_questions.length) {
      throw new Error("Complete every field-level OCR question.");
    }
    const note = sanitizeReviewerNote(formText(formData, "reviewer_note"));
    const { data: updated, error } = await createSupabaseAdminClient()
      .from("policy_ocr_training_review_tasks")
      .update({ status: "completed", checklist, reviewer_note: note, structured_feedback: Object.keys(structuredAnswers).length ? structuredAnswers : null, started_at: task.status === "assigned" ? new Date().toISOString() : undefined, completed_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("assigned_reviewer_profile_id", viewer.profile.id)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error || !updated) throw new Error("The reviewer answers could not be saved.");
    if (Object.keys(structuredAnswers).length) {
      const feedback = Object.fromEntries(Object.entries(structuredAnswers).map(([key, value]) => [key, value.correctValue ? { answer: value.answer, value: value.correctValue } : { answer: value.answer }]));
      await createSupabaseAdminClient().from("policy_ocr_training_feedback").upsert({
        review_task_id: task.id,
        reviewer_profile_id: viewer.profile.id,
        answers: structuredAnswers,
        sanitized_evidence: feedback,
      }, { onConflict: "review_task_id" });
    }
    await startPolicyOcrTrainingFromReview(task.id, viewer.profile.id);
    revalidatePath(QUEUE_PATH);
    return { status: "success", message: "Review answers saved and parser training started." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The reviewer answers could not be saved." };
  }
}

type StructuredFeedback = Record<string, { answer: string; correctValue: string | null }>;

const PROPOSAL_KEYS: Partial<Record<keyof TrainingDatabaseReference, keyof TrainingProposal["fields"]>> = {
  vehicle_registration_status: "vehicle_registration_status",
  vehicle_registration_number: "vehicle_registration_number",
  vehicle_class: "vehicle_class",
  vehicle_make: "vehicle_make",
  vehicle_model: "vehicle_model",
  vehicle_fuel_type: "vehicle_fuel_type",
  vehicle_manufacturing_year: "vehicle_manufacturing_year",
  vehicle_capacity: "vehicle_capacity",
  vehicle_chassis_number: "vehicle_chassis_number",
  vehicle_engine_number: "vehicle_engine_number",
  vehicle_rto_name: "vehicle_rto_name",
  vehicle_rto_state: "vehicle_rto_state",
  insurer_name: "insurer_name",
  policy_product: "policy_product",
  policy_number: "policy_number",
  valid_from: "policy_start_date",
  valid_upto: "policy_end_date",
  idv: "idv",
  od_premium: "od_premium",
  tp_premium: "tp_premium",
  cpa_opted: "cpa_opted",
  cpa_premium: "cpa_premium",
};

const NUMERIC_REFERENCE_KEYS = new Set<keyof TrainingDatabaseReference>([
  "idv",
  "od_premium",
  "tp_premium",
  "cpa_premium",
  "printed_net_premium",
  "printed_gst",
  "printed_gross_premium",
]);

function coerceTrainingFeedbackValue(key: keyof TrainingDatabaseReference, value: string | null) {
  if (value === null || value.trim() === "") return null;
  if (NUMERIC_REFERENCE_KEYS.has(key)) {
    const parsed = Number(value.replaceAll(",", "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (key === "vehicle_manufacturing_year") {
    const parsed = Number(value.replace(/[^\d]/g, ""));
    return Number.isInteger(parsed) ? parsed : null;
  }
  if (key === "cpa_opted") {
    if (/^(yes|true|1)$/i.test(value)) return true;
    if (/^(no|false|0)$/i.test(value)) return false;
    return null;
  }
  if (key === "valid_from" || key === "valid_upto") return parseReviewerDate(value) ?? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
  return value.trim();
}

function resolveTrainingReference(
  reference: TrainingDatabaseReference,
  proposal: TrainingProposal | null,
  feedback: StructuredFeedback,
): TrainingDatabaseReference {
  const resolved = { ...reference };
  for (const [rawKey, answer] of Object.entries(feedback)) {
    const key = rawKey as keyof TrainingDatabaseReference;
    if (!(key in resolved)) continue;
    if (answer.answer === "withhold") {
      resolved[key] = null;
      continue;
    }
    if (answer.answer === "database_correct") continue;
    const proposalKey = PROPOSAL_KEYS[key];
    const proposalValue = proposalKey ? proposal?.fields[proposalKey]?.value ?? null : null;
    const value = answer.answer === "provide_correct_value" ? answer.correctValue : proposalValue;
    resolved[key] = coerceTrainingFeedbackValue(key, value) as never;
  }
  return resolved;
}

function assertFinancialReconciliation(values: TrainingDatabaseReference) {
  if (values.od_premium === null || values.tp_premium === null || values.cpa_premium === null || values.printed_net_premium === null) return;
  if (Math.abs(values.od_premium + values.tp_premium + values.cpa_premium - values.printed_net_premium) > 2) {
    throw new Error("The confirmed OD, TP and CPA values do not reconcile to printed net premium.");
  }
}

async function startPolicyOcrTrainingFromReview(taskId: string, reviewerProfileId: string) {
  const admin = createSupabaseAdminClient();
  const { data: task, error: taskError } = await admin
    .from("policy_ocr_training_review_tasks")
    .select("id,training_label_id,structured_feedback")
    .eq("id", taskId)
    .eq("status", "completed")
    .maybeSingle<{ id: string; training_label_id: string; structured_feedback: StructuredFeedback | null }>();
  if (taskError || !task?.training_label_id || !task.structured_feedback) throw new Error("The parser training input could not be loaded.");

  const { data: label, error: labelError } = await admin
    .from("policy_ocr_training_labels")
    .select("id,policy_document_id,processing_status,status,parser_id,parser_version,proposal")
    .eq("id", task.training_label_id)
    .maybeSingle<{ id: string; policy_document_id: string; processing_status: string; status: string; parser_id: string | null; parser_version: string | null; proposal: TrainingProposal | null }>();
  if (labelError || !label) throw new Error("The OCR training record could not be loaded.");
  if (label.status === "approved") return;
  if (label.processing_status !== "ready") throw new Error("The OCR proposal is not ready for parser training.");

  const { data: document, error: documentError } = await admin
    .from("policy_documents")
    .select("policy_id")
    .eq("id", label.policy_document_id)
    .eq("document_type", "policy_copy")
    .maybeSingle<{ policy_id: string | null }>();
  if (documentError || !document?.policy_id) throw new Error("The policy reference could not be loaded for parser training.");

  const reference = await loadPolicyOcrTrainingReference(document.policy_id);
  if (!reference) throw new Error("The saved policy reference could not be loaded for parser training.");
  const resolved = resolveTrainingReference(reference, label.proposal, task.structured_feedback);
  assertFinancialReconciliation(resolved);
  const candidate = createSanitizedTrainingCandidate({
    labelId: label.id,
    parserId: label.parser_id,
    parserVersion: label.parser_version,
    values: resolved,
    proposal: label.proposal,
  });
  const { error: approvalError } = await admin.rpc("approve_policy_ocr_database_comparison", {
    p_label_id: label.id,
    p_actor_id: reviewerProfileId,
    p_reference: resolved,
    p_candidate_payload: candidate,
  });
  if (approvalError) throw new Error("Parser training could not be started from the saved review answers.");
}

async function loadAssignedTask(taskId: string | null, profileId: string): Promise<ReviewTask> {
  if (!taskId) throw new Error("Reviewer task reference is missing.");
  const { data, error } = await createSupabaseAdminClient()
    .from("policy_ocr_training_review_tasks")
    .select("id,training_label_id,assigned_reviewer_profile_id,assignment_version,status,field_questions")
    .eq("id", taskId)
    .eq("assigned_reviewer_profile_id", profileId)
    .maybeSingle<ReviewTask>();
  if (error || !data) throw new Error("This reviewer task is not assigned to your portal user.");
  return data;
}

function sanitizeTrainingFeedbackValue(value: string | null) {
  if (!value) return null;
  const sanitized = value
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, "[redacted]")
    .replace(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, "[redacted]")
    .replace(/\b[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}\b/gi, "[redacted]")
    .replace(/\b[A-Z0-9]{16,}\b/gi, "[redacted]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return sanitized || null;
}

async function resolveExistingPortalReviewer(admin: ReturnType<typeof createSupabaseAdminClient>, email: string) {
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUser = users?.users.find((user) => user.email?.trim().toLowerCase() === email) ?? null;
  if (usersError || !authUser) throw new Error("No existing portal user was found for that email.");
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,full_name,is_active,role,employee_id")
    .eq("id", authUser.id)
    .maybeSingle<{ id: string; full_name: string; is_active: boolean; role: string; employee_id: string | null }>();
  if (profileError || !profile?.is_active || ["customer", "intermediary"].includes(profile.role)) {
    throw new Error("The email does not belong to an active internal portal user.");
  }
  if (profile.employee_id) {
    const { data: employee } = await admin
      .from("employees")
      .select("id,email,employment_status")
      .eq("id", profile.employee_id)
      .maybeSingle<{ id: string; email: string | null; employment_status: string }>();
    if (!employee || employee.employment_status !== "active" || employee.email?.trim().toLowerCase() !== email) {
      throw new Error("The portal user is not linked to an active employee with that email.");
    }
  }
  return { profileId: profile.id, fullName: profile.full_name };
}

function buildPortalReviewUrl(taskId: string) {
  const base = process.env.NEXT_PUBLIC_PORTAL_URL?.trim()
    || process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://portal.insureit.in");
  const url = new URL("/policies/ocr-training", base);
  url.searchParams.set("review_task", taskId);
  return url.toString();
}

function buildReviewerEmail(input: { fileName: string | null; insurer: string | null; product: string | null; taskId: string; portalUrl: string }) {
  const taskReference = input.taskId.replaceAll("-", "").slice(0, 12).toUpperCase();
  return [
    "Hello,",
    "",
    "A policy OCR review task is assigned to you in the INSUREIT portal.",
    `Task reference: ${taskReference}`,
    `Policy copy label: ${safeFileLabel(input.fileName)}`,
    `Insurer: ${safeEmailValue(input.insurer) || "Not linked"}`,
    `Product: ${safeEmailValue(input.product) || "Not linked"}`,
    "",
    "Verify from the uploaded policy copy:",
    "1. Insurer.",
    "2. Package product.",
    "3. Current policy number.",
    "4. Current policy dates.",
    "5. IDV.",
    "6. OD = 4814.",
    "7. Portal TP / Net B = 7367.",
    "8. CPA opted = No.",
    "9. CPA = 0.",
    "10. Section 02: registration status pending/unregistered.",
    "11. Section 02: class MISD if supported by this layout.",
    "12. Section 02: chassis and engine.",
    "",
    "Keep the policy PDF and all raw OCR inside the secure portal. Do not email policy content, identifiers, PII or attachments.",
    `Open the protected portal task: ${input.portalUrl}`,
  ].join("\n");
}

function safeFileLabel(value: string | null) {
  const base = (value ?? "Policy copy").split(/[\\/]/).pop() ?? "Policy copy";
  const safe = base
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, "redacted")
    .replace(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, "redacted")
    .replace(/\b[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}\b/gi, "redacted")
    .replace(/\b[A-Z0-9]{16,}\b/gi, "redacted")
    .replace(/[^A-Za-z0-9._ -]+/g, " ")
    .replace(/\b[A-Za-z0-9._-]*\d[A-Za-z0-9._-]*\b/g, "redacted")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return safe || "Policy copy";
}

function safeEmailValue(value: string | null) {
  const safe = (value ?? "")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, "redacted")
    .replace(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, "redacted")
    .replace(/\b[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}\b/gi, "redacted")
    .replace(/\b[A-Z0-9]{16,}\b/gi, "redacted")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return safe;
}

function sanitizeReviewerNote(value: string | null) {
  return sanitizeEvidenceNote(value)
    .replace(/\b(?:N|P)\d{6,}\b/gi, "[redacted]")
    .replace(/\b\d{6,}\b/g, "[redacted]")
    .slice(0, 500)
    .trim() || null;
}
