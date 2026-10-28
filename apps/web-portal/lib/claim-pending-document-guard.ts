import { requireClaimWorkflowAccess } from "@/lib/claim-workflow-access";

/** Operations must verify every uploaded, non-rejected claim document before saving a stage. */
export async function requireVerifiedClaimDocuments(
  supabase: Awaited<ReturnType<typeof requireClaimWorkflowAccess>>["supabase"],
  claimId: string,
) {
  const { data, error } = await supabase
    .from("claim_documents")
    .select("id,verification_status")
    .eq("claim_id", claimId);
  if (error) throw new Error("Unable to check document verification. Please try again.");
  const pending = (data ?? []).filter((doc: { verification_status: string | null }) =>
    doc.verification_status !== "verified" && doc.verification_status !== "rejected",
  );
  if (pending.length) throw new Error(`Verify first — ${pending.length} uploaded document${pending.length === 1 ? "" : "s"} pending verification.`);
}
