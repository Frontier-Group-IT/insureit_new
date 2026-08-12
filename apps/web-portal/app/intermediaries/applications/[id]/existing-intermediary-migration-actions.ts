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
  partner_type: string | null;
  raw_data: Record<string, unknown> | null;
};
type MigrationSyncResult = {
  application_ids?: unknown;
};

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
      .select("id,application_id,partner_record_id,partner_type,raw_data")
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
  const currentContext = accountContext(current.draft_data);
  const parentApplicationId = recordText(currentDraft.parent_partner_application_id);
  const familyRootApplicationId = currentContext === "partner" ? current.id : parentApplicationId;
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

  const rootId = familyRootApplicationId ?? (currentContext === "partner" ? current.id : null);
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

  const { data: syncResult, error: syncError } = await admin.rpc("sync_existing_intermediary_migration", {
    p_application_id: applicationId,
    p_actor_id: actor.id,
    p_migration: migration,
    p_registration_status: workflowRegistrationStatus,
  });
  if (syncError) return { ok: false, message: migrationSyncMessage(syncError) };

  const result = asMigrationSyncResult(syncResult);
  const syncedIds = Array.isArray(result.application_ids)
    ? result.application_ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const applicationIds = uniqueStrings([...syncedIds, ...applications.map((item) => item.id)]);

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

function migrationSyncMessage(error: unknown) {
  const message = errorMessage(error);
  if (message.includes("already used")) return message;
  if (message.includes("Partner ID and POSP/MISP ID")) return message;
  if (message.includes("PENDING")) return message;
  if (message.includes("Activation date")) return message;
  if (message.includes("not linked to a Partner record")) return "Activate or link the Partner record before editing migration details.";
  return "Migration details could not be synchronized. No partial changes were saved.";
}
function accountContext(draft: Record<string, unknown> | null | undefined) {
  const context = draft?.account_context;
  return context === "posp" || context === "misp" ? context : "partner";
}
function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message;
  return "Unknown database error";
}
function asMigrationSyncResult(value: unknown): MigrationSyncResult {
  return value && typeof value === "object" && !Array.isArray(value) ? value as MigrationSyncResult : {};
}
function uniqueApplications(applications: ApplicationRow[]) {
  return Array.from(new Map(applications.map((application) => [application.id, application])).values());
}
function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}
function recordText(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function text(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; }
function optionalText(data: FormData, key: string) { return text(data, key); }
function dateValue(data: FormData, key: string) { const value = text(data, key); return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
function choice(data: FormData, key: string, allowed: Set<string>, fallback: string) { const value = text(data, key); return value && allowed.has(value) ? value : fallback; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
