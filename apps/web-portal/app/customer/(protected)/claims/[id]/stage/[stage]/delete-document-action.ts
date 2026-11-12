"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail, isExternalCustomerClaim, buildExternalClaimProjection } from "@/lib/customer-web-phase2-data";

type Claim = Awaited<ReturnType<typeof loadCustomerClaimDetail>>["claim"];
type ClaimFileLocation = { document_type: string; storage_bucket: string | null; storage_path: string | null };

/**
 * An Insurance Copy reused from the customer's linked policy is a reference to
 * shared storage, not a claim-owned upload. Verify the exact source document
 * against the policy linked to this customer and vehicle before detaching it.
 */
async function isLinkedPolicyCopy(
  db: ReturnType<typeof createSupabaseAdminClient>,
  claim: Claim,
  customerId: string,
  file: ClaimFileLocation,
): Promise<boolean> {
  if (file.document_type.toLowerCase().replace(/[^a-z0-9]/g, "") !== "insurancecopy" ||
      !file.storage_bucket || !file.storage_path || file.storage_path.includes("..")) return false;

  if (claim.external_policy_id) {
    const { data: linked, error: policyError } = await db.from("external_policies")
      .select("id").eq("id", claim.external_policy_id).eq("customer_id", customerId)
      .eq("vehicle_id", claim.vehicle_id).maybeSingle();
    if (policyError) throw policyError;
    if (!linked) return false;
    const { data, error } = await db.from("customer_documents").select("id")
      .eq("customer_id", customerId).eq("external_policy_id", linked.id)
      .eq("document_type", "policy_copy").eq("storage_bucket", file.storage_bucket)
      .eq("storage_path", file.storage_path).limit(1);
    if (error) throw error;
    return Boolean(data?.length);
  }

  if (!claim.policy_id) return false;
  const { data: linked, error: policyError } = await db.from("policies")
    .select("id").eq("id", claim.policy_id).eq("customer_id", customerId)
    .eq("vehicle_id", claim.vehicle_id).maybeSingle();
  if (policyError) throw policyError;
  if (!linked) return false;
  const { data, error } = await db.from("policy_documents").select("id")
    .eq("policy_id", linked.id).eq("document_type", "policy_copy")
    .eq("storage_bucket", file.storage_bucket).eq("storage_path", file.storage_path).limit(1);
  if (error) throw error;
  return Boolean(data?.length);
}

/** Never delete bytes still used by another claim, customer or policy record. */
async function cleanupUnreferencedClaimStorage(
  db: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  path: string,
  documentId: string,
): Promise<void> {
  for (const table of ["claim_documents", "policy_documents", "customer_documents"] as const) {
    const { count, error } = await db.from(table).select("id", { count: "exact", head: true })
      .eq("storage_bucket", bucket).eq("storage_path", path);
    // A failed reference check must leave the stored file intact.
    if (error || count === null) {
      console.error("Customer claim document reference check failed", { documentId, table });
      return;
    }
    if (count > 0) return;
  }
  const { error } = await db.storage.from(bucket).remove([path]);
  if (error) console.error("Customer claim attachment orphan cleanup failed", { documentId, code: error.name });
}

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

/**
 * Delete a pending customer-owned document from an editable claim-stage file row.
 * This deliberately does not relax the legacy Spot bulk/voice-note delete contract.
 * File categories and the current stage are rechecked server-side; UI eligibility
 * and supplied identifiers never confer authorization.
 */
