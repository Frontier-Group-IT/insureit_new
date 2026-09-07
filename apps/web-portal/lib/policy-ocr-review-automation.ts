import "server-only";

import {
  compareTrainingProposalToReference,
  type TrainingDatabaseReference,
  type TrainingProposal,
} from "@/lib/policy-ocr-training";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendResendEmail } from "@/lib/resend-email";

const DEFAULT_REVIEWER_EMAIL = "anju@insureit.in";
const REVIEW_NOTIFICATION_BCC = "it@insureit.in";

type ReviewTask = {
  id: string;
  assigned_reviewer_profile_id: string;
  assignment_version: number;
  status: "assigned" | "in_review" | "completed" | "rejected" | "cancelled";
};

/**
 * Creates the durable human-review handoff only when the comparison is not
 * complete. The worker never writes OCR text, document contents, or field
 * values into the task or notification.
 */
export async function ensureAutomaticPolicyOcrReview(input: {
  labelId: string;
  policyDocumentId: string;
  proposal: TrainingProposal;
  reference: TrainingDatabaseReference;
  orchestratorId?: string;
  sampleId?: string;
  iterationNo?: number;
}) {
  const comparison = compareTrainingProposalToReference(input.proposal, input.reference);
  const hasAmbiguity = input.proposal.warnings.length > 0;
  if (comparison.exactMatch && !hasAmbiguity) {
    return { needsReview: false as const, taskCreated: false, notificationSent: false };
  }

  const admin = createSupabaseAdminClient();
  const reviewerEmail = normalizeEmail(process.env.POLICY_OCR_DEFAULT_REVIEWER_EMAIL) ?? DEFAULT_REVIEWER_EMAIL;
  const reviewer = await resolveExistingPortalReviewer(admin, reviewerEmail);
  const { data: document, error: documentError } = await admin
    .from("policy_documents")
    .select("id,file_name,policy_id")
    .eq("id", input.policyDocumentId)
    .eq("document_type", "policy_copy")
    .maybeSingle<{ id: string; file_name: string | null; policy_id: string | null }>();
  if (documentError || !document) return { needsReview: true as const, taskCreated: false, notificationSent: false, error: "document_not_found" };

  const { data: policy } = document.policy_id
    ? await admin.from("policies").select("policy_type,insurance_companies(name)").eq("id", document.policy_id).maybeSingle<{ policy_type: string | null; insurance_companies: { name: string } | null }>()
    : { data: null };

  const fieldQuestions = buildFieldQuestions(comparison, input.proposal, input.reference);
  const { data: existing, error: existingError } = await admin
    .from("policy_ocr_training_review_tasks")
    .select("id,assigned_reviewer_profile_id,assignment_version,status")
    .eq("training_label_id", input.labelId)
    .maybeSingle<ReviewTask>();
  if (existingError) return { needsReview: true as const, taskCreated: false, notificationSent: false, error: "task_lookup_failed" };

  let task: ReviewTask | null = null;
  let assignmentChanged = false;
  if (existing && existing.assigned_reviewer_profile_id === reviewer.profileId && existing.status !== "cancelled") {
    task = existing;
  } else if (existing) {
    const { data: updated } = await admin
      .from("policy_ocr_training_review_tasks")
      .update({
        assigned_reviewer_profile_id: reviewer.profileId,
        assigned_by_profile_id: null,
        assignment_version: existing.assignment_version + 1,
        status: "assigned",
        checklist: {},
        reviewer_note: null,
        field_questions: fieldQuestions,
        orchestrator_id: input.orchestratorId ?? null,
        sample_id: input.sampleId ?? null,
        assigned_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
      })
      .eq("id", existing.id)
      .eq("assignment_version", existing.assignment_version)
      .select("id,assigned_reviewer_profile_id,assignment_version,status")
      .maybeSingle<ReviewTask>();
    task = updated ?? null;
    assignmentChanged = Boolean(updated);
  } else {
    const { data: inserted } = await admin
      .from("policy_ocr_training_review_tasks")
      .insert({
        training_label_id: input.labelId,
        assigned_reviewer_profile_id: reviewer.profileId,
        assigned_by_profile_id: null,
        field_questions: fieldQuestions,
        orchestrator_id: input.orchestratorId ?? null,
        sample_id: input.sampleId ?? null,
      })
      .select("id,assigned_reviewer_profile_id,assignment_version,status")
      .maybeSingle<ReviewTask>();
    task = inserted ?? null;
    assignmentChanged = Boolean(inserted);
  }

  if (!task) {
    // A concurrent worker may have won the unique label race. Re-read and
    // reuse the assigned task rather than creating a second notification.
    const { data: concurrent } = await admin
      .from("policy_ocr_training_review_tasks")
      .select("id,assigned_reviewer_profile_id,assignment_version,status")
      .eq("training_label_id", input.labelId)
      .maybeSingle<ReviewTask>();
    task = concurrent ?? null;
  }
  if (!task) return { needsReview: true as const, taskCreated: false, notificationSent: false, error: "task_create_failed" };

  const idempotencyKey = `policy-ocr-review:${task.id}:${task.assignment_version}`;
  const { data: existingNotification } = await admin
    .from("policy_ocr_training_review_notifications")
    .select("id,idempotency_key,attempts,status")
    .eq("review_task_id", task.id)
    .eq("assignment_version", task.assignment_version)
    .maybeSingle<{ id: string; idempotency_key: string; attempts: number; status: "pending" | "sent" | "failed" }>();
  if (existingNotification?.status === "sent" && !assignmentChanged) {
    return { needsReview: true as const, taskCreated: false, notificationSent: false };
  }
  const { data: notification } = await admin
    .from("policy_ocr_training_review_notifications")
    .upsert({
      review_task_id: task.id,
      assignment_version: task.assignment_version,
      recipient_profile_id: reviewer.profileId,
      idempotency_key: existingNotification?.idempotency_key ?? idempotencyKey,
      status: "pending",
      last_error: null,
    }, { onConflict: "review_task_id,assignment_version" })
    .select("id,idempotency_key,attempts,status")
    .maybeSingle<{ id: string; idempotency_key: string; attempts: number; status: "pending" | "sent" | "failed" }>();
  if (!notification || (notification.status === "sent" && !assignmentChanged)) {
    return { needsReview: true as const, taskCreated: assignmentChanged, notificationSent: false };
  }

  try {
    const result = await sendResendEmail({
      to: reviewerEmail,
      bcc: [REVIEW_NOTIFICATION_BCC],
      subject: "INSUREIT Policy OCR review task",
      text: buildReviewerEmail(task.id, document.file_name, policy?.insurance_companies?.name ?? null, policy?.policy_type ?? null, comparison),
      idempotencyKey: notification.idempotency_key,
    });
    await admin.from("policy_ocr_training_review_notifications").update({
      status: "sent",
      attempts: notification.attempts + 1,
      provider_message_id: result.id,
      last_error: null,
      sent_at: new Date().toISOString(),
    }).eq("id", notification.id);
    return { needsReview: true as const, taskCreated: assignmentChanged, notificationSent: true };
  } catch (error) {
    await admin.from("policy_ocr_training_review_notifications").update({
      status: "failed",
      attempts: notification.attempts + 1,
      last_error: error instanceof Error && error.message === "resend_configuration_missing" ? "resend_configuration_missing" : "resend_request_failed",
    }).eq("id", notification.id);
    return { needsReview: true as const, taskCreated: assignmentChanged, notificationSent: false, error: "notification_failed" };
  }
}

