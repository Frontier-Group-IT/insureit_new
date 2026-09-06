"use server";

import { matchesClaimIntimationDocument } from "@insureit/claim-journey";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";

const bucketName = "claim-documents";
type ActionResult = { ok: boolean; message?: string };
type ClaimRow = { id: string; customer_id: string | null; current_status: string | null };

type ClaimIntimationDetails = {
  claim_intimation_date: string;
  dealership_name: string;
  dealership_location: string;
  gate_in_date: string;
  estimate_amount: string;
};

async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!(await hasEffectiveCapability(profile, "manage_claims", "edit"))) throw new Error("You do not have permission to update final documents.");
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

function isDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`));
}

export async function loadFinalClaimIntimationDetails(claimId: string): Promise<{ ok: boolean; details?: ClaimIntimationDetails; message?: string }> {
  try {
    if (!claimId) throw new Error("Missing claim id.");
    await currentProfile();
    await loadClaim(claimId);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("claim_stage_details")
      .select("details")
      .eq("claim_id", claimId)
      .filter("details->>verification_type", "eq", "final_documents_dealership_details")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ details: Record<string, unknown> | null }>();
    if (error) throw new Error(error.message);
    const details = data?.details ?? {};
    return {
      ok: true,
      details: {
        claim_intimation_date: typeof details.claim_intimation_date === "string" ? details.claim_intimation_date : typeof details.contact_person_name === "string" ? details.contact_person_name : "",
        dealership_name: typeof details.dealership_name === "string" ? details.dealership_name : "",
        dealership_location: typeof details.dealership_location === "string" ? details.dealership_location : typeof details.dealership_address === "string" ? details.dealership_address : "",
        gate_in_date: typeof details.gate_in_date === "string" ? details.gate_in_date : typeof details.contact_number === "string" ? details.contact_number : "",
        estimate_amount: typeof details.estimate_amount === "number" ? String(details.estimate_amount) : typeof details.estimate_amount === "string" ? details.estimate_amount : ""
      }
    };
  } catch (error) {
    console.error("loadFinalClaimIntimationDetails failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Unable to load claim intimation details." };
  }
}

export async function saveFinalDealershipDetails(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = clean(formData.get("claimId"));
    if (!claimId) throw new Error("Missing claim id.");
    const profile = await currentProfile();
    const claim = await loadClaim(claimId);
    const claimIntimationDate = clean(formData.get("claim_intimation_date"));
    const dealershipName = clean(formData.get("dealership_name"));
    const dealershipLocation = clean(formData.get("dealership_location"));
    const gateInDate = clean(formData.get("gate_in_date"));
    const estimateAmountText = clean(formData.get("estimate_amount"));
    const estimateAmount = Number(estimateAmountText);

    const missing = [
      ["Claim Intimation Date", claimIntimationDate],
      ["Dealership Name", dealershipName],
      ["Dealership Location", dealershipLocation],
      ["Gate-in Date", gateInDate],
      ["Estimate Amount", estimateAmountText]
    ].filter(([, value]) => !value).map(([label]) => label);
    if (missing.length) throw new Error(`Please fill: ${missing.join(", ")}.`);
    if (!isDateValue(claimIntimationDate)) throw new Error("Please select a valid Claim Intimation Date.");
    if (!isDateValue(gateInDate)) throw new Error("Please select a valid Gate-in Date.");
    if (!Number.isFinite(estimateAmount) || estimateAmount < 0) throw new Error("Please enter a valid Estimate Amount.");

    const details = {
      verification_type: "final_documents_dealership_details",
      claim_intimation_date: claimIntimationDate,
      dealership_name: dealershipName,
      dealership_location: dealershipLocation,
      gate_in_date: gateInDate,
      estimate_amount: estimateAmount,
      // Backward-compatible aliases for existing operations reads.
      dealership_address: dealershipLocation,
      contact_person_name: claimIntimationDate,
      contact_number: gateInDate,
      saved_at: new Date().toISOString(),
      saved_by: profile?.id ?? null
    };

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("claim_stage_details").insert({ claim_id: claimId, stage: claim.current_status ?? "Final Documents", details, created_by: profile?.id ?? null });
    if (error) throw new Error(error.message);
    revalidatePath(`/claims/${claimId}`);
    revalidatePath(`/claims/${claimId}/final-documents`);
    return { ok: true, message: "Stage details saved." };
  } catch (error) {
    console.error("saveFinalDealershipDetails failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Unable to save stage details." };
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

    const { data: insertedDocument, error: insertError } = await supabase
      .from("claim_documents")
      .insert({ claim_id: claimId, customer_id: claim.customer_id, document_type: documentType, file_name: safeName, storage_bucket: bucketName, storage_path: storagePath, verification_status: "pending" })
      .select("id")
      .single<{ id: string }>();
    if (insertError || !insertedDocument) {
      await supabase.storage.from(bucketName).remove([storagePath]);
      throw new Error(insertError?.message ?? "The document record could not be created.");
    }

    const { data: existingDocuments, error: existingError } = await supabase
      .from("claim_documents")
      .select("id, document_type")
      .eq("claim_id", claimId)
      .neq("id", insertedDocument.id)
      .neq("verification_status", "rejected")
      .returns<{ id: string; document_type: string }[]>();
    if (existingError) {
      await supabase.from("claim_documents").delete().eq("id", insertedDocument.id);
      await supabase.storage.from(bucketName).remove([storagePath]);
      throw new Error(existingError.message);
    }
    const replacedIds = (existingDocuments ?? [])
      .filter((document) => matchesClaimIntimationDocument(document.document_type, documentType))
      .map((document) => document.id);
    if (replacedIds.length) {
      const { error: replacementError } = await supabase
        .from("claim_documents")
        .update({ verification_status: "rejected", rejection_reason: "Replaced by newer upload", verified_by: profile?.id ?? null, verified_at: new Date().toISOString() })
        .in("id", replacedIds);
      if (replacementError) {
        await supabase.from("claim_documents").delete().eq("id", insertedDocument.id);
        await supabase.storage.from(bucketName).remove([storagePath]);
        throw new Error(replacementError.message);
      }
    }

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
