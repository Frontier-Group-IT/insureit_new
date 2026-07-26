"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManagePospMispOnboarding } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export async function queuePospMispPanVerification(data: FormData) {
  const { actorId, applicationId, admin } = await context(data);
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id, partner_type, pan_number, workflow_stage")
    .eq("application_id", applicationId)
    .maybeSingle<{ id: string; partner_type: "posp" | "misp"; pan_number: string | null; workflow_stage: string }>();

  const panNumber = profile?.pan_number?.trim().toUpperCase() ?? "";
  if (!profile?.id || !PAN_PATTERN.test(panNumber)) redirectTo(applicationId, "pan_verification_invalid");
  if (profile.workflow_stage !== "pre_iib") redirectTo(applicationId, "stage_locked");

  const { error } = await admin.from("pan_verification_jobs").upsert({
    application_id: applicationId,
    onboarding_profile_id: profile.id,
    partner_type: profile.partner_type,
    pan_number: panNumber,
    status: "pending",
    result_code: null,
    result_message: null,
    requested_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    last_error: null,
    checked_by_device: null,
    requested_by: actorId,
    override_reason: null,
    overridden_by: null,
    overridden_at: null,
    updated_at: new Date().toISOString()
  }, { onConflict: "application_id" });

  if (error) redirectTo(applicationId, "pan_verification_queue_failed");
  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=pan_verification_queued`);
}

export async function retryPospMispPanVerification(data: FormData) {
  const { actorId, applicationId, admin } = await context(data);
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id, partner_type, pan_number")
    .eq("application_id", applicationId)
    .maybeSingle<{ id: string; partner_type: "posp" | "misp"; pan_number: string | null }>();

  const panNumber = profile?.pan_number?.trim().toUpperCase() ?? "";
  if (!profile?.id || !PAN_PATTERN.test(panNumber)) redirectTo(applicationId, "pan_verification_invalid");

  const now = new Date().toISOString();
  const { error: profileError } = await admin
    .from("posp_misp_onboarding_profiles")
    .update({
      iib_remarks: null,
      iib_upload_status: "pending",
      iib_uploaded: false,
      iib_uploaded_at: null,
      iib_completed_at: null,
      requested_account_type: profile.partner_type,
      final_account_type: null,
      partner_decision: "pending",
      partner_decision_at: null,
      partner_decision_by: null,
      partner_decision_remark: null,
      workflow_stage: "pre_iib",
      updated_by: actorId,
      updated_at: now
    })
    .eq("id", profile.id);
  if (profileError) redirectTo(applicationId, "pan_verification_reset_failed");

  const { error: jobError } = await admin.from("pan_verification_jobs").upsert({
    application_id: applicationId,
    onboarding_profile_id: profile.id,
    partner_type: profile.partner_type,
    pan_number: panNumber,
    status: "pending",
    result_code: null,
    result_message: null,
    requested_at: now,
    started_at: null,
    completed_at: null,
    attempt_count: 0,
    last_error: null,
    checked_by_device: null,
    requested_by: actorId,
    override_reason: null,
    overridden_by: null,
    overridden_at: null,
    updated_at: now
  }, { onConflict: "application_id" });
  if (jobError) redirectTo(applicationId, "pan_verification_queue_failed");

  await admin
    .from("customer_onboarding_applications")
    .update({ status: "submitted", updated_at: now })
    .eq("id", applicationId)
    .eq("status", "rejected");

  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=pan_verification_requeued`);
}