export async function ensurePolicyOcrSatisfactionTask(orchestratorId: string) {
  const admin = createSupabaseAdminClient();
  const { data: run } = await admin.from("policy_ocr_training_orchestrators").select("id,status").eq("id", orchestratorId).maybeSingle<{ id: string; status: string }>();
  if (!run || run.status !== "awaiting_satisfaction") return { created: false, notified: false };
  const reviewerEmail = normalizeEmail(process.env.POLICY_OCR_DEFAULT_REVIEWER_EMAIL) ?? DEFAULT_REVIEWER_EMAIL;
  const reviewer = await resolveExistingPortalReviewer(admin, reviewerEmail);
  const { data: existing } = await admin.from("policy_ocr_training_review_tasks")
    .select("id,assignment_version,status")
    .eq("orchestrator_id", orchestratorId).eq("task_type", "satisfaction").neq("status", "cancelled")
    .maybeSingle<{ id: string; assignment_version: number; status: string }>();
  const task = existing ?? (await admin.from("policy_ocr_training_review_tasks").insert({
    training_label_id: null, assigned_reviewer_profile_id: reviewer.profileId, assigned_by_profile_id: null,
    task_type: "satisfaction", orchestrator_id: orchestratorId, field_questions: [], checklist: {},
  }).select("id,assignment_version,status").maybeSingle<{ id: string; assignment_version: number; status: string }>()).data;
  if (!task) return { created: false, notified: false };
  const idempotencyKey = `policy-ocr-satisfaction:${orchestratorId}:${task.assignment_version}`;
  const { data: notification } = await admin.from("policy_ocr_training_review_notifications").upsert({
    review_task_id: task.id, assignment_version: task.assignment_version, recipient_profile_id: reviewer.profileId,
    idempotency_key: idempotencyKey, status: "pending", last_error: null,
  }, { onConflict: "review_task_id,assignment_version" }).select("id,attempts,status").maybeSingle<{ id: string; attempts: number; status: string }>();
  if (!notification || notification.status === "sent") return { created: !existing, notified: false };
  try {
    const portalUrl = new URL("/policies/ocr-training", process.env.NEXT_PUBLIC_PORTAL_URL?.trim() || "https://portal.insureit.in");
    portalUrl.searchParams.set("review_task", task.id);
    const result = await sendResendEmail({
      to: reviewerEmail, bcc: [REVIEW_NOTIFICATION_BCC], subject: "INSUREIT Policy OCR fresh-policy satisfaction check",
      text: ["A bounded OCR training iteration met its automated acceptance gates.", "Please upload/check a fresh policy in the protected portal and record whether the result meets your expectations.", "Keep policy content, identifiers and PII inside the secure portal.", `Open the protected task: ${portalUrl.toString()}`].join("\n"),
      idempotencyKey,
    });
    await admin.from("policy_ocr_training_review_notifications").update({ status: "sent", attempts: notification.attempts + 1, provider_message_id: result.id, sent_at: new Date().toISOString(), last_error: null }).eq("id", notification.id);
    return { created: !existing, notified: true };
  } catch {
    await admin.from("policy_ocr_training_review_notifications").update({ status: "failed", attempts: notification.attempts + 1, last_error: "resend_request_failed" }).eq("id", notification.id);
    return { created: !existing, notified: false };
  }
}

