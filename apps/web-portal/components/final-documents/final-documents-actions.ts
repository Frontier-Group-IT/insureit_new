"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canVerifyClaimDocuments } from "@/lib/roles";

const bucketName = "claim-documents";
type ActionResult = { ok: boolean; message?: string };
type ClaimRow = { id: string; customer_id: string | null; current_status: string | null };

async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!canVerifyClaimDocuments(profile?.role)) throw new Error("You do not have permission to update final documents.");
  return profile;
}

async function loadClaim(claimId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("claims").select("id, customer_id, current_status").eq("id", claimId).maybeSingle<ClaimRow>();
  if (error || !data) throw new Error(error?.message ?? "Claim not found.");
  return data;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function saveFinalDealershipDetails(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = clean(formData.get("claimId"));
    if (!claimId) throw new Error("Missing claim id.");
    const profile = await currentProfile();
    const claim = await loadClaim(claimId);
    const details = {
      verification_type: "final_documents_dealership_details",
      dealership_name: clean(formData.get("dealership_name")),
      dealership_address: clean(formData.get("dealership_address")),
      contact_person_name: clean(formData.get("contact_person_name")),
      contact_number: clean(formData.get("contact_number")),
      saved_at: new Date().toISOString(),
      saved_by: profile?.id ?? null
    };
    const missing = [
      ["Dealership Name", details.dealership_name],
      ["Dealership Address", details.dealership_address],
      ["Contact Person Name", details.contact_person_name],
      ["Contact Number", details.contact_number]
    ].filter(([, value]) => !value).map(([label]) => label);
    if (missing.length) throw new Error(`Please fill: ${missing.join(", ")}.`);

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("claim_stage_details").insert({ claim_id: claimId, stage: claim.current_status ?? "Final Documents", details, created_by: profile?.id ?? null });
    if (error) throw new Error(error.message);
    revalidatePath(`/claims/${claimId}/final-documents`);
    return { ok: true, message: "Dealership details saved." };
  } catch (error) {
    console.error("saveFinalDealershipDetails failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Unable to save dealership details." };
  }
}

export async function uploadFinalDocument(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = clean(formData.get("claimId"));
    const documentType = clean(formData.get("documentType"));
    const file = formData.get("file");
    if (!claimId || !documentType) throw new Error("Missing claim or document type.");
    if (!(file instanceof File) || !file.size) throw new Error("Please select a file to upload.");

    const profile = await currentProfile();
    const claim = await loadClaim(claimId);
    const supabase = await createServerSupabaseClient();
    const safeName = safeFileName(file.name);
    const storagePath = `${claimId}/final-documents/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    await supabase.from("claim_documents").update({ verification_status: "rejected", rejection_reason: "Replaced by newer upload", verified_by: profile?.id ?? null, verified_at: new Date().toISOString() }).eq("claim_id", claimId).eq("document_type", documentType).neq("verification_status", "rejected");

    const { error: insertError } = await supabase.from("claim_documents").insert({ claim_id: claimId, customer_id: claim.customer_id, document_type: documentType, file_name: safeName, storage_bucket: bucketName, storage_path: storagePath, verification_status: "pending" });
    if (insertError) throw new Error(insertError.message);

    await supabase.from("claim_stage_details").insert({ claim_id: claimId, stage: claim.current_status ?? "Final Documents", details: { verification_type: "final_document_uploaded", document_type: documentType, file_name: safeName, uploaded_at: new Date().toISOString(), uploaded_by: profile?.id ?? null }, created_by: profile?.id ?? null });
    revalidatePath(`/claims/${claimId}/final-documents`);
    revalidatePath("/dashboard");
    return { ok: true, message: `${documentType} uploaded.` };
  } catch (error) {
    console.error("uploadFinalDocument failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Upload failed." };
  }
}

export async function verifyFinalDocument(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = clean(formData.get("claimId"));
    const documentId = clean(formData.get("documentId"));
    const documentType = clean(formData.get("documentType"));
    if (!claimId || !documentId || !documentType) throw new Error("Upload the document before verification.");
    const profile = await currentProfile();
    const claim = await loadClaim(claimId);
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("claim_documents").update({ verification_status: "verified", verified_by: profile?.id ?? null, verified_at: new Date().toISOString(), rejection_reason: null }).eq("id", documentId).eq("claim_id", claimId);
    if (error) throw new Error(error.message);
    await supabase.from("claim_stage_details").insert({ claim_id: claimId, stage: claim.current_status ?? "Final Documents", details: { verification_type: "final_document_verified", document_type: documentType, document_id: documentId, verified_at: new Date().toISOString(), verified_by: profile?.id ?? null }, created_by: profile?.id ?? null });
    await supabase.from("claim_status_history").insert({ claim_id: claimId, from_status: claim.current_status, to_status: claim.current_status, notes: `${documentType} verified in final documents stage.`, changed_by: profile?.id ?? null });
    revalidatePath(`/claims/${claimId}/final-documents`);
    revalidatePath("/dashboard");
    return { ok: true, message: `${documentType} verified.` };
  } catch (error) {
    console.error("verifyFinalDocument failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Verification failed." };
  }
}

export async function submitFinalDocumentsDraft(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = clean(formData.get("claimId"));
    if (!claimId) throw new Error("Missing claim id.");
    const profile = await currentProfile();
    const claim = await loadClaim(claimId);
    const supabase = await createServerSupabaseClient();
    await supabase.from("claim_stage_details").insert({ claim_id: claimId, stage: claim.current_status ?? "Final Documents", details: { verification_type: "final_documents_draft_saved", saved_at: new Date().toISOString(), saved_by: profile?.id ?? null }, created_by: profile?.id ?? null });
    revalidatePath(`/claims/${claimId}/final-documents`);
    return { ok: true, message: "Draft saved." };
  } catch (error) {
    console.error("submitFinalDocumentsDraft failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Unable to save draft." };
  }
}
