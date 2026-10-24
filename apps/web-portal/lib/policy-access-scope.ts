import "server-only";

import type { Capability } from "@/lib/roles";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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
  const { data, error } = await admin.from("intermediaries")
    .select("intermediary_code").or(filters.join(","))
    .returns<Array<{ intermediary_code: string | null }>>();
  if (error) return { employeeIds: [], intermediaryCodes: [] };
  return {
    employeeIds,
    intermediaryCodes: Array.from(new Set((data ?? []).map(item => item.intermediary_code?.trim()).filter((code): code is string => Boolean(code)))),
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
    .select("id").eq("id", caseId).or(filter).maybeSingle<{ id: string }>();
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
  return Boolean(data.final_policy_id && await canAccessPolicy(profileId, "operations_head_life", data.final_policy_id));
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
    const downline = await getOperationsHeadDownlinePolicyScope(profileId);
    const filter = !write ? operationsHeadVisiblePolicyFilter(downline) : operationsHeadPolicyFilter(downline);
    if (!filter) return false;
    const admin = createSupabaseAdminClient();
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
