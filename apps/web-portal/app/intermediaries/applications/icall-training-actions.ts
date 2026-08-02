"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getIcallPospTrainingStatus, getIcallSso, registerIcallPosp } from "@/lib/icall-training-api";
import {
  isLegacyExamStatus,
  isLegacyTrainingStatus,
  isLegacyWorkflowActive,
  readLegacyWorkflow,
  registrationStatusForLegacyWorkflow,
  type LegacyExamStatus,
  type LegacyTrainingStatus,
  type LegacyWorkflowSelection,
} from "@/app/customers/posp-misp/legacy-workflow-statuses";

const route = (applicationId: string) => `/intermediaries/applications/${applicationId}/workflow`;

type SyncApplication = {
  id: string;
  source: string;
  final_type: string | null;
  status: string;
  registration_status: string;
  draft_data: Record<string, unknown> | null;
};

type SyncProfile = {
  record_source: string | null;
  raw_data: Record<string, unknown> | null;
  workflow_stage: string;
  training_status: string | null;
  exam_status: string | null;
  training_start_date: string | null;
  training_end_date: string | null;
};

type SyncAssignment = {
  training_title: string | null;
  training_url: string | null;
  training_instructions: string | null;
  training_assigned_at: string | null;
  training_started_at: string | null;
  training_completed_at: string | null;
  training_deadline: string | null;
  training_status: string | null;
  exam_title: string | null;
  exam_url: string | null;
  exam_completed_at: string | null;
  exam_passed_at: string | null;
  exam_status: string | null;
  exam_score: number | null;
};

export async function launchIcallTrainingSso(applicationId: string, submittedLoginId: string) {
  if (!applicationId) return { ok: false as const, message: "You are not authorized to open this training session." };
  const reviewer = await requireScopedPospMispManager(applicationId);
  if (!reviewer?.id) return { ok: false as const, message: "You are not authorized to open this training session." };

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("training_login_id,pan_number,dp_pan_number,partner_type")
    .eq("application_id", applicationId)
    .maybeSingle<{ training_login_id: string | null; pan_number: string | null; dp_pan_number: string | null; partner_type: "posp" | "misp" }>();

  if (!profile) return { ok: false as const, message: "The POSP/MISP training account was not found." };

  const storedLoginId = profile.training_login_id || normalizePan(profile.partner_type === "misp" ? profile.dp_pan_number : profile.pan_number);
  const requestedLoginId = normalizePan(submittedLoginId);
  if (!storedLoginId || !requestedLoginId || storedLoginId !== requestedLoginId) {
    return { ok: false as const, message: "The iCall login ID does not match this application." };
  }

  try {
    const response = await getIcallSso(storedLoginId);
    const redirectUrl = response.data?.redirectUrl?.trim();
    if (response.statusCode !== 200 || !redirectUrl) {
      return { ok: false as const, message: "iCall did not return a valid training session." };
    }

    const parsed = new URL(redirectUrl);
    if (parsed.protocol !== "https:" || parsed.hostname !== "www.icallinsurance.com") {
      return { ok: false as const, message: "iCall returned an unexpected training URL." };
    }

    return { ok: true as const, redirectUrl };
  } catch (error) {
    console.error("iCall SSO launch failed", { applicationId, loginId: storedLoginId, error });
    return { ok: false as const, message: "Unable to open iCall training right now." };
  }
}

