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
  partner_record_id: string | null;
  raw_data: Record<string, unknown> | null;
};
type ApplicationReferenceRow = { application_id: string };
type RegistrationReferenceRow = { application_id: string | null };

export async function updateExistingIntermediaryMigrationDetails(
  _previous: MigrationSaveState,
  formData: FormData,
): Promise<MigrationSaveState> {
  const applicationId = text(formData, "application_id");
  if (!applicationId) return { ok: false, message: "Application reference is missing." };

  const actor = await requireScopedPospMispManager(applicationId);
  const admin = createSupabaseAdminClient();
  const [{ data: current, error: currentError }, { data: currentProfile, error: currentProfileError }] = await Promise.all([
    admin
      .from("intermediary_onboarding_applications")
      .select("id,partner_record_id,draft_data")
      .eq("id", applicationId)
      .maybeSingle<ApplicationRow>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("id,application_id,partner_record_id,raw_data")
      .eq("application_id", applicationId)
      .maybeSingle<ProfileRow>(),
  ]);
  if (currentError || !current || currentProfileError || !currentProfile) {
    return { ok: false, message: "The migration record could not be found." };
  }

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

  const currentDraft = object(current.draft_data);
  const parentApplicationId = recordText(currentDraft.parent_partner_application_id);
  const familyRootApplicationId = accountContext(current.draft_data) === "partner" ? current.id : parentApplicationId;
  const partnerRecordId = current.partner_record_id ?? currentProfile.partner_record_id;

  let applications: ApplicationRow[] = [current];

  if (partnerRecordId) {
    const { data, error } = await admin
      .from("intermediary_onboarding_applications")
      .select("id,partner_record_id,draft_data")
      .eq("partner_record_id", partnerRecordId)
      .returns<ApplicationRow[]>();
    if (error) return { ok: false, message: "Linked account records could not be loaded." };
    applications = uniqueApplications([...applications, ...(data ?? [])]);
  }

  if (familyRootApplicationId && familyRootApplicationId !== current.id) {
    const { data: parentApplication, error: parentError } = await admin
      .from("intermediary_onboarding_applications")
      .select("id,partner_record_id,draft_data")
      .eq("id", familyRootApplicationId)
      .maybeSingle<ApplicationRow>();
    if (parentError) return { ok: false, message: "The parent Partner record could not be loaded." };
    if (parentApplication) applications = uniqueApplications([...applications, parentApplication]);
  }

  const rootId = familyRootApplicationId ?? (accountContext(current.draft_data) === "partner" ? current.id : null);
  if (rootId) {
    const { data: linkedChildren, error: linkedChildrenError } = await admin
      .from("intermediary_onboarding_applications")
      .select("id,partner_record_id,draft_data")
      .contains("draft_data", { parent_partner_application_id: rootId })
      .returns<ApplicationRow[]>();
    if (linkedChildrenError) return { ok: false, message: "Linked POSP/MISP records could not be loaded." };
    applications = uniqueApplications([...applications, ...(linkedChildren ?? [])]);
  }

  const discoveredPartnerRecordIds = Array.from(
    new Set(applications.map((item) => item.partner_record_id).filter((value): value is string => Boolean(value))),
  );
  if (discoveredPartnerRecordIds.length) {
    const { data: partnerLinkedApplications, error: partnerLinkedError } = await admin
      .from("intermediary_onboarding_applications")
      .select("id,partner_record_id,draft_data")
      .in("partner_record_id", discoveredPartnerRecordIds)
      .returns<ApplicationRow[]>();
    if (partnerLinkedError) return { ok: false, message: "Linked account records could not be loaded." };
    applications = uniqueApplications([...applications, ...(partnerLinkedApplications ?? [])]);
  }

  const applicationIds = applications.map((item) => item.id);
  const { data: profiles, error: profilesError } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id,application_id,partner_record_id,raw_data")
    .in("application_id", applicationIds)
    .returns<ProfileRow[]>();
  if (profilesError) return { ok: false, message: "Linked profile records could not be loaded." };

  if (migration.legacy_partner_code) {
    const { data: duplicatePartnerProfiles, error } = await admin
      .from("posp_misp_onboarding_profiles")
      .select("application_id")
      .eq("partner_id", migration.legacy_partner_code)
      .returns<ApplicationReferenceRow[]>();
    if (error) return { ok: false, message: "The Partner ID could not be validated." };
    if ((duplicatePartnerProfiles ?? []).some((row) => !applicationIds.includes(row.application_id))) {
      return { ok: false, message: "The Existing Partner ID is already used by another account." };
    }
  }

  if (migration.legacy_registration_code) {
    const [profileReferences, intermediaryReferences, registrationReferences] = await Promise.all([
      admin
        .from("posp_misp_onboarding_profiles")
        .select("application_id")
        .eq("external_onboarding_id", migration.legacy_registration_code)
        .returns<ApplicationReferenceRow[]>(),
      admin
        .from("intermediaries")
        .select("application_id")
        .eq("intermediary_code", migration.legacy_registration_code)
        .returns<ApplicationReferenceRow[]>(),
      admin
        .from("intermediary_registrations")
        .select("application_id")
        .eq("registration_code", migration.legacy_registration_code)
        .returns<RegistrationReferenceRow[]>(),
    ]);
    if (profileReferences.error || intermediaryReferences.error || registrationReferences.error) {
      return { ok: false, message: "The POSP/MISP ID could not be validated." };
    }
    const registrationInUse = [
      ...(profileReferences.data ?? []),
      ...(intermediaryReferences.data ?? []),
      ...(registrationReferences.data ?? []).filter((row): row is { application_id: string } => Boolean(row.application_id)),
    ].some((row) => !applicationIds.includes(row.application_id));
    if (registrationInUse) {
      return { ok: false, message: "The Existing POSP/MISP ID is already used by another account." };
    }
  }

  // The draft/raw migration payload remains the editable source, while canonical IDs are kept in
  // sync so review headers, partner lists and linked-account cards always read the latest values.
  for (const app of applications) {
    const context = accountContext(app.draft_data);
    const canonicalDraft = {
      ...object(app.draft_data),
      ...migration,
      ...(context !== "partner" && migration.legacy_partner_code ? { linked_partner_code: migration.legacy_partner_code } : {}),
      ...(context !== "partner" && migration.legacy_registration_code ? { issued_registration_code: migration.legacy_registration_code } : {}),
    };
    const appUpdate: Record<string, unknown> = {
      draft_data: canonicalDraft,
      updated_at: now,
    };
    if (context !== "partner") appUpdate.registration_status = workflowRegistrationStatus;
    const { error } = await admin.from("intermediary_onboarding_applications").update(appUpdate).eq("id", app.id);
    if (error) return { ok: false, message: "Migration details could not be synchronized to every application." };
  }

  for (const profile of profiles ?? []) {
    const app = applications.find((item) => item.id === profile.application_id);
    const context = accountContext(app?.draft_data);
    const canonicalRaw = {
      ...object(profile.raw_data),
      ...migration,
      ...(context !== "partner" && migration.legacy_partner_code ? { linked_partner_code: migration.legacy_partner_code } : {}),
      ...(context !== "partner" && migration.legacy_registration_code ? { issued_registration_code: migration.legacy_registration_code } : {}),
    };
    const coreProfileUpdate: Record<string, unknown> = {
      raw_data: canonicalRaw,
      onboarding_date: originalOnboardingDate,
      updated_by: actor.id,
      updated_at: now,
    };
    if (migration.legacy_partner_code) coreProfileUpdate.partner_id = migration.legacy_partner_code;
    if (context !== "partner" && migration.legacy_registration_code) {
      coreProfileUpdate.external_onboarding_id = migration.legacy_registration_code;
      coreProfileUpdate.existing_registration_code = migration.legacy_registration_code;
    }
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

    if (migration.legacy_registration_code) {
      await admin
        .from("intermediary_registrations")
        .update({ registration_code: migration.legacy_registration_code, updated_at: now })
        .eq("application_id", app.id);
    }
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
function uniqueApplications(applications: ApplicationRow[]) {
  return Array.from(new Map(applications.map((application) => [application.id, application])).values());
}
function recordText(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function toTimestamp(value: string | null) { return value ? `${value}T00:00:00.000Z` : null; }
function text(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; }
function optionalText(data: FormData, key: string) { return text(data, key); }
function dateValue(data: FormData, key: string) { const value = text(data, key); return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
function choice(data: FormData, key: string, allowed: Set<string>, fallback: string) { const value = text(data, key); return value && allowed.has(value) ? value : fallback; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