export async function decidePospMispPartnerRoute(data: FormData) {
  const { actorId, applicationId, admin } = await context(data);
  const decision = value(data, "partner_decision");
  const remark = value(data, "partner_decision_remark");
  if (!decision || !["convert_to_partner", "do_not_proceed"].includes(decision)) redirectTo(applicationId, "partner_decision_required");

  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id, workflow_stage, iib_remarks, partner_decision")
    .eq("application_id", applicationId)
    .maybeSingle<{ id: string; workflow_stage: string; iib_remarks: string | null; partner_decision: string }>();

  if (!profile?.id || profile.workflow_stage !== "pre_iib") redirectTo(applicationId, "stage_locked");
  if (profile.iib_remarks !== "Matching Record Found In DataBase") redirectTo(applicationId, "partner_decision_not_available");

  const now = new Date().toISOString();
  const { error } = await admin
    .from("posp_misp_onboarding_profiles")
    .update({
      partner_decision: decision,
      final_account_type: decision === "convert_to_partner" ? "partner" : null,
      partner_decision_at: now,
      partner_decision_by: actorId,
      partner_decision_remark: remark,
      updated_by: actorId,
      updated_at: now
    })
    .eq("id", profile.id);

  if (error) redirectTo(applicationId, "partner_decision_failed");

  if (decision === "do_not_proceed") {
    await admin.from("customer_onboarding_applications").update({ status: "rejected", updated_at: now }).eq("id", applicationId);
  }

  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=${decision === "convert_to_partner" ? "partner_route_selected" : "application_closed"}`);
}

export async function movePospMispToIib(data: FormData) {
  const { actorId, applicationId, admin } = await context(data);
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id, bank_id, workflow_stage, iib_remarks, final_account_type, partner_decision, partner_type")
    .eq("application_id", applicationId)
    .maybeSingle<{ id: string; bank_id: string | null; workflow_stage: string; iib_remarks: string | null; final_account_type: string | null; partner_decision: string; partner_type: "posp" | "misp" }>();

  if (!profile?.id || !profile.bank_id) redirectTo(applicationId, "pre_iib_incomplete");
  if (profile.workflow_stage !== "pre_iib") redirectTo(applicationId, "stage_locked");

  const normalRoute = profile.iib_remarks === "No Data Found In POS System";
  const partnerRoute = profile.iib_remarks === "Matching Record Found In DataBase" && profile.partner_decision === "convert_to_partner" && profile.final_account_type === "partner";
  if (!normalRoute && !partnerRoute) redirectTo(applicationId, profile.iib_remarks === "Matching Record Found In DataBase" ? "partner_decision_required" : "pan_verification_required");

  const now = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("posp_misp_onboarding_profiles")
    .update({
      workflow_stage: "iib_processing",
      requested_account_type: profile.partner_type,
      final_account_type: partnerRoute ? "partner" : profile.partner_type,
      pre_iib_submitted_at: now,
      updated_by: actorId,
      updated_at: now
    })
    .eq("id", profile.id)
    .eq("workflow_stage", "pre_iib")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !updated) redirectTo(applicationId, "workflow_save_failed");
  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=documents_started`);
}

export async function completePospMispDocumentStage(data: FormData) {
  const { actorId, applicationId, admin } = await context(data);
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id, workflow_stage")
    .eq("application_id", applicationId)
    .maybeSingle<{ id: string; workflow_stage: string }>();
  if (!profile?.id || profile.workflow_stage !== "iib_processing") redirectTo(applicationId, "stage_locked");

  const { count } = await admin
    .from("customer_onboarding_documents")
    .select("id", { count: "exact", head: true })
    .eq("application_id", applicationId);
  if (!count) redirectTo(applicationId, "documents_incomplete");

  const { error } = await admin
    .from("posp_misp_onboarding_profiles")
    .update({ workflow_stage: "training", updated_by: actorId, updated_at: new Date().toISOString() })
    .eq("id", profile.id);
  if (error) redirectTo(applicationId, "workflow_save_failed");
  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=documents_completed`);
}

export async function markPospMispReadyForOnboarding(data: FormData) {
  const { actorId, applicationId, admin } = await context(data);
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id, workflow_stage")
    .eq("application_id", applicationId)
    .maybeSingle<{ id: string; workflow_stage: string }>();
  if (!profile?.id || profile.workflow_stage !== "training") redirectTo(applicationId, "stage_locked");

  const { error } = await admin
    .from("posp_misp_onboarding_profiles")
    .update({ workflow_stage: "completed", updated_by: actorId, updated_at: new Date().toISOString() })
    .eq("id", profile.id);
  if (error) redirectTo(applicationId, "workflow_save_failed");
  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=ready_for_onboarding`);
}

async function context(data: FormData) {
  const applicationId = value(data, "application_id");
  if (!applicationId) redirect("/customers/applications");
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManagePospMispOnboarding(profile.role)) redirect("/access-denied");
  return { actorId: profile.id, applicationId, admin: createSupabaseAdminClient() };
}

function value(data: FormData, key: string) {
  const current = data.get(key);
  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function redirectTo(applicationId: string, error: string): never {
  redirect(`/customers/applications/${applicationId}?error=${error}`);
}
