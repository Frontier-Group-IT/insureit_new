"use server";

import { revalidatePath } from "next/cache";
import {
  DEFAULT_LEGACY_WORKFLOW,
  LEGACY_AGREEMENT_OPTIONS,
  LEGACY_EXAM_OPTIONS,
  LEGACY_IIB_REGISTRATION_OPTIONS,
  LEGACY_IIB_UPLOAD_OPTIONS,
  LEGACY_TRAINING_OPTIONS,
  registrationStatusForLegacyWorkflow,
  type LegacyAgreementStatus,
  type LegacyExamStatus,
  type LegacyIibRegistrationStatus,
  type LegacyIibUploadStatus,
  type LegacyTrainingStatus,
} from "@/app/customers/posp-misp/legacy-workflow-statuses";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedTraining = new Set<string>(LEGACY_TRAINING_OPTIONS.map((option) => option.value));
const allowedExam = new Set<string>(LEGACY_EXAM_OPTIONS.map((option) => option.value));
const allowedAgreement = new Set<string>(LEGACY_AGREEMENT_OPTIONS.map((option) => option.value));
const allowedIibUpload = new Set<string>(LEGACY_IIB_UPLOAD_OPTIONS.map((option) => option.value));
const allowedIibRegistration = new Set<string>(LEGACY_IIB_REGISTRATION_OPTIONS.map((option) => option.value));

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
  const trainingStatus = choice(formData, "legacy_training_status", allowedTraining, DEFAULT_LEGACY_WORKFLOW.trainingStatus) as LegacyTrainingStatus;
  const examStatus = choice(formData, "legacy_exam_status", allowedExam, DEFAULT_LEGACY_WORKFLOW.examStatus) as LegacyExamStatus;
  const agreementStatus = choice(formData, "legacy_agreement_status", allowedAgreement, DEFAULT_LEGACY_WORKFLOW.agreementStatus) as LegacyAgreementStatus;
  const iibUploadStatus = choice(formData, "legacy_iib_upload_status", allowedIibUpload, DEFAULT_LEGACY_WORKFLOW.iibUploadStatus) as LegacyIibUploadStatus;
  const iibRegistrationStatus = choice(formData, "legacy_iib_registration_status", allowedIibRegistration, DEFAULT_LEGACY_WORKFLOW.iibRegistrationStatus) as LegacyIibRegistrationStatus;
  const migration = {
    onboarding_mode: "legacy_existing_partner",
    record_source: "legacy_manual",
    legacy_partner_code: optionalText(formData, "legacy_partner_code"),
    legacy_registration_code: optionalText(formData, "legacy_registration_code"),
    legacy_original_onboarding_date: originalOnboardingDate,
    legacy_original_activation_date: originalActivationDate,
    legacy_training_status: trainingStatus,
    legacy_exam_status: examStatus,
    legacy_agreement_status: agreementStatus,
    legacy_iib_upload_status: iibUploadStatus,
    legacy_iib_registration_status: iibRegistrationStatus,
    legacy_migration_updated_at: now,
    legacy_migration_updated_by: actor.id,
  };
  const workflowRegistrationStatus = registrationStatusForLegacyWorkflow({
    trainingStatus,
    examStatus,
    agreementStatus,
    iibUploadStatus,
    iibRegistrationStatus,
  });

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

  // The draft/raw migration payload is the authoritative editable record. Persist it first and
  // keep optional workflow/register compatibility updates from blocking Save & Exit/Documents.
  for (const app of applications) {
    const context = accountContext(app.draft_data);
    const appUpdate: Record<string, unknown> = {
      draft_data: { ...object(app.draft_data), ...migration },
      updated_at: now,
    };
    if (context !== "partner") appUpdate.registration_status = workflowRegistrationStatus;
    const { error } = await admin.from("intermediary_onboarding_applications").update(appUpdate).eq("id", app.id);
    if (error) return { ok: false, message: "Migration details could not be synchronized to every application." };
  }

  for (const profile of profiles ?? []) {
    const app = applications.find((item) => item.id === profile.application_id);
    const context = accountContext(app?.draft_data);
    const coreProfileUpdate: Record<string, unknown> = {
      raw_data: { ...object(profile.raw_data), ...migration },
      onboarding_date: originalOnboardingDate,
      updated_by: actor.id,
      updated_at: now,
    };
    const { error } = await admin.from("posp_misp_onboarding_profiles").update(coreProfileUpdate).eq("id", profile.id);
    if (error) return { ok: false, message: "Migration details could not be synchronized to every profile." };

    if (context !== "partner") {
      const compatibilityUpdate: Record<string, unknown> = {
        training_status: trainingStatus,
        exam_status: examStatus,
        iib_uploaded: iibUploadStatus === "uploaded",
        iib_uploaded_at: iibUploadStatus === "uploaded" ? toTimestamp(originalActivationDate) ?? now : null,
        updated_by: actor.id,
        updated_at: now,
      };
      if (migration.legacy_registration_code) compatibilityUpdate.external_onboarding_id = migration.legacy_registration_code;
      await admin.from("posp_misp_onboarding_profiles").update(compatibilityUpdate).eq("id", profile.id);
    }
  }

  for (const app of applications) {
    if (accountContext(app.draft_data) === "partner") continue;

    const assignmentUpdate: Record<string, unknown> = {
      updated_at: now,
      training_status: trainingStatus,
      training_completed_at: trainingStatus === "completed" ? toTimestamp(originalActivationDate) ?? now : null,
      exam_status: examStatus,
      exam_completed_at: ["passed", "failed", "attempts_exhausted"].includes(examStatus) ? toTimestamp(originalActivationDate) ?? now : null,
      exam_passed_at: examStatus === "passed" ? toTimestamp(originalActivationDate) ?? now : null,
      agreement_status: agreementStatus,
      agreement_signed_at: agreementStatus === "signed" ? toTimestamp(originalActivationDate) ?? now : null,
    };
    await admin
      .from("intermediary_training_exam_assignments")
      .update(assignmentUpdate)
      .eq("application_id", app.id);

    const intermediaryUpdate: Record<string, unknown> = { updated_at: now };
    if (originalActivationDate) intermediaryUpdate.activated_at = toTimestamp(originalActivationDate);
    if (migration.legacy_registration_code) intermediaryUpdate.intermediary_code = migration.legacy_registration_code;
    await admin.from("intermediaries").update(intermediaryUpdate).eq("application_id", app.id);
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
