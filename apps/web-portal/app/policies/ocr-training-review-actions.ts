"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator, requirePolicyOcrTrainingViewer } from "@/lib/policy-ocr-training-access";
import { sanitizeEvidenceNote } from "@/lib/policy-ocr-training";
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
      throw new Error("This reviewer checklist is currently available only for IFFCO-Tokio Package policies.");
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
    if (REVIEW_CHECKLIST.some((key) => !checklist[key])) {
      throw new Error("Complete every checklist item after verifying the private policy copy.");
    }
    const note = sanitizeReviewerNote(formText(formData, "reviewer_note"));
    const { data: updated, error } = await createSupabaseAdminClient()
      .from("policy_ocr_training_review_tasks")
      .update({ status: "completed", checklist, reviewer_note: note, started_at: task.status === "assigned" ? new Date().toISOString() : undefined, completed_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("assigned_reviewer_profile_id", viewer.profile.id)
      .select("id")
      .maybeSingle<{ id: string }>();
    if (error || !updated) throw new Error("The reviewer checklist could not be saved.");
    revalidatePath(QUEUE_PATH);
    return { status: "success", message: "Checklist completed. The sanitized training approval remains with the authorized operator." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "The reviewer checklist could not be saved." };
  }
}

async function loadAssignedTask(taskId: string | null, profileId: string): Promise<ReviewTask> {
  if (!taskId) throw new Error("Reviewer task reference is missing.");
  const { data, error } = await createSupabaseAdminClient()
    .from("policy_ocr_training_review_tasks")
    .select("id,training_label_id,assigned_reviewer_profile_id,assignment_version,status")
    .eq("id", taskId)
    .eq("assigned_reviewer_profile_id", profileId)
    .maybeSingle<ReviewTask>();
  if (error || !data) throw new Error("This reviewer task is not assigned to your portal user.");
  return data;
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
