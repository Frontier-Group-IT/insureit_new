"use server";

import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canAccessCustomer } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { verifySpotSurveyDocument } from "./spot-survey-actions";

const legacyAdditionalUploadReason = "replaced by newer upload";
const maxBulkVerificationDocuments = 25;

type ActionResult = { ok: boolean; message?: string };
type ClaimRow = {
  id: string;
  customer_id: string;
  claim_service_mode: "broker_managed" | "self_managed";
};
type ClaimDocumentRow = {
  id: string;
  verification_status: string;
  rejection_reason: string | null;
};

function parseDocumentIds(value: string) {
  const ids = Array.from(new Set(value.split(",").map((id) => id.trim()).filter(Boolean)));
  if (ids.length > maxBulkVerificationDocuments) throw new Error(`Select no more than ${maxBulkVerificationDocuments} files at a time.`);
  return ids;
}

function isLegacyAdditionalUpload(document: ClaimDocumentRow) {
  return document.verification_status === "rejected"
    && document.rejection_reason?.trim().toLowerCase() === legacyAdditionalUploadReason;
}

export async function verifyClaimDocumentWithAdditionalUploadCompat(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = String(formData.get("claimId") ?? "").trim();
    const documentIds = parseDocumentIds(String(formData.get("documentId") ?? ""));
    if (!claimId || !documentIds.length) throw new Error("Missing claim or document id.");

    const accessToken = await getServerAccessToken();
    const { profile } = await getAuthenticatedProfile(accessToken);
    if (!profile?.id || !(await hasEffectiveCapability(profile, "manage_claims", "edit"))) {
      throw new Error("You do not have permission to verify claim documents.");
    }

    const admin = createSupabaseAdminClient();
    const { data: claim, error: claimError } = await admin
      .from("claims")
      .select("id, customer_id, claim_service_mode")
      .eq("id", claimId)
      .maybeSingle<ClaimRow>();
    if (claimError || !claim) throw new Error(claimError?.message ?? "Claim not found.");
    if (!(await canAccessCustomer(profile.id, profile.role, claim.customer_id, "manage_claims"))) {
      throw new Error("You do not have permission to verify claim documents.");
    }
    if (claim.claim_service_mode !== "broker_managed") {
      throw new Error("Operations can process this claim only after assistance is accepted.");
    }

    const { data: documents, error: documentsError } = await admin
      .from("claim_documents")
      .select("id, verification_status, rejection_reason")
      .eq("claim_id", claimId)
      .in("id", documentIds)
      .returns<ClaimDocumentRow[]>();
    if (documentsError) throw new Error(documentsError.message);
    if ((documents ?? []).length !== documentIds.length) {
      throw new Error("One or more selected documents are unavailable for this claim.");
    }

    const legacyIds = (documents ?? []).filter(isLegacyAdditionalUpload).map((document) => document.id);
    if (legacyIds.length) {
      const { error: repairError } = await admin
        .from("claim_documents")
        .update({ verification_status: "pending", rejection_reason: null, verified_by: null, verified_at: null })
        .eq("claim_id", claimId)
        .in("id", legacyIds);
      if (repairError) throw new Error(repairError.message);
    }

    return await verifySpotSurveyDocument(formData);
  } catch (error) {
    console.error("verifyClaimDocumentWithAdditionalUploadCompat failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Document verification failed." };
  }
}