export async function deleteCustomerClaimStageDocument(
  accountId: string, claimId: string, documentId: string,
  stage: "spot_intimation" | "claim_intimation" | "billing",
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!accountId || !claimId || !documentId ||
        !["spot_intimation", "claim_intimation", "billing"].includes(stage))
      return { ok: false, message: "Invalid document deletion request." };

    const { account } = await resolveCustomerWebScope(accountId);
    const { claim, milestones, internal_projection } = await loadCustomerClaimDetail(account.id, claimId);
    if (["Settled", "Closed", "Claim Complete"].includes(claim.current_status))
      return { ok: false, message: "Completed claims cannot have documents deleted." };

    const external = isExternalCustomerClaim(claim);
    if (stage === "spot_intimation" && !external &&
      ((internal_projection?.completedStageCount ?? 0) >= 2 ||
       milestones.some(m => m.milestone_key === "claim_intimation" &&
         ["completed", "not_applicable"].includes(m.milestone_status))))
      return { ok: false, message: "Stage 1 documents are locked after Claim Intimation." };

    if (stage !== "spot_intimation") {
      if (!external) return { ok: false, message: "This claim stage does not allow customer document deletion." };
      const projection = buildExternalClaimProjection(milestones);
      const chosen = projection.stages.find(item => item.key === stage);
      if (!chosen || (projection.current_stage.key !== stage && !chosen.completed))
        return { ok: false, message: "This claim stage is not available for editing." };
    }

    const db = createSupabaseAdminClient();
    const { data: file, error: fetchError } = await db.from("claim_documents")
      .select("id,claim_id,customer_id,document_type,verification_status,storage_bucket,storage_path,uploaded_by")
      .eq("id", documentId).eq("claim_id", claim.id).eq("customer_id", account.id).maybeSingle();
    if (fetchError || !file) return { ok: false, message: "This document is no longer available." };
    const type = String(file.document_type || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const spotTypes = ["accidentphoto", "spotphoto", "accidentphotos", "rccopy", "insurancecopy",
      "driverlicence", "grloadbill", "accidentvideo"];
    const claimIntimationTypes = ["rccopy", "insurancecopy", "fitnesscopy", "grloadbill",
      "fasttagreportlast15days", "spotreport", "estimatecopy", "driverlicence",
      "driveraadhaarfront", "driveraadhaarback", "driverstatement", "roadtax",
      "localpermita", "localpermitb", "nationalpermit", "authorizationletter",
      "aadhaar", "pan", "gst", "cancelledcheque", "kycform", "claimform",
      "tpaffidavit", "towingbill", "repairestimate", "ncbverification"];
    const eligible = stage === "spot_intimation" ? spotTypes.includes(type) :
      stage === "claim_intimation" ? claimIntimationTypes.includes(type) :
      type === "finalworkshopbill";
    if (!eligible) return { ok: false, message: "This document cannot be deleted from this stage." };
    if (file.verification_status !== "pending")
      return { ok: false, message: "This document has been reviewed and cannot be deleted. Contact support." };

    const path = String(file.storage_path || "");
    const isClaimOwnedUpload = file.storage_bucket === "claim-documents" &&
      path.startsWith(account.id + "/" + claim.id + "/") && !path.includes("..");
    const isPolicyReference = await isLinkedPolicyCopy(db, claim, account.id, file);
    if (!isClaimOwnedUpload && !isPolicyReference)
      return { ok: false, message: "Document storage details are invalid. Contact support." };

    // Prevent deletion after concurrent Operations verification.
    const { data: removed, error: deleteError } = await db.from("claim_documents")
      .delete().eq("id", file.id).eq("claim_id", claim.id).eq("customer_id", account.id)
      .eq("document_type", file.document_type).eq("verification_status", "pending")
      .select("id").maybeSingle();
    if (deleteError || !removed)
      return { ok: false, message: "The document has changed or could not be deleted. Refresh and retry." };
    // Reused policy copies are detached from the claim only. Never delete
    // their shared storage object; another policy or claim may still use it.
    if (isClaimOwnedUpload && !isPolicyReference)
      await cleanupUnreferencedClaimStorage(db, "claim-documents", path, documentId);
    return { ok: true, message: "Document deleted successfully." };
  } catch (error) {
    console.error("Customer claim stage document deletion failed", error instanceof Error ? error.name : "Unknown");
    return { ok: false, message: "Unable to delete this document. Please try again." };
  }
}
