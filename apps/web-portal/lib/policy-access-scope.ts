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