const FIELD_LABELS: Record<keyof TrainingDatabaseReference, string> = {
  vehicle_registration_status: "Vehicle registration status",
  vehicle_registration_number: "Vehicle registration number",
  vehicle_class: "Vehicle class",
  vehicle_make: "Vehicle make",
  vehicle_model: "Vehicle model",
  vehicle_fuel_type: "Fuel type",
  vehicle_manufacturing_year: "Manufacturing year",
  vehicle_capacity: "Vehicle capacity",
  vehicle_chassis_number: "Chassis number",
  vehicle_engine_number: "Engine number",
  vehicle_rto_name: "RTO name",
  vehicle_rto_state: "RTO state",
  insurer_name: "Insurer",
  policy_product: "Policy product",
  policy_number: "Current policy number",
  valid_from: "Policy start date",
  valid_upto: "Policy end date",
  idv: "IDV",
  od_premium: "OD premium",
  tp_premium: "TP premium",
  cpa_opted: "CPA opted",
  cpa_premium: "CPA amount",
  printed_net_premium: "Printed net premium",
  printed_gst: "Printed GST",
  printed_gross_premium: "Printed gross premium",
};

function buildFieldQuestions(
  comparison: ReturnType<typeof compareTrainingProposalToReference>,
  proposal: TrainingProposal,
  reference: TrainingDatabaseReference,
) {
  return Object.entries(comparison.fields).filter(([, result]) => result !== "match").map(([key, result]) => ({
    key, issue: result,
    prompt: buildFieldQuestionPrompt(
      key as keyof TrainingDatabaseReference,
      result,
      proposal,
      reference,
    ),
    allowedAnswers: result === "reference_missing" ? ["provide_correct_value", "withhold"] : ["ocr_correct", "database_correct", "provide_correct_value", "withhold"],
  }));
}

