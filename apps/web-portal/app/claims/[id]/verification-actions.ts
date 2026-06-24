"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { requiredDocumentTypesForStatus, verifiedStatusFor, type ClaimStatus } from "@/lib/claim-workflow";
import { canVerifyClaimDocuments } from "@/lib/roles";

type ClaimForVerification = {
  id: string;
  customer_id: string;
  current_status: ClaimStatus;
};

type ClaimDocumentForVerification = {
  id: string;
  claim_id: string;
  document_type: string;
  verification_status: "pending" | "verified" | "rejected";
};

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formDetails(formData: FormData) {
  const details: Record<string, string | number> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "notes") continue;
    if (typeof value !== "string" || !value.trim()) continue;
    const numericValue = Number(value.replace(/,/g, ""));
    details[key] = Number.isFinite(numericValue) && /percent|gvw|kg|amount|tds|gst/i.test(key) ? numericValue : value.trim();
  }
  return details;
}

async function currentProfile() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!canVerifyClaimDocuments(profile?.role)) {
    throw new Error("You do not have permission to verify claim documents.");
  }
  return profile;
}

async function insertClaimHistory(claimId: string, fromStatus: ClaimStatus | null, toStatus: ClaimStatus, notes: string | null, changedBy: string | null) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("claim_status_history").insert({
    claim_id: claimId,
    from_status: fromStatus,
    to_status: toStatus,
    notes,
    changed_by: changedBy
  });
  if (error) throw new Error(error.message);
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

async function loadDocuments(claimId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("claim_documents")
    .select("id, claim_id, document_type, verification_status")
    .eq("claim_id", claimId)
    .returns<ClaimDocumentForVerification[]>();

  if (error) throw new Error(error.message);
  return data ?? [];
}

function allRequiredDocumentsVerified(claim: ClaimForVerification, documents: ClaimDocumentForVerification[]) {
  const required = requiredDocumentTypesForStatus(claim.current_status);
  return required.every((type) => documents.some((document) => document.document_type === type && document.verification_status === "verified"));
}

export async function saveClaimDocumentVerification(claimId: string, documentId: string, verificationType: "rc" | "insurance", formData: FormData) {
  const profile = await currentProfile();
  const supabase = await createServerSupabaseClient();
  const claim = await loadClaim(claimId);
  const notes = textValue(formData, "notes") ?? `${verificationType.toUpperCase()} verification details saved.`;

  const { data: document, error: documentError } = await supabase
    .from("claim_documents")
    .select("id, claim_id, document_type, verification_status")
    .eq("id", documentId)
    .eq("claim_id", claimId)
    .maybeSingle<ClaimDocumentForVerification>();

  if (documentError || !document) throw new Error(documentError?.message ?? "Document not found.");

  const details = {
    verification_type: verificationType,
    document_type: document.document_type,
    ...formDetails(formData)
  };

  const { error: detailError } = await supabase.from("claim_stage_details").insert({
    claim_id: claimId,
    stage: claim.current_status,
    details,
    created_by: profile?.id ?? null
  });
  if (detailError) throw new Error(detailError.message);

  const { error: reviewError } = await supabase.from("claim_documents").update({
    verification_status: "verified" as const,
    verified_by: profile?.id ?? null,
    verified_at: new Date().toISOString(),
    rejection_reason: null
  }).eq("id", documentId);
  if (reviewError) throw new Error(reviewError.message);

  const documents = (await loadDocuments(claimId)).map((item) => item.id === documentId ? { ...item, verification_status: "verified" as const } : item);
  const nextStatus = verifiedStatusFor(claim.current_status);
  if (nextStatus && nextStatus !== claim.current_status && allRequiredDocumentsVerified(claim, documents)) {
    const { error } = await supabase.from("claims").update({ current_status: nextStatus }).eq("id", claimId);
    if (error) throw new Error(error.message);
    await insertClaimHistory(claimId, claim.current_status, nextStatus, "All required documents verified by claim desk.", profile?.id ?? null);
  }

  await insertClaimHistory(claimId, claim.current_status, claim.current_status, notes, profile?.id ?? null);
  revalidatePath(`/claims/${claimId}`);
  revalidatePath("/claims");
  revalidatePath("/dashboard");
}
