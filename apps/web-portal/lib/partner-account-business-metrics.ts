import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/** Read-only lifetime metrics. Only call after server-side Partner application authorization. */
export type OptionalBusinessMetrics = { customerCount: number | null; netPremium: number | null };
const PAGE_SIZE = 500;
const BATCH_SIZE = 100;

function chunks<T>(items: T[], size = BATCH_SIZE): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

type Admin = ReturnType<typeof createSupabaseAdminClient>;
type LinkedPolicy = { id: string; customer_id: string | null };
type Premium = { policy_id: string; net_premium: number | null };

/** Fetch policy and premium rows without PostgREST's default 1,000-row truncation. */
async function policyTotals(admin: Admin, policyIds: string[]) {
  const policies = new Map<string, LinkedPolicy>();
  const premiums = new Map<string, number>();
  for (const batch of chunks([...new Set(policyIds)])) {
    const [policyResult, premiumResult] = await Promise.all([
      admin.from("policies").select("id,customer_id").in("id", batch).returns<LinkedPolicy[]>(),
      admin.from("policy_premium_details").select("policy_id,net_premium").in("policy_id", batch).returns<Premium[]>(),
    ]);
    if (policyResult.error || premiumResult.error) throw new Error("Business metric policy lookup failed");
    for (const policy of policyResult.data ?? []) policies.set(policy.id, policy);
    for (const row of premiumResult.data ?? []) {
      if (premiums.has(row.policy_id)) throw new Error("Multiple premium records for one policy");
      if (row.net_premium !== null && !Number.isFinite(Number(row.net_premium))) throw new Error("Invalid premium");
      premiums.set(row.policy_id, row.net_premium === null ? NaN : Number(row.net_premium));
    }
  }
  return { policies, premiums };
}

function sumForPolicies(policyIds: Set<string>, lookup: Awaited<ReturnType<typeof policyTotals>>, otherCustomers: Set<string>) {
  const customerIds = new Set(otherCustomers);
  let netPremium = 0;
  for (const id of policyIds) {
    const policy = lookup.policies.get(id);
    if (!policy) return { customerCount: null, netPremium: null };
    if (policy.customer_id) customerIds.add(policy.customer_id);
    const premium = lookup.premiums.get(id);
    if (typeof premium !== "number" || !Number.isFinite(premium)) return { customerCount: customerIds.size, netPremium: null };
    netPremium += premium;
  }
  return { customerCount: customerIds.size, netPremium };
}

/**
 * Branch policy attribution is canonical: legacy branch profile -> canonical
 * partner_branches row -> partner_branch_policy_links. Never infer ownership from
 * a customer name, branch name or the parent Partner's entire business.
 */
export async function loadBranchAccountBusinessMetrics(parentId: string, partnerIds: string[]) {
  const result = new Map<string, OptionalBusinessMetrics>();
  if (!partnerIds.length) return result;
  const admin = createSupabaseAdminClient();
  try {
    const profileRows: { id: string; partner_id: string }[] = [];
    for (const batch of chunks(partnerIds)) {
      const { data, error } = await admin.from("partner_branch_profiles").select("id,partner_id").in("partner_id", batch);
      if (error) throw error;
      profileRows.push(...(data ?? []));
    }
    const byProfileId = new Map(profileRows.map(profile => [profile.id, profile.partner_id]));
    const branchIds = new Map<string, string>();
    for (const batch of chunks([...byProfileId.keys()])) {
      const { data, error } = await admin.from("partner_branches")
        .select("id,legacy_branch_profile_id,parent_partner_id").eq("parent_partner_id", parentId)
        .in("legacy_branch_profile_id", batch);
      if (error) throw error;
      for (const row of data ?? []) {
        const partnerId = byProfileId.get(row.legacy_branch_profile_id);
        if (!partnerId || branchIds.has(partnerId)) throw new Error("Ambiguous canonical Branch mapping");
        branchIds.set(partnerId, row.id);
      }
    }
    const idsByBranch = new Map<string, Set<string>>();
    const canonicalIds = [...branchIds.values()];
    for (const batch of chunks(canonicalIds)) {
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await admin.from("partner_branch_policy_links")
          .select("branch_id,policy_id").eq("parent_partner_id", parentId)
          .in("branch_id", batch).order("policy_id").range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        for (const row of data ?? []) {
          if (!idsByBranch.has(row.branch_id)) idsByBranch.set(row.branch_id, new Set());
          idsByBranch.get(row.branch_id)!.add(row.policy_id);
        }
        if ((data?.length ?? 0) < PAGE_SIZE) break;
      }
    }
    const policyIds = [...new Set([...idsByBranch.values()].flatMap(set => [...set]))];
    const lookup = await policyTotals(admin, policyIds);
    for (const partnerId of partnerIds) {
      const canonicalId = branchIds.get(partnerId);
      if (!canonicalId) { result.set(partnerId, { customerCount: null, netPremium: null }); continue; }
      result.set(partnerId, sumForPolicies(idsByBranch.get(canonicalId) ?? new Set(), lookup, new Set()));
    }
  } catch (error) {
    console.error("[partner-branch-metrics] Read-only aggregation failed", error instanceof Error ? error.message : "unknown");
    for (const id of partnerIds) result.set(id, { customerCount: null, netPremium: null });
  }
  return result;
}

/** Attribute Associate business only to policy intakes submitted by that auth profile. */
export async function loadAssociateAccountBusinessMetrics(associates: Array<{ id: string; auth_user_id: string }>) {
  const result = new Map<string, OptionalBusinessMetrics>();
  if (!associates.length) return result;
  const admin = createSupabaseAdminClient();
  try {
    const byProfile = new Map(associates.map(a => [a.auth_user_id, a.id]));
    const policiesByAssociate = new Map<string, Set<string>>();
    const customersByAssociate = new Map<string, Set<string>>();
    for (const batch of chunks([...byProfile.keys()])) {
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await admin.from("policy_intake_requests")
          .select("id,submitted_by_profile_id,matched_customer_id,final_policy_id")
          .in("submitted_by_profile_id", batch).order("id").range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        for (const row of data ?? []) {
          const id = byProfile.get(row.submitted_by_profile_id);
          if (!id) continue;
          if (!policiesByAssociate.has(id)) policiesByAssociate.set(id, new Set());
          if (!customersByAssociate.has(id)) customersByAssociate.set(id, new Set());
          if (row.final_policy_id) policiesByAssociate.get(id)!.add(row.final_policy_id);
          if (row.matched_customer_id) customersByAssociate.get(id)!.add(row.matched_customer_id);
        }
        if ((data?.length ?? 0) < PAGE_SIZE) break;
      }
    }
    const lookup = await policyTotals(admin, [...new Set([...policiesByAssociate.values()].flatMap(set => [...set]))]);
    for (const { id } of associates) {
      result.set(id, sumForPolicies(policiesByAssociate.get(id) ?? new Set(), lookup, customersByAssociate.get(id) ?? new Set()));
    }
  } catch (error) {
    console.error("[partner-associate-metrics] Read-only aggregation failed", error instanceof Error ? error.message : "unknown");
    for (const { id } of associates) result.set(id, { customerCount: null, netPremium: null });
  }
  return result;
}
