"use server";

import { createManualPospMispOnboardingV2 } from "./manual-actions-v2";
import type { PospMispState } from "./actions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  isLegacyAgreementStatus,
  isLegacyExamStatus,
  isLegacyIibRegistrationStatus,
  isLegacyIibUploadStatus,
  isLegacyTrainingStatus,
} from "./legacy-workflow-statuses";

type CreateState = PospMispState & { applicationId?: string | null };

const ACTIVATION_DATE_ERROR = "Activation date cannot be earlier than onboarding date.";

export async function createLegacyPartnerOnboarding(state: CreateState, data: FormData): Promise<CreateState> {
  const partnerCode = code(data, "legacy_partner_code");
  const registrationCode = code(data, "legacy_registration_code");
  const originalOnboardingDate = text(data, "legacy_original_onboarding_date");
  const originalActivationDate = text(data, "legacy_original_activation_date");
  const trainingStatus = text(data, "legacy_training_status");
  const examStatus = text(data, "legacy_exam_status");
  const agreementStatus = text(data, "legacy_agreement_status");
  const iibUploadStatus = text(data, "legacy_iib_upload_status");
  const iibRegistrationStatus = text(data, "legacy_iib_registration_status");
  const confirmed = data.get("legacy_confirmation") === "yes";

  if (!partnerCode) return { error: "Existing Partner ID is required.", field: "legacy_partner_code", applicationId: null };
  if (!registrationCode) return { error: "Existing POSP/MISP ID is required.", field: "legacy_registration_code", applicationId: null };
  if (partnerCode.startsWith("PENDING-") || registrationCode.startsWith("PENDING-")) return { error: "Temporary PENDING identifiers cannot be used.", field: "legacy_partner_code", applicationId: null };
  if (partnerCode === registrationCode) return { error: "Partner ID and POSP/MISP ID must be different.", field: "legacy_registration_code", applicationId: null };
  if (!originalOnboardingDate || !originalActivationDate) return { error: "Original onboarding and association dates are required.", field: "legacy_original_onboarding_date", applicationId: null };
  if (originalActivationDate < originalOnboardingDate) return { error: ACTIVATION_DATE_ERROR, field: "legacy_original_activation_date", applicationId: null };
  if (!isLegacyTrainingStatus(trainingStatus)) return { error: "Select a valid Training status.", field: "legacy_training_status", applicationId: null };
  if (!isLegacyExamStatus(examStatus)) return { error: "Select a valid Exam status.", field: "legacy_exam_status", applicationId: null };
  if (!isLegacyAgreementStatus(agreementStatus)) return { error: "Select a valid Agreement status.", field: "legacy_agreement_status", applicationId: null };
  if (!isLegacyIibUploadStatus(iibUploadStatus)) return { error: "Select a valid IIB upload status.", field: "legacy_iib_upload_status", applicationId: null };
  if (!isLegacyIibRegistrationStatus(iibRegistrationStatus)) return { error: "Select a valid IIB registration status.", field: "legacy_iib_registration_status", applicationId: null };
  if (!confirmed) return { error: "Confirm that the historical identifiers and workflow statuses were verified.", field: "legacy_confirmation", applicationId: null };

  const admin = createSupabaseAdminClient();
  const duplicateResults = await Promise.all([
    admin.from("partners").select("id").eq("partner_code", partnerCode).limit(1),
    admin.from("intermediaries").select("id").eq("intermediary_code", partnerCode).limit(1),
    admin.from("intermediary_registrations").select("id").eq("registration_code", registrationCode).limit(1),
    admin.from("intermediaries").select("id").eq("intermediary_code", registrationCode).limit(1),
    admin.from("posp_misp_onboarding_profiles").select("application_id").eq("external_onboarding_id", registrationCode).limit(1),
    admin.from("posp_misp_onboarding_profiles").select("application_id").eq("partner_id", partnerCode).limit(1),
  ]);
  if (duplicateResults.some((result) => (result.data?.length ?? 0) > 0)) {
    return { error: "The entered Partner or POSP/MISP ID is already used by another record.", field: "legacy_partner_code", applicationId: null };
  }

  const result = await createManualPospMispOnboardingV2(state, data);
  if (result.error || !result.applicationId) return result;

  const now = new Date().toISOString();
  const [{ data: application }, { data: profile }] = await Promise.all([
    admin.from("intermediary_onboarding_applications").select("draft_data").eq("id", result.applicationId).maybeSingle<{draft_data:Record<string,unknown>|null}>(),
    admin.from("posp_misp_onboarding_profiles").select("raw_data").eq("application_id", result.applicationId).maybeSingle<{raw_data:Record<string,unknown>|null}>(),
  ]);
  const draft = asObject(application?.draft_data);
  const rawData = asObject(profile?.raw_data);
  const legacy = {
    account_context: "partner",
    onboarding_mode: "legacy_existing_partner",
    record_source: "legacy_manual_pending_activation",
    legacy_partner_code: partnerCode,
    legacy_registration_code: registrationCode,
    legacy_original_onboarding_date: originalOnboardingDate,
    legacy_original_activation_date: originalActivationDate,
    legacy_training_status: trainingStatus,
    legacy_exam_status: examStatus,
    legacy_agreement_status: agreementStatus,
    legacy_iib_upload_status: iibUploadStatus,
    legacy_iib_registration_status: iibRegistrationStatus,
    legacy_ids_verified_at: now,
    legacy_workflow_verified_at: now,
  };

  const [{ error: appError }, { error: profileError }] = await Promise.all([
    admin.from("intermediary_onboarding_applications").update({ draft_data: { ...draft, ...legacy }, updated_at: now }).eq("id", result.applicationId),
    admin.from("posp_misp_onboarding_profiles").update({
      partner_id: partnerCode,
      external_onboarding_id: registrationCode,
      record_source: "legacy_manual_pending_activation",
      existing_registration_confirmed: true,
      existing_registration_code: registrationCode,
      existing_registration_confirmed_at: now,
      onboarding_date: originalOnboardingDate,
      raw_data: { ...rawData, ...legacy },
      updated_at: now,
    }).eq("application_id", result.applicationId),
  ]);

  if (appError || profileError) {
    await admin.from("intermediary_onboarding_documents").delete().eq("application_id", result.applicationId);
    await admin.from("intermediary_onboarding_contacts").delete().eq("application_id", result.applicationId);
    await admin.from("posp_misp_onboarding_profiles").delete().eq("application_id", result.applicationId);
    await admin.from("intermediary_onboarding_applications").delete().eq("id", result.applicationId);
    return { error: "The legacy identifiers and workflow statuses could not be reserved. No application was retained.", field: "legacy_partner_code", applicationId: null };
  }

  return result;
}

function text(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; }
function code(data: FormData, key: string) { return text(data, key)?.replace(/\s+/g, " ").toUpperCase() ?? null; }
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
