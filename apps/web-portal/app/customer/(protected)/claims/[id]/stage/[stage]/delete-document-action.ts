"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";

/**
 * Customer deletion is limited to still-pending, customer-owned Spot Intimation
 * bulk uploads and voice notes. Verification history and other claim documents
 * remain untouched. Always check current stage locks on the server.
 */
export async function deleteCustomerSpotAttachment(
  accountId: string,
  claimId: string,
  documentId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!accountId || !claimId || !documentId) return { ok: false, message: "Missing document details." };
    const { account } = await resolveCustomerWebScope(accountId);
    const { claim, milestones, internal_projection } = await loadCustomerClaimDetail(account.id, claimId);
    if (claim.claim_service_mode === "broker_managed" && !claim.external_policy_id &&
      ((internal_projection?.completedStageCount ?? 0) >= 2 ||
       milestones.some(m => m.milestone_key === "claim_intimation" && ["completed","not_applicable"].includes(m.milestone_status)))) {
      return { ok: false, message: "Stage 1 documents are locked after Claim Intimation." };
    }
    if (["Settled", "Closed", "Claim Complete"].includes(claim.current_status)) {
      return { ok: false, message: "Completed claims cannot have documents deleted." };
    }
    const db = createSupabaseAdminClient();
    const { data: file, error: fetchError } = await db.from("claim_documents")
      .select("id,claim_id,customer_id,document_type,verification_status,storage_bucket,storage_path")
      .eq("id", documentId).eq("claim_id", claim.id).eq("customer_id", account.id).maybeSingle();
    if (fetchError || !file) return { ok: false, message: "This document is no longer available." };
    const normalized = String(file.document_type || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!["otherdocument", "incidentvoicenote", "audio", "voicenote", "incidentaudio"].includes(normalized)) {
      return { ok: false, message: "This document cannot be deleted from this section." };
    }
    if (file.verification_status !== "pending") {
      return { ok: false, message: "This document has been reviewed and cannot be deleted. Contact support." };
    }
    if (file.storage_bucket !== "claim-documents" ||
        !String(file.storage_path || "").startsWith(account.id + "/" + claim.id + "/") ||
        String(file.storage_path).includes("..")) {
      return { ok: false, message: "Document storage details are invalid. Contact support." };
    }
    // Condition the delete on current review state to avoid racing Operations verification.
    const { data: removed, error: deleteError } = await db.from("claim_documents")
      .delete().eq("id", file.id).eq("claim_id", claim.id).eq("customer_id", account.id)
      .eq("document_type", file.document_type).eq("verification_status", "pending")
      .select("id").maybeSingle();
    if (deleteError || !removed) return { ok: false, message: "The document has changed or could not be deleted. Refresh and retry." };
    const { error: storageError } = await db.storage.from("claim-documents").remove([file.storage_path]);
    if (storageError) console.error("Customer claim attachment orphan cleanup failed", { documentId, code: storageError.name });
    return { ok: true, message: "Document deleted successfully." };
  } catch (error) {
    console.error("Customer Spot attachment deletion failed", error instanceof Error ? error.name : "Unknown");
    return { ok: false, message: "Unable to delete this document. Please try again." };
  }
}
