import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
export type LinkedClaimPolicy = {
  customer_id: string;
  vehicle_id: string;
  policy_id: string | null;
  external_policy_id: string | null;
  policy_service_source: string | null;
};
export type ReusablePolicyDocument = {
  id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
};

/** A customer-owned external policy takes priority over any legacy internal link.
 * The same exact customer and vehicle must own the linked policy.
 */
export async function findLinkedClaimPolicyCopy(admin: AdminClient, claim: LinkedClaimPolicy): Promise<ReusablePolicyDocument | null> {
  if (claim.external_policy_id || claim.policy_service_source === "external") {
    if (!claim.external_policy_id) return null;
    const { data: linked, error: policyError } = await admin.from("external_policies")
      .select("id,document_storage_path")
      .eq("id", claim.external_policy_id)
      .eq("customer_id", claim.customer_id)
      .eq("vehicle_id", claim.vehicle_id).maybeSingle();
    if (policyError) throw new Error("Could not check the linked external policy.");
    if (!linked) return null;
    const query = admin.from("customer_documents")
      .select("id,file_name,storage_bucket,storage_path,mime_type,file_size")
      .eq("customer_id", claim.customer_id)
      .eq("external_policy_id", linked.id)
      .eq("document_type", "policy_copy");
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle<ReusablePolicyDocument>();
    if (error) throw new Error("Could not check the customer policy copy.");
    if (data?.storage_bucket && data.storage_path) return data;
    if (!linked.document_storage_path) return null;
    const { data: legacy, error: legacyError } = await admin.from("customer_documents")
      .select("id,file_name,storage_bucket,storage_path,mime_type,file_size")
      .eq("customer_id", claim.customer_id)
      .eq("document_type", "policy_copy")
      .eq("storage_path", linked.document_storage_path)
      .limit(1).maybeSingle<ReusablePolicyDocument>();
    if (legacyError) throw new Error("Could not check the linked policy copy.");
    return legacy?.storage_bucket && legacy.storage_path ? legacy : null;
  }
  if (!claim.policy_id) return null;
  const { data: linked, error: linkedError } = await admin.from("policies")
    .select("id").eq("id", claim.policy_id).eq("customer_id", claim.customer_id)
    .eq("vehicle_id", claim.vehicle_id).maybeSingle();
  if (linkedError) throw new Error("Could not check the linked internal policy.");
  if (!linked) return null;
  const { data, error } = await admin.from("policy_documents")
    .select("id,file_name,storage_bucket,storage_path,mime_type,file_size")
    .eq("policy_id", linked.id).eq("document_type", "policy_copy")
    .order("created_at", { ascending: false }).limit(1).maybeSingle<ReusablePolicyDocument>();
  if (error) throw new Error("Could not check the policy copy.");
  return data?.storage_bucket && data.storage_path ? data : null;
}

/** Check the exact storage reference, not merely the document category.
 * This preserves legitimately different Insurance Copy uploads.
 */
export async function findExistingLinkedClaimCopy(admin: AdminClient, claimId: string, customerId: string, source: ReusablePolicyDocument) {
  const { data, error } = await admin.from("claim_documents")
    .select("id,document_type,file_name,created_at,verification_status")
    .eq("claim_id",claimId).eq("customer_id",customerId)
    .eq("storage_bucket",source.storage_bucket).eq("storage_path",source.storage_path)
    .limit(1);
  if (error) throw new Error("Could not check existing claim documents.");
  return data?.[0] ?? null;
}