function buildFieldQuestionPrompt(
  key: keyof TrainingDatabaseReference,
  result: string,
  proposal: TrainingProposal,
  reference: TrainingDatabaseReference,
) {
  const label = FIELD_LABELS[key];
  const proposalKey = (key === "valid_from" ? "policy_start_date" : key === "valid_upto" ? "policy_end_date" : key) as keyof TrainingProposal["fields"];
  const ocrValue = proposal.fields[proposalKey]?.value ?? null;
  const databaseValue = reference[key];

  if (result === "reference_missing") {
    return `For ${label}: the database reference is blank, but OCR proposed "${formatQuestionValue(ocrValue)}". Is ${label} visible on the policy copy, and what is the correct value?`;
  }
  if (result === "ocr_missing") {
    return `For ${label}: the database reference is "${formatQuestionValue(databaseValue)}", but OCR did not produce a value. Is ${label} visible on the policy copy, and what should be extracted?`;
  }
  return `For ${label}: the database reference is "${formatQuestionValue(databaseValue)}", while OCR proposed "${formatQuestionValue(ocrValue)}". Which value is correct according to the policy copy?`;
}

function formatQuestionValue(value: string | number | boolean | null) {
  if (value === null || value === "") return "blank";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

async function resolveExistingPortalReviewer(admin: ReturnType<typeof createSupabaseAdminClient>, email: string) {
  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authUser = users?.users.find((user) => user.email?.trim().toLowerCase() === email) ?? null;
  if (usersError || !authUser) throw new Error("automatic_reviewer_not_found");
  const { data: profile } = await admin.from("profiles").select("id,full_name,is_active,role,employee_id").eq("id", authUser.id).maybeSingle<{ id: string; full_name: string; is_active: boolean; role: string; employee_id: string | null }>();
  if (!profile?.is_active || ["customer", "intermediary"].includes(profile.role)) throw new Error("automatic_reviewer_inactive");
  if (profile.employee_id) {
    const { data: employee } = await admin.from("employees").select("id,email,employment_status").eq("id", profile.employee_id).maybeSingle<{ id: string; email: string | null; employment_status: string }>();
    if (!employee || employee.employment_status !== "active" || employee.email?.trim().toLowerCase() !== email) throw new Error("automatic_reviewer_not_active_employee");
  }
  return { profileId: profile.id };
}

function buildReviewerEmail(taskId: string, fileName: string | null, insurer: string | null, product: string | null, comparison: ReturnType<typeof compareTrainingProposalToReference>) {
  const taskReference = taskId.replaceAll("-", "").slice(0, 12).toUpperCase();
  const portalUrl = new URL("/policies/ocr-training", process.env.NEXT_PUBLIC_PORTAL_URL?.trim() || "https://portal.insureit.in");
  portalUrl.searchParams.set("review_task", taskId);
  return [
    "Hello,",
    "",
    "A policy OCR comparison needs review in the INSUREIT portal.",
    `Task reference: ${taskReference}`,
    `Policy copy label: ${safeFileLabel(fileName)}`,
    `Insurer: ${safeValue(insurer) || "Not linked"}`,
    `Product: ${safeValue(product) || "Not linked"}`,
    `Comparison: ${comparison.mismatchedFields} mismatched, ${comparison.missingOcrFields} missing/withheld.`,
    "",
    "Verify the private policy copy in the portal. Keep policy content, identifiers and PII inside the secure portal.",
    `Open the protected portal task: ${portalUrl.toString()}`,
  ].join("\n");
}

function normalizeEmail(value: string | undefined) {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

function safeFileLabel(value: string | null) {
  return (value ?? "Policy copy").split(/[\\/]/).pop()?.replace(/[^A-Za-z0-9._ -]+/g, " ").replace(/\b[A-Za-z0-9._-]*\d[A-Za-z0-9._-]*\b/g, "redacted").replace(/\s+/g, " ").trim().slice(0, 80) || "Policy copy";
}

function safeValue(value: string | null) {
  return (value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}
