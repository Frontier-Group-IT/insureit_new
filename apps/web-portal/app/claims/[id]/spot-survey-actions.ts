"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import type { ClaimStatus } from "@/lib/claim-workflow";
import { canVerifyClaimDocuments } from "@/lib/roles";

const bucketName = "claim-documents";

type ClaimForVerification = {
  id: string;
  customer_id: string;
  current_status: ClaimStatus;
};

type ActionResult = { ok: boolean; message?: string };

async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!canVerifyClaimDocuments(profile?.role)) {
    throw new Error("You do not have permission to verify claim documents.");
  }
  return profile;
}

async function loadClaim(claimId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claims")
    .select("id, customer_id, current_status")
    .eq("id", claimId)
    .maybeSingle<ClaimForVerification>();

  if (error || !data) throw new Error(error?.message ?? "Claim not found.");
  return data;
}

export async function verifySpotSurveyDocument(formData: FormData): Promise<ActionResult> {
  try {
    const documentId = String(formData.get("documentId") ?? "").trim();
    const claimId = String(formData.get("claimId") ?? "").trim();
    if (!documentId || !claimId) throw new Error("Missing claim or document id.");

    const profile = await currentProfile();
    const claim = await loadClaim(claimId);
    const supabase = await createServerSupabaseClient();

    const { data: document, error: documentError } = await supabase
      .from("claim_documents")
      .select("id, claim_id, document_type, verification_status")
      .eq("id", documentId)
      .eq("claim_id", claimId)
      .maybeSingle<{ id: string; claim_id: string; document_type: string; verification_status: string }>();

    if (documentError || !document) throw new Error(documentError?.message ?? "Document not found.");

    const { error: reviewError } = await supabase
      .from("claim_documents")
      .update({
        verification_status: "verified",
        verified_by: profile?.id ?? null,
        verified_at: new Date().toISOString(),
        rejection_reason: null
      })
      .eq("id", documentId)
      .eq("claim_id", claimId);

    if (reviewError) throw new Error(reviewError.message);

    await supabase.from("claim_stage_details").insert({
      claim_id: claimId,
      stage: claim.current_status,
      details: {
        verification_type: "spot_survey_document",
        document_type: document.document_type,
        document_id: document.id,
        verified: true,
        verified_at: new Date().toISOString()
      },
      created_by: profile?.id ?? null
    });

    await supabase.from("claim_status_history").insert({
      claim_id: claimId,
      from_status: claim.current_status,
      to_status: claim.current_status,
      notes: `${document.document_type} verified during spot survey.`,
      changed_by: profile?.id ?? null
    });

    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("verifySpotSurveyDocument failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Verification failed." };
  }
}

export async function verifySpotSurveyDetail(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = String(formData.get("claimId") ?? "").trim();
    const detailKey = String(formData.get("detailKey") ?? "").trim();
    const detailLabel = String(formData.get("detailLabel") ?? "").trim();
    const detailValue = String(formData.get("detailValue") ?? "").trim();
    if (!claimId || !detailKey) throw new Error("Missing claim or detail id.");

    const profile = await currentProfile();
    const claim = await loadClaim(claimId);
    const supabase = await createServerSupabaseClient();

    const { error: detailError } = await supabase.from("claim_stage_details").insert({
      claim_id: claimId,
      stage: claim.current_status,
      details: {
        verification_type: "spot_survey_detail",
        spot_survey_detail_key: detailKey,
        label: detailLabel,
        value: detailValue,
        verified: true,
        verified_at: new Date().toISOString()
      },
      created_by: profile?.id ?? null
    });

    if (detailError) throw new Error(detailError.message);

    await supabase.from("claim_status_history").insert({
      claim_id: claimId,
      from_status: claim.current_status,
      to_status: claim.current_status,
      notes: `${detailLabel || detailKey} verified during spot survey.`,
      changed_by: profile?.id ?? null
    });

    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("verifySpotSurveyDetail failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Detail verification failed." };
  }
}

export async function replaceSpotSurveyDocument(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = String(formData.get("claimId") ?? "").trim();
    const documentType = String(formData.get("documentType") ?? "").trim();
    const customerId = String(formData.get("customerId") ?? "").trim();
    const file = formData.get("file");

    if (!claimId || !documentType || !customerId || !(file instanceof File) || !file.size) {
      throw new Error("Missing replacement document details.");
    }

    const profile = await currentProfile();
    await loadClaim(claimId);
    const supabase = await createServerSupabaseClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${claimId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });

    if (uploadError) throw new Error(uploadError.message);

    const { error: insertError } = await supabase.from("claim_documents").insert({
      claim_id: claimId,
      customer_id: customerId,
      document_type: documentType,
      file_name: file.name,
      storage_bucket: bucketName,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_by: profile?.id ?? null
    });

    if (insertError) throw new Error(insertError.message);

    revalidatePath(`/claims/${claimId}`);
    revalidatePath("/claims");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("replaceSpotSurveyDocument failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Replacement upload failed." };
  }
}
