"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getIcallPospTrainingStatus, registerIcallPosp } from "@/lib/icall-training-api";

const route = (applicationId: string) => `/intermediaries/applications/${applicationId}/workflow`;

export async function registerWithIcallUat(formData: FormData) {
  const reviewer = await requirePospMispManager();
  const applicationId = field(formData, "application_id");
  if (!reviewer?.id || !applicationId) redirect("/customers/posp-misp");

  const admin = createSupabaseAdminClient();
  const { data: application } = await admin
    .from("intermediary_onboarding_applications")
    .select("id,final_type,applicant_phone,applicant_email")
    .eq("id", applicationId)
    .maybeSingle<{ id: string; final_type: string | null; applicant_phone: string | null; applicant_email: string | null }>();
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("partner_type,external_onboarding_id,pos_name,pos_first_name,pos_last_name,pan_number,date_of_birth,applicant_email,applicant_phone,training_login_id")
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
      training_login_id: string | null;
    }>();

  if (!application || !profile || application.final_type === "partner" || profile.partner_type !== "posp") {
    redirect(`${route(applicationId)}?stage=review&error=icall_posp_only`);
  }
  if (profile.training_login_id) redirect(`${route(applicationId)}?stage=review&error=icall_already_registered`);

  const pan = normalizePan(profile.pan_number);
  const mobile = normalizeMobile(profile.applicant_phone || application.applicant_phone);
  const email = (profile.applicant_email || application.applicant_email)?.trim().toLowerCase() || null;
  const nameParts = resolveName(profile.pos_first_name, profile.pos_last_name, profile.pos_name);
  const dob = formatDob(profile.date_of_birth);
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
    if (!loginId) throw new Error(response.message || existing?.message || "Registration failed");

    await syncStatusIntoPortal(admin, reviewer.id, applicationId, loginId);
    revalidatePath(route(applicationId));
    redirect(`${route(applicationId)}?stage=review&success=icall_registered`);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error("iCall UAT registration failed", { applicationId, error });
    redirect(`${route(applicationId)}?stage=review&error=icall_registration_failed`);
  }
}

export async function syncIcallUatStatus(formData: FormData) {
  const reviewer = await requirePospMispManager();
  const applicationId = field(formData, "application_id");
  if (!reviewer?.id || !applicationId) redirect("/customers/posp-misp");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("training_login_id,pan_number,partner_type")
    .eq("application_id", applicationId)
    .maybeSingle<{ training_login_id: string | null; pan_number: string | null; partner_type: "posp" | "misp" }>();
  if (!profile || profile.partner_type !== "posp") redirect(`${route(applicationId)}?stage=review&error=icall_posp_only`);

  const loginId = profile.training_login_id || normalizePan(profile.pan_number);
  if (!loginId) redirect(`${route(applicationId)}?stage=review&error=icall_not_registered`);

  try {
    await syncStatusIntoPortal(admin, reviewer.id, applicationId, loginId);
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
) {
  const response = await getIcallPospTrainingStatus(loginId);
  if (response.statusCode !== 200 || !response.data) throw new Error(response.message || "Status not found");

  const data = response.data;
  const now = new Date().toISOString();
  const trainingStatus = normalizeTrainingStatus(data.training_status);
  const examStatus = normalizeExamStatus(data.final_exam?.result);
  const issueDate = parseIcallDate(data.issue_date);
  const expiryDate = parseIcallDate(data.expiry_date);
  const startedAt = parseIcallDate(data.start_date);
  const completedAt = parseIcallDate(data.training_completion_date || data.end_date);
  const examCompletedAt = parseIcallDate(data.final_exam?.completion_date);
  const score = data.final_exam?.score == null || data.final_exam.score === "" ? null : Number(data.final_exam.score);

  await admin.from("intermediary_training_exam_assignments").upsert({
    application_id: applicationId,
    training_title: "iCall POSP 15 Hours Training (UAT)",
    training_url: "https://www.icallinsurance.com/",
    training_instructions: `iCall UAT login ID: ${loginId}. Status is synced from the iCall API.`,
    training_assigned_at: issueDate || now,
    training_started_at: startedAt,
    training_completed_at: completedAt,
    training_deadline: expiryDate,
    training_status: trainingStatus,
    exam_title: examStatus === "not_allotted" ? null : "iCall POSP Final Examination (UAT)",
    exam_url: examStatus === "not_allotted" ? null : "https://www.icallinsurance.com/",
    exam_completed_at: examCompletedAt,
    exam_passed_at: examStatus === "passed" ? examCompletedAt || now : null,
    exam_status: examStatus,
    exam_score: Number.isFinite(score) ? score : null,
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

  await admin.from("posp_misp_onboarding_profiles").update({
    training_login_id: loginId,
    training_credentials_shared_flag: true,
    training_start_date: (startedAt || issueDate || now).slice(0, 10),
    training_end_date: completedAt?.slice(0, 10) || null,
    training_status: trainingStatus,
    exam_status: examStatus,
    workflow_stage: "training",
    updated_by: reviewerId,
    updated_at: now,
  }).eq("application_id", applicationId);

  const registrationStatus = examStatus === "passed"
    ? "agreement_pending"
    : examStatus === "failed"
      ? "exam_failed"
      : trainingStatus === "completed"
        ? "training_completed"
        : trainingStatus === "in_progress"
          ? "training_in_progress"
          : "training_assigned";
  await admin.from("intermediary_onboarding_applications").update({
    status: "under_review",
    registration_status: registrationStatus,
    updated_at: now,
  }).eq("id", applicationId);
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

function normalizeTrainingStatus(value: string | null | undefined) {
  const status = value?.trim().toLowerCase() || "";
  if (status.includes("complete")) return "completed";
  if (status.includes("expire")) return "expired";
  if (status.includes("ongoing") || status.includes("on going") || status.includes("progress")) return "in_progress";
  return "assigned";
}

function normalizeExamStatus(value: string | null | undefined) {
  const result = value?.trim().toLowerCase() || "";
  if (result === "passed" || result === "pass") return "passed";
  if (result === "failed" || result === "fail") return "failed";
  return "not_allotted";
}

function isRedirectError(error: unknown) {
  return error instanceof Error && error.message === "NEXT_REDIRECT";
}
