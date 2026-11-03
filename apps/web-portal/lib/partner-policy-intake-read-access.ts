import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasAnyEffectiveCapability, hasEffectiveCapability } from "@/lib/effective-permissions";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { getOperationsHeadDownlinePolicyScope, operationsHeadPolicyFilter } from "@/lib/policy-access-scope";
import { getRmPolicyIntakePredicates, hierarchyIntakeRoles } from "@/lib/rm-policy-intake-scope";

/** Partner App read-only parity with Operations Policy Intake list authorization.
 * Do NOT use this scope for upload, review, approve, or deletion mutations.
 * Nonemployee Partner/Branch identities retain their existing separate scope.
 */
export type PartnerEmployeeIntakeReadScope =
  | { mode: "organization" }
  | { mode: "or"; predicates: string }
  | { mode: "submitter"; profileId: string }
  | { mode: "none" };

export async function getPartnerEmployeeIntakeReadScope(identity: {
  actor_kind: string;
  profile_id?: string;
}): Promise<PartnerEmployeeIntakeReadScope> {
  if (identity.actor_kind !== "employee" || !identity.profile_id) return { mode: "none" };

  const admin = createSupabaseAdminClient();
  const profileId = identity.profile_id;
  const { data: profile, error } = await admin.from("profiles")
    .select("id,role,is_active").eq("id", profileId)
    .maybeSingle<{id:string;role:string|null;is_active:boolean|null}>();
  if (error || !profile || profile.is_active !== true) return { mode: "none" };

  const isDownlineHead = profile.role === "operations_head_life";
  // Operations viewers must hold at least one of these effective capabilities.
  // Operations Head has an explicit, narrower downline view, gated by view_policies.
  const canView = isDownlineHead
    ? await hasEffectiveCapability(profile,"view_policies")
    : await hasAnyEffectiveCapability(profile,[
        "view_policy_intakes","review_policy_intakes","finalize_policy_intakes",
      ]);
  if (!canView) return { mode: "none" };

  if (isDownlineHead) {
    const [scope, employeeScope] = await Promise.all([
      getOperationsHeadDownlinePolicyScope(profileId),
      getEmployeeAccessScope(profileId,profile.role,"view_policies"),
    ]);
    const policyFilter = operationsHeadPolicyFilter(scope);
    const { data: policies, error: policiesError } = policyFilter
      ? await admin.from("policies").select("id").or(policyFilter).returns<Array<{id:string}>>()
      : { data: [] as Array<{id:string}>,error:null };
    if (policiesError) throw new Error("partner_intake_downline_scope_unavailable");
    const parts: string[]=[];
    if (scope.intermediaryCodes.length) parts.push(`lead_source_code.in.(${scope.intermediaryCodes.join(",")})`);
    if (employeeScope.profileIds.length) parts.push(`submitted_by_profile_id.in.(${employeeScope.profileIds.join(",")})`);
    if (policies?.length) parts.push(`final_policy_id.in.(${policies.map(item=>item.id).join(",")})`);
    return parts.length ? { mode:"or",predicates:parts.join(",") } : { mode:"none" };
  }

  if (profile.role === "super_admin") return { mode:"organization" };

  if (profile.role && hierarchyIntakeRoles.has(profile.role)) {
    const predicates=await getRmPolicyIntakePredicates(profileId,profile.role);
    return predicates.length ? { mode:"or",predicates:predicates.join(",") } : { mode:"none" };
  }

  // Keep the Operations page's reviewer rule (review_policy_intakes at edit access).
  const reviewer=await hasEffectiveCapability(profile,"review_policy_intakes","edit");
  if (reviewer) return { mode:"organization" };
  return { mode:"submitter",profileId };
}
