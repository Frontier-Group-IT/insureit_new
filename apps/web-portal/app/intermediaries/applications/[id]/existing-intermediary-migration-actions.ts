"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedTraining = new Set(["not_assigned", "assigned", "in_progress", "completed", "unknown"]);
const allowedExam = new Set(["not_allotted", "allotted", "in_progress", "passed", "failed", "unknown"]);
const allowedAgreement = new Set(["not_started", "sent", "opened", "signed", "unknown"]);
const allowedIibUpload = new Set(["pending", "uploaded", "unknown"]);
const allowedIibRegistration = new Set(["pending", "submitted", "registered", "unknown"]);

export async function updateExistingIntermediaryMigrationDetails(formData: FormData) {
  const applicationId = text(formData, "application_id");
  if (!applicationId) redirect("/intermediaries");

  const actor = await requireScopedPospMispManager(applicationId);
  const admin = createSupabaseAdminClient();
  const [{ data: application }, { data: profile }] = await Promise.all([
    admin
      .from("intermediary_onboarding_applications")
      .select("id,draft_data")
      .eq("id", applicationId)
      .maybeSingle<{ id: string; draft_data: Record<string, unknown> | null }>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("id,partner_type,raw_data")
      .eq("application_id", applicationId)
      .maybeSingle<{ id: string; partner_type: "posp" | "misp"; raw_data: Record<string, unknown> | null }>(),
  ]);

  if (!application || !profile) redirectFresh(applicationId, "migration_details_not_found");
  const context = object(application.draft_data).account_context;
  if (context === "posp" || context === "misp") redirectFresh(applicationId, "migration_details_partner_only");

  const originalOnboardingDate = dateValue(formData, "legacy_original_onboarding_date");
  const originalActivationDate = dateValue(formData, "legacy_original_activation_date");
  if (originalOnboardingDate && originalActivationDate && originalActivationDate < originalOnboardingDate) {
    redirectFresh(applicationId, "migration_activation_before_onboarding");
  }

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
    legacy_migration_updated_at: new Date().toISOString(),
    legacy_migration_updated_by: actor.id,
  };

  const now = new Date().toISOString();
  const draftData = { ...object(application.draft_data), ...migration };
  const rawData = { ...object(profile.raw_data), ...migration };

  const [{ error: appError }, { error: profileError }] = await Promise.all([
    admin
      .from("intermediary_onboarding_applications")
      .update({ draft_data: draftData, updated_at: now })
      .eq("id", applicationId),
    admin
      .from("posp_misp_onboarding_profiles")
      .update({
        raw_data: rawData,
        record_source: "legacy_manual",
        existing_registration_code: migration.legacy_registration_code,
        existing_registration_confirmed: Boolean(migration.legacy_registration_code),
        existing_registration_confirmed_at: migration.legacy_registration_code ? now : null,
        onboarding_date: originalOnboardingDate,
        updated_by: actor.id,
        updated_at: now,
      })
      .eq("id", profile.id),
  ]);

  if (appError || profileError) redirectFresh(applicationId, "migration_details_save_failed");

  revalidatePath(`/intermediaries/applications/${applicationId}`);
  revalidatePath(`/intermediaries/applications/${applicationId}/workflow`);
  revalidatePath("/intermediaries");
  redirect(`/intermediaries/applications/${applicationId}/workflow?stage=primary&success=migration_details_saved&fresh=${Date.now()}`);
}

function text(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function optionalText(data: FormData, key: string) {
  return text(data, key);
}
function dateValue(data: FormData, key: string) {
  const value = text(data, key);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
function choice(data: FormData, key: string, allowed: Set<string>, fallback: string) {
  const value = text(data, key);
  return value && allowed.has(value) ? value : fallback;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function redirectFresh(applicationId: string, error: string): never {
  redirect(`/intermediaries/applications/${applicationId}/workflow?stage=primary&error=${error}&fresh=${Date.now()}`);
}
