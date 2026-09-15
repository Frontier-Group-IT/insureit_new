"use server";

import { requireClaimWorkflowAccess } from "@/lib/claim-workflow-access";
import { verifySpotSurveyDocument } from "./spot-survey-actions";

const legacyAdditionalUploadReason = "replaced by newer upload";
const maxBulkVerificationDocuments = 25;

type ActionResult = { ok: boolean; message?: string };
type ClaimDocumentRow = { id: string; verification_status: string; rejection_reason: string | null };

function parseDocumentIds(value: string) {
  const ids = Array.from(new Set(value.split(",").map((id) => id.trim()).filter(Boolean)));
  if (ids.length > maxBulkVerificationDocuments) throw new Error(`Select no more than ${maxBulkVerificationDocuments} files at a time.`);
  return ids;
}
function isLegacyAdditionalUpload(document: ClaimDocumentRow) {
  return document.verification_status === "rejected" && document.rejection_reason?.trim().toLowerCase() === legacyAdditionalUploadReason;
}

export async function verifyClaimDocumentWithAdditionalUploadCompat(formData: FormData): Promise<ActionResult> {
  try {
    const claimId = String(formData.get("claimId") ?? "").trim();
    const documentIds = parseDocumentIds(String(formData.get("documentId") ?? ""));
    if (!claimId || !documentIds.length) throw new Error("Missing claim or document id.");
    const { claim, supabase } = await requireClaimWorkflowAccess(claimId, "You do not have permission to verify claim documents.");
    if (claim.claim_service_mode !== "broker_managed") throw new Error("Operations can process this claim only after assistance is accepted.");

    const { data: documents, error: documentsError } = await supabase.from("claim_documents").select("id, verification_status, rejection_reason").eq("claim_id", claimId).in("id", documentIds).returns<ClaimDocumentRow[]>();
    if (documentsError) throw new Error(documentsError.message);
    if ((documents ?? []).length !== documentIds.length) throw new Error("One or more selected documents are unavailable for this claim.");

    const legacyIds = (documents ?? []).filter(isLegacyAdditionalUpload).map((document) => document.id);
    if (legacyIds.length) {
      const { error: repairError } = await supabase.from("claim_documents").update({ verification_status: "pending", rejection_reason: null, verified_by: null, verified_at: null }).eq("claim_id", claimId).in("id", legacyIds);
      if (repairError) throw new Error(repairError.message);
    }
    return await verifySpotSurveyDocument(formData);
  } catch (error) {
    console.error("verifyClaimDocumentWithAdditionalUploadCompat failed", error);
    return { ok: false, message: error instanceof Error ? error.message : "Document verification failed." };
  }
}
