"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const IIB_REMARKS = new Set(["Matching Record Found In DataBase", "No Data Found In POS System"]);
const TRAINING_STATUSES = new Set(["completed", "pending"]);
const ALLOWED_FILE_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function movePospMispToIib(data: FormData) {
  const { actorId, applicationId, admin } = await context(data);
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id, bank_id, workflow_stage")
    .eq("application_id", applicationId)
    .maybeSingle<{ id: string; bank_id: string | null; workflow_stage: string }>();
  if (!profile?.id || !profile.bank_id) redirectTo(applicationId, "pre_iib_incomplete");
  if (profile.workflow_stage !== "pre_iib") redirectTo(applicationId, "stage_locked");

  const { data: updated, error } = await admin
    .from("posp_misp_onboarding_profiles")
    .update({ workflow_stage: "iib_processing", pre_iib_submitted_at: new Date().toISOString(), updated_by: actorId })
    .eq("id", profile.id)
    .eq("workflow_stage", "pre_iib")
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !updated) redirectTo(applicationId, "workflow_save_failed");
  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=iib_started`);
}

export async function savePospMispIibOutcome(data: FormData) {
  const { actorId, applicationId, admin } = await context(data);
  const remarks = value(data, "iib_remarks");
  const uploaded = data.get("iib_uploaded") === "true";
  const uploadedAt = value(data, "iib_uploaded_at");
  if (!remarks || !IIB_REMARKS.has(remarks)) redirectTo(applicationId, "iib_remarks_required");
  if (!uploaded || !uploadedAt) redirectTo(applicationId, "iib_upload_required");

  const { data: updated, error } = await admin
    .from("posp_misp_onboarding_profiles")
    .update({
      iib_remarks: remarks,
      iib_uploaded: true,
      iib_upload_status: "uploaded",
      iib_uploaded_at: uploadedAt,
      workflow_stage: "training",
      iib_completed_at: new Date().toISOString(),
      updated_by: actorId
    })
    .eq("application_id", applicationId)
    .eq("workflow_stage", "iib_processing")
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !updated) redirectTo(applicationId, "workflow_save_failed");
  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=iib_completed`);
}

export async function completePospMispTraining(data: FormData) {
  const { actorId, applicationId, admin } = await context(data);
  const loginId = value(data, "training_login_id");
  const password = value(data, "training_password");
  const startDate = value(data, "training_start_date");
  const endDate = value(data, "training_end_date");
  const trainingStatus = value(data, "training_status");
  const certificateNumber = value(data, "training_certificate_number");
  const examStatus = value(data, "exam_status");
  const onboardingDate = value(data, "onboarding_date");
  const credentialsShared = data.get("training_credentials_shared_flag") === "true";
  if (!loginId || !password || !startDate || !endDate || !trainingStatus || !examStatus || !onboardingDate) {
    redirectTo(applicationId, "training_incomplete");
  }
  if (!TRAINING_STATUSES.has(trainingStatus)) redirectTo(applicationId, "training_incomplete");
  if (endDate < startDate) redirectTo(applicationId, "training_dates_invalid");
  if (!credentialsShared) redirectTo(applicationId, "credentials_required");

  const agreement = file(data, "agreement_copy");
  const { data: existingAgreement } = await admin
    .from("customer_onboarding_documents")
    .select("id")
    .eq("application_id", applicationId)
    .eq("document_type", "agreement_copy")
    .maybeSingle<{ id: string }>();
  if (!agreement && !existingAgreement) redirectTo(applicationId, "agreement_required");
  if (agreement) {
    if (!ALLOWED_FILE_TYPES.has(agreement.type) || agreement.size > MAX_FILE_SIZE) {
      redirectTo(applicationId, "agreement_invalid");
    }
    const extension = agreement.type === "application/pdf" ? "pdf" : agreement.type === "image/png" ? "png" : "jpg";
    const path = `${applicationId}/posp-misp/agreement_copy/${randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage
      .from("customer-documents")
      .upload(path, new Uint8Array(await agreement.arrayBuffer()), { contentType: agreement.type, upsert: false });
    if (uploadError) redirectTo(applicationId, "agreement_upload_failed");
    const { error: documentError } = await admin.from("customer_onboarding_documents").upsert({
      application_id: applicationId,
      document_type: "agreement_copy",
      file_name: agreement.name,
      storage_bucket: "customer-documents",
      storage_path: path,
      mime_type: agreement.type,
      file_size: agreement.size,
      verification_status: "pending",
      uploaded_by: actorId
    }, { onConflict: "application_id,document_type" });
    if (documentError) {
      await admin.storage.from("customer-documents").remove([path]);
      redirectTo(applicationId, "agreement_upload_failed");
    }
  }

  const { data: updated, error } = await admin
    .from("posp_misp_onboarding_profiles")
    .update({
      training_login_id: loginId,
      training_password: password,
      training_credentials_shared: credentialsShared ? "yes" : "no",
      training_credentials_shared_flag: credentialsShared,
      training_start_date: startDate,
      training_end_date: endDate,
      training_status: trainingStatus,
      training_certificate_number: certificateNumber,
      exam_status: examStatus,
      onboarding_date: onboardingDate,
      workflow_stage: "completed",
      training_completed_at: new Date().toISOString(),
      updated_by: actorId
    })
    .eq("application_id", applicationId)
    .eq("workflow_stage", "training")
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error || !updated) redirectTo(applicationId, "workflow_save_failed");
  revalidatePath(`/customers/applications/${applicationId}`);
  redirect(`/customers/applications/${applicationId}?success=training_completed`);
}

async function context(data: FormData) {
  const applicationId = value(data, "application_id");
  if (!applicationId) redirect("/customers/applications");
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !canManageMasterData(profile.role)) redirect("/access-denied");
  return { actorId: profile.id, applicationId, admin: createSupabaseAdminClient() };
}

function value(data: FormData, key: string) {
  const current = data.get(key);
  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function file(data: FormData, key: string) {
  const current = data.get(key);
  return current instanceof File && current.size > 0 ? current : null;
}

function redirectTo(applicationId: string, error: string): never {
  redirect(`/customers/applications/${applicationId}?error=${error}`);
}
