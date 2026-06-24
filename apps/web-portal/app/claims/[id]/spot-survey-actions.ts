"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";

const bucketName = "claim-documents";

export async function verifySpotSurveyDocument(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const claimId = String(formData.get("claimId") ?? "").trim();
  if (!documentId || !claimId) return;

  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id) return;

  const supabase = await createServerSupabaseClient();
  await supabase
    .from("claim_documents")
    .update({ verification_status: "verified", verified_by: profile.id, verified_at: new Date().toISOString(), rejection_reason: null })
    .eq("id", documentId)
    .eq("claim_id", claimId);

  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/dashboard");
}

export async function verifySpotSurveyDetail(formData: FormData) {
  const claimId = String(formData.get("claimId") ?? "").trim();
  const detailKey = String(formData.get("detailKey") ?? "").trim();
  const detailLabel = String(formData.get("detailLabel") ?? "").trim();
  const detailValue = String(formData.get("detailValue") ?? "").trim();
  if (!claimId || !detailKey) return;

  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id) return;

  const supabase = await createServerSupabaseClient();
  await supabase.from("claim_stage_details").insert({
    claim_id: claimId,
    stage: "Vehicle Inspected",
    details: {
      spot_survey_detail_key: detailKey,
      label: detailLabel,
      value: detailValue,
      verified: true,
      verified_at: new Date().toISOString()
    },
    created_by: profile.id
  });

  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/dashboard");
}

export async function replaceSpotSurveyDocument(formData: FormData) {
  const claimId = String(formData.get("claimId") ?? "").trim();
  const documentType = String(formData.get("documentType") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "").trim();
  const file = formData.get("file");

  if (!claimId || !documentType || !customerId || !(file instanceof File) || !file.size) return;

  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id) return;

  const supabase = await createServerSupabaseClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${claimId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (uploadError) return;

  await supabase.from("claim_documents").insert({
    claim_id: claimId,
    customer_id: customerId,
    document_type: documentType,
    file_name: file.name,
    storage_bucket: bucketName,
    storage_path: storagePath,
    mime_type: file.type || null,
    file_size: file.size,
    uploaded_by: profile.id
  });

  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/dashboard");
}
