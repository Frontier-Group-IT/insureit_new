import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Parent/branch source attribution for records already authorized to the RM.
 * This is display/filter metadata only: it NEVER expands an RM's record scope.
 * Unknown or inconsistent historical links fail closed without reassignment.
 */
export async function resolveRmPartnerPolicyAttribution(policyIds: readonly string[]) {
  const ids = [...new Set(policyIds.filter(Boolean))];
  const resolved = new Map<string, { parentPartnerId: string; parentCode: string; branchId: string; legacyBranchCode: string }>();
  if (!ids.length) return resolved;
  const admin = createSupabaseAdminClient();
  // Only fetch links for policies already returned by the RM-authorized policy query.
  for (let start = 0; start < ids.length; start += 200) {
    const { data: links, error } = await admin.from("partner_branch_policy_links")
      .select("policy_id,parent_partner_id,branch_id,legacy_intermediary_code")
      .in("policy_id", ids.slice(start, start + 200));
    if (error) throw new Error("Partner hierarchy attribution is unavailable.");
    const parentIds = [...new Set((links ?? []).map(row => row.parent_partner_id))];
    const branchIds = [...new Set((links ?? []).map(row => row.branch_id).filter(Boolean))];
    if (!parentIds.length) continue;
    const [{ data: partners, error: parentError }, { data: branches, error: branchError }] = await Promise.all([
      admin.from("partners").select("id,partner_code").in("id", parentIds),
      admin.from("partner_branches").select("id,parent_partner_id").in("id", branchIds),
    ]);
    if (parentError || branchError) throw new Error("Partner hierarchy attribution is unavailable.");
    const branchParents = new Map((branches ?? []).map(row => [row.id, row.parent_partner_id]));
    const codes = new Map((partners ?? []).map(row => [row.id, row.partner_code?.trim() || ""]));
    for (const link of links ?? []) {
      const parentCode = codes.get(link.parent_partner_id);
      const legacyBranchCode = link.legacy_intermediary_code?.trim() ?? "";
      // A code prefix never establishes a branch identity. Verify canonical parentage.
      if (parentCode && link.branch_id && branchParents.get(link.branch_id) === link.parent_partner_id) {
        resolved.set(link.policy_id, { parentPartnerId: link.parent_partner_id, parentCode, branchId: link.branch_id, legacyBranchCode });
      }
    }
  }
  return resolved;
}

/** Preserve the intersection of RM-visible rows and selected parent hierarchy. */
export function filterAuthorizedPoliciesByParent<T extends { id: string; intermediary_code: string | null }>(
  authorizedRows: readonly T[],
  selectedParentCode: string | null,
  hierarchy: ReadonlyMap<string, { parentPartnerId: string; parentCode: string; branchId: string; legacyBranchCode: string }>,
): T[] {
  if (!selectedParentCode) return [...authorizedRows];
  return authorizedRows.filter(row =>
    (hierarchy.get(row.id)?.parentCode ?? row.intermediary_code?.trim()) === selectedParentCode,
  );
}
