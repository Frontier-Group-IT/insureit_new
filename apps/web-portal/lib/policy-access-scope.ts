import "server-only";

import type { Capability } from "@/lib/roles";
import { getAccessibleIntermediaryIds, getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/** Explicit, fail-closed scope for Anjana; includes RM ownership and sourced intermediary codes. */
export async function getAnjanaParsottamPolicyScope(profileId: string, role: string | null | undefined) {
  if (profileId !== "a8a5b9ad-5435-4e29-9f2d-b47fb338199a" || role !== "sales_executive") return null;
  const scope = await getEmployeeAccessScope(profileId, role, "view_policies");
  if (scope.mode !== "hierarchy" || !scope.employeeIds.includes("a8d8ef1f-914f-4e0c-93ab-694bcc99832d"))
    return { employeeIds: [], intermediaryCodes: [] };
  const admin = createSupabaseAdminClient();
  const filters = [`associate_employee_id.in.(${scope.employeeIds.join(",")})`];
  if (scope.profileIds.length) filters.push(`associate_profile_id.in.(${scope.profileIds.join(",")})`);
  const { data, error } = await admin.from("intermediaries")
    .select("intermediary_code").or(filters.join(","))
    .returns<Array<{ intermediary_code: string | null }>>();
  if (error) return { employeeIds: [], intermediaryCodes: [] };
  return { employeeIds: scope.employeeIds, intermediaryCodes: Array.from(new Set((data ?? [])
    .map(row => row.intermediary_code?.trim()).filter((code): code is string => Boolean(code)))) };
}

/**
 * Returns the RM employee ids that may own policies visible to this profile.
 * `null` means organization-wide access; an empty array means no policy scope.
 *
 * Policy authorization is intentionally based on policies.rm_employee_id rather
 * than customer visibility. A customer can legitimately have policies owned by
 * different RMs, so customer scope must never widen policy scope.
 */
export async function getAccessiblePolicyRmEmployeeIds(
  profileId: string,
  role: string | null | undefined,
  capability: Capability = "view_policies",
): Promise<string[] | null> {
  const scope = await getEmployeeAccessScope(profileId, role, capability);
  if (scope.mode === "organization") return null;
  return Array.from(new Set(scope.employeeIds));
}

/**
 * The Operations Head's scope is the union of policies owned by a downline RM
 * and those sourced through a Partner/POSP/MISP attached to a downline employee.
 * No business-line/vertical filter applies. Missing ownership fails closed.
 */
export async function getOperationsHeadDownlinePolicyScope(profileId: string) {
  const scope = await getEmployeeAccessScope(profileId, "operations_head_life", "view_policies");
  const employeeIds = scope.employeeIds;
  if (!employeeIds.length) return { employeeIds: [], intermediaryCodes: [] };
  const admin = createSupabaseAdminClient();
  const profileIds = scope.profileIds;
  const filters = [`associate_employee_id.in.(${employeeIds.join(",")})`];
  if (profileIds.length) filters.push(`associate_profile_id.in.(${profileIds.join(",")})`);
  // Include intermediaries linked to downline RMs via their onboarding profiles,
  // not only the associate fields materialized on the intermediary row.
  // Reuse the established scoped intermediary authorization instead of widening
  // the Life Head's lead-source list to all organization Partners.
  const accessibleIds = await getAccessibleIntermediaryIds(profileId, "operations_head_life", "view_intermediaries");
  const [directResult, linkedResult] = await Promise.all([
    admin.from("intermediaries")
      .select("intermediary_code").or(filters.join(","))
      .returns<Array<{ intermediary_code: string | null }>>(),
    accessibleIds?.length
      ? admin.from("intermediaries")
          .select("intermediary_code").in("id", accessibleIds)
          .returns<Array<{ intermediary_code: string | null }>>()
      : Promise.resolve({ data: [] as Array<{ intermediary_code: string | null }>, error: null }),
  ]);
  if (directResult.error || linkedResult.error) return { employeeIds: [], intermediaryCodes: [] };
  return {
    employeeIds,
    intermediaryCodes: Array.from(new Set([...(directResult.data ?? []), ...(linkedResult.data ?? [])]
      .map(item => item.intermediary_code?.trim()).filter((code): code is string => Boolean(code)))),
  };
}

export function operationsHeadPolicyFilter(scope: { employeeIds: string[]; intermediaryCodes: string[] }) {
  const filters: string[] = [];
  if (scope.employeeIds.length) filters.push(`rm_employee_id.in.(${scope.employeeIds.join(",")})`);
  if (scope.intermediaryCodes.length) filters.push(`intermediary_code.in.(${scope.intermediaryCodes.join(",")})`);
  return filters.join(",");
}

/** View scope: full Life/Health vertical plus the existing RM/partner downline. */
export function operationsHeadVisiblePolicyFilter(scope: { employeeIds: string[]; intermediaryCodes: string[] }) {
  const downline = operationsHeadPolicyFilter(scope);
  const lifeHealth = 'business_line.in.("Life","Health")';
  return downline ? `${downline},${lifeHealth}` : lifeHealth;
}

/** Reusable server-side case authorization, never customer-only scope. */
export async function canAccessOperationsHeadCase(profileId: string, caseId: string, write = false): Promise<boolean> {
  const downline = await getOperationsHeadDownlinePolicyScope(profileId);
  const filter = write ? operationsHeadPolicyFilter(downline) : operationsHeadVisiblePolicyFilter(downline);
  if (!caseId || !filter) return false;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("life_health_cases")
    .select("id").eq("id", caseId).in("business_line", ["Life", "Health"]).or(filter).maybeSingle<{ id: string }>();
  return !error && Boolean(data?.id);
}

/** Verify policy-intake ownership through downline source or a booked downline policy. */
export async function canAccessOperationsHeadIntake(profileId: string, intakeId: string) {
  const scope = await getOperationsHeadDownlinePolicyScope(profileId);
  if (!intakeId || (!scope.employeeIds.length && !scope.intermediaryCodes.length)) return false;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("policy_intake_requests")
    .select("lead_source_code,submitted_by_profile_id,final_policy_id")
    .eq("id", intakeId).maybeSingle<{
      lead_source_code: string | null;
      submitted_by_profile_id: string | null;
      final_policy_id: string | null;
    }>();
  if (error || !data) return false;
  if (data.lead_source_code && scope.intermediaryCodes.includes(data.lead_source_code.trim())) return true;
  const hierarchy = await getEmployeeAccessScope(profileId, "operations_head_life", "view_policies");
  if (data.submitted_by_profile_id && hierarchy.profileIds.includes(data.submitted_by_profile_id)) return true;
  if (!data.final_policy_id) return false;
  const downline = operationsHeadPolicyFilter(scope);
  if (!downline) return false;
  const { data: policy, error: policyError } = await admin.from("policies")
    .select("id").eq("id", data.final_policy_id).or(downline)
    .maybeSingle<{ id: string }>();
  return !policyError && Boolean(policy?.id);
}

export async function getSalesExecutivePolicyIds(profileId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("policy_intake_requests")
    .select("final_policy_id")
    .eq("submitted_by_profile_id", profileId)
    .eq("status", "completed")
    .not("final_policy_id", "is", null)
    .returns<Array<{ final_policy_id: string | null }>>();
  if (error) return [];
  return Array.from(new Set((data ?? []).map((row) => row.final_policy_id).filter((id): id is string => Boolean(id))));
}

export async function canAccessPolicy(
  profileId: string,
  role: string | null | undefined,
  policyId: string,
  capability: Capability = "view_policies",
  write = false,
) {
  const anjanaScope = await getAnjanaParsottamPolicyScope(profileId, role);
  if (anjanaScope && !write) {
    const filters = operationsHeadPolicyFilter(anjanaScope);
    if (!filters) return false;
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("policies").select("id")
      .eq("id", policyId).or(filters).maybeSingle<{ id: string }>();
    return !error && Boolean(data?.id);
  }
  if (role === "sales_executive") {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("policy_intake_requests")
      .select("id")
      .eq("submitted_by_profile_id", profileId)
      .eq("status", "completed")
      .eq("final_policy_id", policyId)
      .limit(1)
      .maybeSingle<{ id: string }>();
    return !error && Boolean(data?.id);
  }

  if (role === "operations_head_life") {
    // Life/Health authorization is vertical-wide, regardless of RM or partner.
    // Resolve the target record first: a downline scope query must never be a
    // prerequisite for reading or editing a Life/Health policy.
    const admin = createSupabaseAdminClient();
    const { data: target, error: targetError } = await admin.from("policies")
      .select("id,business_line").eq("id", policyId)
      .maybeSingle<{ id: string; business_line: string | null }>();
    if (targetError || !target) return false;
    if (target.business_line === "Life" || target.business_line === "Health") return true;

    // Preserve legacy RM/intermediary downline scope for other verticals.
    const downline = await getOperationsHeadDownlinePolicyScope(profileId);
    const filter = operationsHeadPolicyFilter(downline);
    if (!filter) return false;
    const { data, error } = await admin.from("policies")
      .select("id").eq("id", policyId).or(filter).maybeSingle<{ id: string }>();
    return !error && Boolean(data?.id);
  }
  const rmEmployeeIds = await getAccessiblePolicyRmEmployeeIds(profileId, role, capability);
  if (rmEmployeeIds === null) return true;
  if (!rmEmployeeIds.length) return false;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("policies")
    .select("id")
    .eq("id", policyId)
    .in("rm_employee_id", rmEmployeeIds)
    .maybeSingle<{ id: string }>();

  if (error) return false;
  return Boolean(data?.id);
}