export async function registerWithIcallUat(formData: FormData) {
  const applicationId = field(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp");
  const reviewer = await requireScopedPospMispManager(applicationId);
  if (!reviewer?.id) redirect("/customers/posp-misp");

  const admin = createSupabaseAdminClient();
  const { data: application } = await admin
    .from("intermediary_onboarding_applications")
    .select("id,final_type,applicant_phone,applicant_email")
    .eq("id", applicationId)
    .maybeSingle<{ id: string; final_type: string | null; applicant_phone: string | null; applicant_email: string | null }>();
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("partner_type,external_onboarding_id,pos_name,pos_first_name,pos_last_name,pan_number,date_of_birth,applicant_email,applicant_phone,misp_name,dp_name,dp_first_name,dp_last_name,dp_pan_number,dp_date_of_birth,dp_email,dp_phone,training_login_id")
    .eq("application_id", applicationId)
    .maybeSingle<{
      partner_type: "posp" | "misp";
      external_onboarding_id: string | null;
      pos_name: string | null;
      pos_first_name: string | null;
      pos_last_name: string | null;
      pan_number: string | null;
      date_of_birth: string | null;
      applicant_email: string | null;
      applicant_phone: string | null;
      misp_name: string | null;
      dp_name: string | null;
      dp_first_name: string | null;
      dp_last_name: string | null;
      dp_pan_number: string | null;
      dp_date_of_birth: string | null;
      dp_email: string | null;
      dp_phone: string | null;
      training_login_id: string | null;
    }>();

  if (!application || !profile || application.final_type === "partner") {
    redirect(`${route(applicationId)}?stage=review&error=icall_account_required`);
  }
  if (profile.training_login_id) redirect(`${route(applicationId)}?stage=review&error=icall_already_registered`);

  const isMisp = profile.partner_type === "misp";
  const pan = normalizePan(isMisp ? profile.dp_pan_number : profile.pan_number);
  const mobile = normalizeMobile((isMisp ? profile.dp_phone : profile.applicant_phone) || application.applicant_phone);
  const email = ((isMisp ? profile.dp_email : profile.applicant_email) || application.applicant_email)?.trim().toLowerCase() || null;
  const nameParts = isMisp ? resolveName(profile.dp_first_name, profile.dp_last_name, profile.dp_name) : resolveName(profile.pos_first_name, profile.pos_last_name, profile.pos_name);
  const dob = formatDob(isMisp ? profile.dp_date_of_birth : profile.date_of_birth);
  if (!pan || !nameParts.firstName || !email || !mobile) {
    redirect(`${route(applicationId)}?stage=review&error=icall_details_incomplete`);
  }

  try {
    const response = await registerIcallPosp({
      pan,
      pospFirstName: nameParts.firstName,
      pospLastName: nameParts.lastName,
      dob: dob || "",
      email_id: email,
      mobile,
      internalPOSCode: profile.external_onboarding_id?.trim() || applicationId,
    });

    const created = response.new_users?.[0];
    const existing = response.skipped_user;
    const loginId = created?.loginid || existing?.loginid || (existing?.message?.toLowerCase().includes("training ongoing") ? pan : null);
    if (!loginId) throw new Error("iCall registration did not return a login ID.");

    await syncStatusIntoPortal(admin, reviewer.id, applicationId, loginId, profile.partner_type);
    revalidatePath(route(applicationId));
    redirect(`${route(applicationId)}?stage=review&success=icall_registered`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("iCall UAT registration failed", { applicationId, partnerType: profile.partner_type, error });
    redirect(`${route(applicationId)}?stage=review&error=icall_registration_failed`);
  }
}

export async function syncIcallUatStatus(formData: FormData) {
  const applicationId = field(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp");
  const reviewer = await requireScopedPospMispManager(applicationId);
  if (!reviewer?.id) redirect("/customers/posp-misp");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("training_login_id,pan_number,dp_pan_number,partner_type")
    .eq("application_id", applicationId)
    .maybeSingle<{ training_login_id: string | null; pan_number: string | null; dp_pan_number: string | null; partner_type: "posp" | "misp" }>();
  if (!profile) redirect(`${route(applicationId)}?stage=review&error=icall_account_required`);

  const loginId = profile.training_login_id || normalizePan(profile.partner_type === "misp" ? profile.dp_pan_number : profile.pan_number);
  if (!loginId) redirect(`${route(applicationId)}?stage=review&error=icall_not_registered`);

  try {
    await syncStatusIntoPortal(admin, reviewer.id, applicationId, loginId, profile.partner_type);
    revalidatePath(route(applicationId));
    redirect(`${route(applicationId)}?stage=review&success=icall_status_synced`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("iCall UAT status sync failed", { applicationId, loginId, error });
    redirect(`${route(applicationId)}?stage=review&error=icall_status_failed`);
  }
}

async function syncStatusIntoPortal(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  reviewerId: string,
  applicationId: string,
  loginId: string,
  partnerType: "posp" | "misp",
) {
  const [{ data: application, error: applicationError }, { data: profile, error: profileError }, { data: assignment, error: assignmentError }] = await Promise.all([
    admin
      .from("intermediary_onboarding_applications")
      .select("id,source,final_type,status,registration_status,draft_data")
      .eq("id", applicationId)
      .maybeSingle<SyncApplication>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("record_source,raw_data,workflow_stage,training_status,exam_status,training_start_date,training_end_date")
      .eq("application_id", applicationId)
      .maybeSingle<SyncProfile>(),
    admin
      .from("intermediary_training_exam_assignments")
      .select("training_title,training_url,training_instructions,training_assigned_at,training_started_at,training_completed_at,training_deadline,training_status,exam_title,exam_url,exam_completed_at,exam_passed_at,exam_status,exam_score")
      .eq("application_id", applicationId)
      .maybeSingle<SyncAssignment>(),
  ]);

  if (applicationError || profileError || assignmentError || !application || !profile || application.final_type === "partner") {
    throw new Error("The POSP/MISP workflow could not be loaded safely.");
  }

  const response = await getIcallPospTrainingStatus(loginId);
  if (response.statusCode !== 200 || !response.data) throw new Error("iCall training status was unavailable.");

  const data = response.data;
  const now = new Date().toISOString();
  const icallTrainingStatus = normalizeTrainingStatus(data.training_status);
  const icallExamStatus = normalizeExamStatus(data.final_exam?.result);
  const issueDate = parseIcallDate(data.issue_date);
  const expiryDate = parseIcallDate(data.expiry_date);
  const startedAt = parseIcallDate(data.start_date);
  const completedAt = parseIcallDate(data.training_completion_date || data.end_date);
  const examCompletedAt = parseIcallDate(data.final_exam?.completion_date);
  const score = data.final_exam?.score == null || data.final_exam.score === "" ? null : Number(data.final_exam.score);

  const draft = asObject(application.draft_data);
  const raw = asObject(profile.raw_data);
  const legacy = isLegacyLinkedAccount(application, profile, draft, raw);
  const manualWorkflow = readLegacyWorkflow(draft, raw);
  const effectiveWorkflow = legacy
    ? mergeLegacyWorkflow(manualWorkflow, assignment, profile, icallTrainingStatus, icallExamStatus)
    : null;

  const effectiveTrainingStatus = effectiveWorkflow?.trainingStatus ?? icallTrainingStatus;
  const effectiveExamStatus = effectiveWorkflow?.examStatus ?? icallExamStatus;
  const effectiveRegistrationStatus = effectiveWorkflow
    ? registrationStatusForLegacyWorkflow(effectiveWorkflow)
    : registrationStatusForNormalIcall(effectiveTrainingStatus, effectiveExamStatus);
  const effectiveWorkflowStage = effectiveWorkflow && isLegacyWorkflowActive(effectiveWorkflow) ? "completed" : "training";
  const effectiveApplicationStatus = legacy ? "approved" : "under_review";

  const accountLabel = partnerType.toUpperCase();
  const { error: assignmentWriteError } = await admin.from("intermediary_training_exam_assignments").upsert({
    application_id: applicationId,
    training_title: assignment?.training_title ?? `iCall ${accountLabel} 15 Hours Training (UAT)`,
    training_url: assignment?.training_url ?? "https://www.icallinsurance.com/",
    training_instructions: `iCall UAT login ID: ${loginId}. Status is synced from the iCall API without replacing manually imported legacy history.`,
    training_assigned_at: issueDate ?? assignment?.training_assigned_at ?? now,
    training_started_at: startedAt ?? assignment?.training_started_at ?? null,
    training_completed_at: effectiveTrainingStatus === "completed"
      ? completedAt ?? assignment?.training_completed_at ?? null
      : assignment?.training_completed_at ?? null,
    training_deadline: expiryDate ?? assignment?.training_deadline ?? null,
    training_status: effectiveTrainingStatus,
    exam_title: effectiveExamStatus === "not_allotted"
      ? assignment?.exam_title ?? null
      : assignment?.exam_title ?? (icallExamStatus !== "not_allotted" ? `iCall ${accountLabel} Final Examination (UAT)` : null),
    exam_url: effectiveExamStatus === "not_allotted"
      ? assignment?.exam_url ?? null
      : assignment?.exam_url ?? (icallExamStatus !== "not_allotted" ? "https://www.icallinsurance.com/" : null),
    exam_completed_at: examCompletedAt ?? assignment?.exam_completed_at ?? null,
    exam_passed_at: effectiveExamStatus === "passed"
      ? examCompletedAt ?? assignment?.exam_passed_at ?? now
      : assignment?.exam_passed_at ?? null,
    exam_status: effectiveExamStatus,
    exam_score: Number.isFinite(score) ? score : assignment?.exam_score ?? null,
    icall_login_id: data.login_id || loginId,
    icall_candidate_name: data.candidate_name || null,
    icall_mobile_number: data.mobileNumber || null,
    icall_internal_pos_code: data.internal_pos_code || null,
    icall_issue_date: dateOnly(issueDate),
    icall_expiry_date: dateOnly(expiryDate),
    icall_hours_allotted: data.hours_allotted || null,
    icall_hours_completed: data.hours_completed || null,
    icall_hours_remaining: data.hours_remaining || null,
    icall_last_synced_at: now,
    updated_by: reviewerId,
    updated_at: now,
  }, { onConflict: "application_id" });
  if (assignmentWriteError) throw new Error("The iCall assignment state could not be saved.");

  const { error: profileWriteError } = await admin.from("posp_misp_onboarding_profiles").update({
    training_login_id: loginId,
    training_credentials_shared_flag: true,
    training_start_date: dateOnly(startedAt ?? issueDate) ?? profile.training_start_date ?? now.slice(0, 10),
    training_end_date: effectiveTrainingStatus === "completed"
      ? dateOnly(completedAt) ?? profile.training_end_date
      : profile.training_end_date,
    training_status: effectiveTrainingStatus,
    exam_status: effectiveExamStatus,
    workflow_stage: effectiveWorkflowStage,
    updated_by: reviewerId,
    updated_at: now,
  }).eq("application_id", applicationId);
  if (profileWriteError) throw new Error("The onboarding profile could not be synchronized.");

  const { error: applicationWriteError } = await admin.from("intermediary_onboarding_applications").update({
    status: effectiveApplicationStatus,
    registration_status: effectiveRegistrationStatus,
    updated_at: now,
  }).eq("id", applicationId);
  if (applicationWriteError) throw new Error("The application workflow could not be synchronized.");
}

function mergeLegacyWorkflow(
  manual: LegacyWorkflowSelection,
  assignment: SyncAssignment | null,
  profile: SyncProfile,
  icallTrainingStatus: LegacyTrainingStatus,
  icallExamStatus: LegacyExamStatus,
): LegacyWorkflowSelection {
  return {
    ...manual,
    trainingStatus: mostAdvancedTrainingStatus(
      manual.trainingStatus,
      validTrainingStatus(assignment?.training_status),
      validTrainingStatus(profile.training_status),
      icallTrainingStatus,
    ),
    examStatus: mostAdvancedExamStatus(
      manual.examStatus,
      validExamStatus(assignment?.exam_status),
      validExamStatus(profile.exam_status),
      icallExamStatus,
    ),
  };
}

function mostAdvancedTrainingStatus(...values: Array<LegacyTrainingStatus | null>) {
  const rank: Record<LegacyTrainingStatus, number> = {
    not_assigned: 0,
    assigned: 1,
    opened: 2,
    expired: 2,
    in_progress: 3,
    completed: 4,
  };
  return values.reduce<LegacyTrainingStatus>((best, value) => {
    if (!value) return best;
    return rank[value] >= rank[best] ? value : best;
  }, "not_assigned");
}

function mostAdvancedExamStatus(...values: Array<LegacyExamStatus | null>) {
  const rank: Record<LegacyExamStatus, number> = {
    not_allotted: 0,
    locked: 1,
    allotted: 2,
    available: 2,
    in_progress: 3,
    failed: 4,
    attempts_exhausted: 5,
    passed: 6,
  };
  return values.reduce<LegacyExamStatus>((best, value) => {
    if (!value) return best;
    return rank[value] >= rank[best] ? value : best;
  }, "not_allotted");
}

function registrationStatusForNormalIcall(trainingStatus: LegacyTrainingStatus, examStatus: LegacyExamStatus) {
  if (examStatus === "passed") return "agreement_pending";
  if (examStatus === "failed" || examStatus === "attempts_exhausted") return "exam_failed";
  if (examStatus === "in_progress") return "exam_in_progress";
  if (["allotted", "locked", "available"].includes(examStatus)) return "exam_allotted";
  if (trainingStatus === "completed") return "training_completed";
  if (trainingStatus === "in_progress" || trainingStatus === "opened") return "training_in_progress";
  return "training_assigned";
}

function isLegacyLinkedAccount(
  application: SyncApplication,
  profile: SyncProfile,
  draft: Record<string, unknown>,
  raw: Record<string, unknown>,
) {
  const legacySources = new Set(["legacy_manual", "legacy_manual_pending_activation"]);
  return application.source === "legacy_manual"
    || profile.record_source === "legacy_manual"
    || profile.record_source === "legacy_manual_pending_activation"
    || draft.onboarding_mode === "legacy_existing_partner"
    || raw.onboarding_mode === "legacy_existing_partner"
    || (typeof draft.record_source === "string" && legacySources.has(draft.record_source))
    || (typeof raw.record_source === "string" && legacySources.has(raw.record_source));
}

function validTrainingStatus(value: unknown) {
  return isLegacyTrainingStatus(value) ? value : null;
}

function validExamStatus(value: unknown) {
  return isLegacyExamStatus(value) ? value : null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePan(value: string | null) {
  const pan = value?.replace(/\s/g, "").toUpperCase() || "";
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan) ? pan : null;
}

function normalizeMobile(value: string | null) {
  const digits = value?.replace(/\D/g, "") || "";
  const mobile = digits.slice(-10);
  return /^[6-9][0-9]{9}$/.test(mobile) ? mobile : null;
}

function resolveName(firstName: string | null, lastName: string | null, fullName: string | null) {
  const first = firstName?.trim() || "";
  const last = lastName?.trim() || "";
  if (first) return { firstName: first, lastName: last };
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) || [];
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) || "" };
}

function formatDob(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function parseIcallDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`;
  const us = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1]}-${us[2]}T00:00:00.000Z`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function normalizeTrainingStatus(value: string | null | undefined): LegacyTrainingStatus {
  const status = value?.trim().toLowerCase() || "";
  if (status.includes("complete")) return "completed";
  if (status.includes("expire")) return "expired";
  if (status.includes("ongoing") || status.includes("on going") || status.includes("progress")) return "in_progress";
  return "assigned";
}

function normalizeExamStatus(value: string | null | undefined): LegacyExamStatus {
  const result = value?.trim().toLowerCase() || "";
  if (result === "passed" || result === "pass") return "passed";
  if (result === "failed" || result === "fail") return "failed";
  if (result.includes("progress")) return "in_progress";
  return "not_allotted";
}

function isRedirectError(error: unknown) {
  return error instanceof Error && error.message === "NEXT_REDIRECT";
}
