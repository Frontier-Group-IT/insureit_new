"use server";

import { revalidatePath } from "next/cache";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedTraining = new Set(["not_assigned", "assigned", "in_progress", "completed", "unknown"]);
const allowedExam = new Set(["not_allotted", "allotted", "in_progress", "passed", "failed", "unknown"]);
const allowedAgreement = new Set(["not_started", "sent", "opened", "signed", "unknown"]);
const allowedIibUpload = new Set(["pending", "uploaded", "unknown"]);
const allowedIibRegistration = new Set(["pending", "submitted", "registered", "unknown"]);

export type MigrationSaveState = { ok: boolean; message: string; savedAt?: string };

type ApplicationRow = {
  id: string;
  partner_record_id: string | null;
  draft_data: Record<string, unknown> | null;
};
type ProfileRow = {
  id: string;
  application_id: string;
  raw_data: Record<string, unknown> | null;
};

export async function updateExistingIntermediaryMigrationDetails(
  _previous: MigrationSaveState,
  formData: FormData,
): Promise<MigrationSaveState> {
  const applicationId = text(formData, "application_id");
  if (!applicationId) return { ok: false, message: "Application reference is missing." };

  const actor = await requireScopedPospMispManager(applicationId);
  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin
    .from("intermediary_onboarding_applications")
    .select("id,partner_record_id,draft_data")
    .eq("id", applicationId)
    .maybeSingle<ApplicationRow>();
  if (currentError || !current) return { ok: false, message: "The migration record could not be found." };

  const originalOnboardingDate = dateValue(formData, "legacy_original_onboarding_date");
  const originalActivationDate = dateValue(formData, "legacy_original_activation_date");
  if (originalOnboardingDate && originalActivationDate && originalActivationDate < originalOnboardingDate) {
    return { ok: false, message: "Activation date cannot be earlier than onboarding date." };
  }

  const now = new Date().toISOString();
  const migration = {
    onboarding_mode: "legacy_existing_partner",
    record_source: "legacy_manual",
    legacy_partner_code: optionalText(formData, "legacy_partner_code"),
    legacy_registration_code: optionalText(formData, "legacy_registration_code"),
    legacy_original_onboarding_date: originalOnboardingDate,
    legacy_original_activation_date: originalActivationDate,
    legacy_training_status: choice(formData, "legacy_training_status", allowedTraining, "unknown"),
    legacy_exam_status: choice(formData, "legacy_exam_status", allowedExam, "unknown"),
    legacy_agreement_status: choice(formData, "legacy_agreement_status", allowedAgreement, "unknown"),
    legacy_iib_upload_status: choice(formData, "legacy_iib_upload_status", allowedIibUpload, "unknown"),
    legacy_iib_registration_status: choice(formData, "legacy_iib_registration_status", allowedIibRegistration, "unknown"),
    legacy_verification_remarks: optionalText(formData, "legacy_verification_remarks"),
    legacy_migration_updated_at: now,
    legacy_migration_updated_by: actor.id,
  };

  let applications: ApplicationRow[] = [current];
  if (current.partner_record_id) {
    const { data, error } = await admin
      .from("intermediary_onboarding_applications")
      .select("id,partner_record_id,draft_data")
      .eq("partner_record_id", current.partner_record_id)
      .returns<ApplicationRow[]>();
    if (error) return { ok: false, message: "Linked account records could not be loaded." };
    applications = data?.length ? data : [current];
  }

  const applicationIds = applications.map((item) => item.id);
  const { data: profiles, error: profilesError } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id,application_id,raw_data")
    .in("application_id", applicationIds)
    .returns<ProfileRow[]>();
  if (profilesError) return { ok: false, message: "Linked profile records could not be loaded." };

  for (const app of applications) {
    const context = accountContext(app.draft_data);
    const registrationStatus = context === "partner"
      ? undefined
      : mapRegistrationStatus(migration.legacy_iib_registration_status);
    const appUpdate: Record<string, unknown> = {
      draft_data: { ...object(app.draft_data), ...migration },
      updated_at: now,
    };
    if (registrationStatus) appUpdate.registration_status = registrationStatus;
    const { error } = await admin.from("intermediary_onboarding_applications").update(appUpdate).eq("id", app.id);
    if (error) return { ok: false, message: "Migration details could not be synchronized to every application." };
  }

  for (const profile of profiles ?? []) {
    const app = applications.find((item) => item.id === profile.application_id);
    const context = accountContext(app?.draft_data);
    const profileUpdate: Record<string, unknown> = {
      raw_data: { ...object(profile.raw_data), ...migration },
      onboarding_date: originalOnboardingDate,
      updated_by: actor.id,
      updated_at: now,
    };
    if (context !== "partner") {
      if (migration.legacy_training_status !== "unknown") profileUpdate.training_status = migration.legacy_training_status;
      if (migration.legacy_exam_status !== "unknown") profileUpdate.exam_status = migration.legacy_exam_status;
      if (migration.legacy_iib_upload_status !== "unknown") {
        profileUpdate.iib_uploaded = migration.legacy_iib_upload_status === "uploaded";
        profileUpdate.iib_uploaded_at = migration.legacy_iib_upload_status === "uploaded"
          ? toTimestamp(originalActivationDate) ?? now
          : null;
      }
      if (migration.legacy_registration_code) profileUpdate.external_onboarding_id = migration.legacy_registration_code;
    }
    const { error } = await admin.from("posp_misp_onboarding_profiles").update(profileUpdate).eq("id", profile.id);
    if (error) return { ok: false, message: "Migration details could not be synchronized to every profile." };
  }

  for (const app of applications) {
    if (accountContext(app.draft_data) === "partner") continue;

    const assignmentUpdate: Record<string, unknown> = { updated_at: now };
    if (migration.legacy_training_status !== "unknown") {
      assignmentUpdate.training_status = migration.legacy_training_status;
      assignmentUpdate.training_completed_at = migration.legacy_training_status === "completed" ? toTimestamp(originalActivationDate) ?? now : null;
    }
    if (migration.legacy_exam_status !== "unknown") {
      assignmentUpdate.exam_status = migration.legacy_exam_status;
      assignmentUpdate.exam_completed_at = ["passed", "failed"].includes(migration.legacy_exam_status) ? toTimestamp(originalActivationDate) ?? now : null;
      assignmentUpdate.exam_passed_at = migration.legacy_exam_status === "passed" ? toTimestamp(originalActivationDate) ?? now : null;
    }
    if (migration.legacy_agreement_status !== "unknown") {
      assignmentUpdate.agreement_status = migration.legacy_agreement_status;
      assignmentUpdate.agreement_signed_at = migration.legacy_agreement_status === "signed" ? toTimestamp(originalActivationDate) ?? now : null;
    }
    if (Object.keys(assignmentUpdate).length > 1) {
      await admin.from("intermediary_training_exam_assignments").update(assignmentUpdate).eq("application_id", app.id);
    }

    const intermediaryUpdate: Record<string, unknown> = { updated_at: now };
    if (originalActivationDate) intermediaryUpdate.activated_at = toTimestamp(originalActivationDate);
    if (migration.legacy_registration_code) intermediaryUpdate.intermediary_code = migration.legacy_registration_code;
    const { error: intermediaryError } = await admin.from("intermediaries").update(intermediaryUpdate).eq("application_id", app.id);
    if (intermediaryError) return { ok: false, message: "The linked POSP/MISP register could not be updated. Check whether the entered ID is already in use." };
  }

  for (const id of applicationIds) {
    revalidatePath(`/intermediaries/applications/${id}`);
    revalidatePath(`/intermediaries/applications/${id}/workflow`);
  }
  revalidatePath("/intermediaries");
  revalidatePath("/intermediaries/partners");
  revalidatePath("/intermediaries/posp");
  revalidatePath("/intermediaries/misp");

  return { ok: true, message: "Migration details saved and synchronized.", savedAt: now };
}

function mapRegistrationStatus(value: string) {
  if (value === "registered") return "iib_registered";
  if (value === "submitted") return "iib_submitted";
  if (value === "pending") return "iib_submission_pending";
  return null;
}
function accountContext(draft: Record<string, unknown> | null | undefined) {
  const context = draft?.account_context;
  return context === "posp" || context === "misp" ? context : "partner";
}
function toTimestamp(value: string | null) { return value ? `${value}T00:00:00.000Z` : null; }
function text(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; }
function optionalText(data: FormData, key: string) { return text(data, key); }
function dateValue(data: FormData, key: string) { const value = text(data, key); return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
function choice(data: FormData, key: string, allowed: Set<string>, fallback: string) { const value = text(data, key); return value && allowed.has(value) ? value : fallback; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
