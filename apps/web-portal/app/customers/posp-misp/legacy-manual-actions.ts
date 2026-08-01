"use server";

import { createManualPospMispOnboardingV2 } from "./manual-actions-v2";
import type { PospMispState } from "./actions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CreateState = PospMispState & { applicationId?: string | null };

export async function createLegacyPartnerOnboarding(state: CreateState, data: FormData): Promise<CreateState> {
  const partnerCode = code(data, "legacy_partner_code");
  const registrationCode = code(data, "legacy_registration_code");
  const remarks = text(data, "legacy_migration_remarks");
  const originalOnboardingDate = text(data, "legacy_original_onboarding_date");
  const originalActivationDate = text(data, "legacy_original_activation_date");
  const confirmed = data.get("legacy_confirmation") === "yes";

  if (!partnerCode) return { error: "Existing Partner ID is required.", field: "legacy_partner_code", applicationId: null };
  if (!registrationCode) return { error: "Existing POSP/MISP ID is required.", field: "legacy_registration_code", applicationId: null };
  if (partnerCode.startsWith("PENDING-") || registrationCode.startsWith("PENDING-")) return { error: "Temporary PENDING identifiers cannot be used.", field: "legacy_partner_code", applicationId: null };
  if (partnerCode === registrationCode) return { error: "Partner ID and POSP/MISP ID must be different.", field: "legacy_registration_code", applicationId: null };
  if (!originalOnboardingDate || !originalActivationDate) return { error: "Original onboarding and activation dates are required.", field: "legacy_original_onboarding_date", applicationId: null };
  if (!remarks || remarks.length < 10) return { error: "Enter a clear migration verification remark.", field: "legacy_migration_remarks", applicationId: null };
  if (!confirmed) return { error: "Confirm that the historical identifiers and records were verified.", field: "legacy_confirmation", applicationId: null };

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
  const { data: application } = await admin.from("intermediary_onboarding_applications").select("draft_data").eq("id", result.applicationId).maybeSingle<{draft_data:Record<string,unknown>|null}>();
  const draft = application?.draft_data && typeof application.draft_data === "object" ? application.draft_data : {};
  const legacy = {
    account_context: "partner",
    onboarding_mode: "legacy_existing_partner",
    record_source: "legacy_manual_pending_activation",
    legacy_partner_code: partnerCode,
    legacy_registration_code: registrationCode,
    legacy_original_onboarding_date: originalOnboardingDate,
    legacy_original_activation_date: originalActivationDate,
    legacy_migration_remarks: remarks,
    legacy_ids_verified_at: now,
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
      raw_data: { ...legacy },
      updated_at: now,
    }).eq("application_id", result.applicationId),
  ]);

  if (appError || profileError) {
    await admin.from("intermediary_onboarding_documents").delete().eq("application_id", result.applicationId);
    await admin.from("intermediary_onboarding_contacts").delete().eq("application_id", result.applicationId);
    await admin.from("posp_misp_onboarding_profiles").delete().eq("application_id", result.applicationId);
    await admin.from("intermediary_onboarding_applications").delete().eq("id", result.applicationId);
    return { error: "The legacy identifiers could not be reserved. No application was retained.", field: "legacy_partner_code", applicationId: null };
  }

  return result;
}

function text(data: FormData, key: string) { const value = data.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; }
function code(data: FormData, key: string) { return text(data, key)?.replace(/\s+/g, " ").toUpperCase() ?? null; }
