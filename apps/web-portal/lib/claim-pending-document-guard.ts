import { requireClaimWorkflowAccess } from "@/lib/claim-workflow-access";

/** Operations verifies uploaded claim documents; incident voice notes are evidence, not documents requiring a manual verification workflow. */
function requiresManualVerification(type: string | null): boolean {
  return (type ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") !== "incidentvoicenote";
}
export async function requireVerifiedClaimDocuments(
  supabase: Awaited<ReturnType<typeof requireClaimWorkflowAccess>>["supabase"],
  claimId: string,
) {
  const { data, error } = await supabase
    .from("claim_documents")
    .select("id,document_type,verification_status")
    .eq("claim_id", claimId);
  if (error) throw new Error("Unable to check document verification. Please try again.");
  const pending = (data ?? []).filter((doc: { document_type: string | null; verification_status: string | null }) =>
    requiresManualVerification(doc.document_type) && doc.verification_status !== "verified" && doc.verification_status !== "rejected",
  );
  if (pending.length) {
    const names = Array.from(new Set(pending.map((doc) => (doc.document_type || "Other Document").replace(/[\\r\\n]/g, " ").trim().slice(0, 60))));
    const summary = names.slice(0, 6).join(", ") + (names.length > 6 ? ", and others" : "");
    throw new Error(`Verify first — ${pending.length} uploaded document${pending.length === 1 ? "" : "s"} pending verification: ${summary}.`);
  }
}
