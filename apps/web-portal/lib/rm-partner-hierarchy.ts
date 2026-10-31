import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Parent/branch source attribution for records already authorized to the RM.
 * This is display/filter metadata only: it NEVER expands an RM's record scope.
 * Unknown or inconsistent historical links fail closed without reassignment.
 */
export async function resolveRmPartnerPolicyAttribution(policyIds: readonly string[]) {
  const ids = [...new Set(policyIds.filter(Boolean))];
  const resolved = new Map<string, { parentCode: string; branchCode: string }>();
  if (!ids.length) return resolved;
  const admin = createSupabaseAdminClient();
  // Only fetch links for policies already returned by the RM-authorized policy query.
  for (let start = 0; start < ids.length; start += 200) {
    const { data: links, error } = await admin.from("partner_branch_policy_links")
      .select("policy_id,parent_partner_id,legacy_intermediary_code")
      .in("policy_id", ids.slice(start, start + 200));
    if (error) throw new Error("Partner hierarchy attribution is unavailable.");
    const parentIds = [...new Set((links ?? []).map(row => row.parent_partner_id))];
    if (!parentIds.length) continue;
    const { data: partners, error: parentError } = await admin.from("partners")
      .select("id,partner_code").in("id", parentIds);
    if (parentError) throw new Error("Partner hierarchy attribution is unavailable.");
    const codes = new Map((partners ?? []).map(row => [row.id, row.partner_code?.trim() || ""]));
    for (const link of links ?? []) {
      const parentCode = codes.get(link.parent_partner_id);
      const branchCode = link.legacy_intermediary_code?.trim();
      if (parentCode && branchCode) resolved.set(link.policy_id, { parentCode, branchCode });
    }
  }
  return resolved;
}

/** Preserve the intersection of RM-visible rows and selected parent hierarchy. */
export function filterAuthorizedPoliciesByParent<T extends { id: string; intermediary_code: string | null }>(
  authorizedRows: readonly T[],
  selectedParentCode: string | null,
  hierarchy: ReadonlyMap<string, { parentCode: string; branchCode: string }>,
): T[] {
  if (!selectedParentCode) return [...authorizedRows];
  return authorizedRows.filter(row =>
    (hierarchy.get(row.id)?.parentCode ?? row.intermediary_code?.trim()) === selectedParentCode,
  );
}
