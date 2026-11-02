import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { fetchAllPages } from "@/lib/fetch-all-pages";

/** Reporting-chain access is explicit for Policy Intakes only; never reuse a global admin scope. */
export const hierarchyIntakeRoles = new Set(["relationship_manager", "sales_manager", "asm", "zonal_head", "sales_head", "manager", "super_admin", "director"]);

async function reportingChainScope(profileId: string) {
  const admin = createSupabaseAdminClient();
  const { data: owner, error: ownerError } = await admin.from("profiles")
    .select("employee_id").eq("id",profileId).eq("is_active",true).maybeSingle<{employee_id:string|null}>();
  if (ownerError) throw new Error("policy_intake_reporting_owner_unavailable");
  if (!owner?.employee_id) return { employeeIds: [] as string[], profileIds: [profileId] };
  const { data: employees, error: employeeError } = await fetchAllPages<{id:string;reporting_manager_id:string|null}, unknown>((from,to) =>
    admin.from("employees").select("id,reporting_manager_id").eq("employment_status","active")
      .order("id", {ascending:true}).range(from,to));
  if (employeeError) throw new Error("policy_intake_reporting_hierarchy_unavailable");
  const children = new Map<string,string[]>();
  for (const employee of employees??[]) {
    if (!employee.reporting_manager_id) continue;
    children.set(employee.reporting_manager_id,[...(children.get(employee.reporting_manager_id)??[]),employee.id]);
  }
  const employeeIds: string[] = [];
  const seen = new Set<string>();
  const queue = [owner.employee_id];
  while(queue.length) {
    const id = queue.shift()!;
    if(seen.has(id)) continue;
    seen.add(id);
    employeeIds.push(id);
    queue.push(...(children.get(id)??[]));
  }
  const { data: teamProfiles, error: profileError } = await fetchAllPages<{id:string}, unknown>((from,to) =>
    admin.from("profiles").select("id").eq("is_active",true).in("employee_id",employeeIds)
      .order("id",{ascending:true}).range(from,to));
  if (profileError) throw new Error("policy_intake_reporting_profiles_unavailable");
  return {employeeIds,profileIds:[...new Set([profileId,...(teamProfiles??[]).map(p=>p.id)])]};
}

/** Fail-closed reporting hierarchy: self, descendants, assigned Partners and Branches. */
export async function getRmPolicyIntakePredicates(profileId: string, role: string | null | undefined) {
  if (!hierarchyIntakeRoles.has(role ?? "")) return [];
  const admin = createSupabaseAdminClient();
  const scope = role === "relationship_manager"
    ? await getEmployeeAccessScope(profileId, role, "view_policy_intakes")
    : await reportingChainScope(profileId);
  const predicates = [`submitted_by_profile_id.eq.${profileId}`];
  if (scope.profileIds.length) predicates.push(`submitted_by_profile_id.in.(${scope.profileIds.join(",")})`);
  if (!scope.employeeIds.length) return predicates;
  const { data: onboarding, error: onboardingError } = await admin.from("posp_misp_onboarding_profiles")
    .select("application_id").in("associate_employee_id", scope.employeeIds)
    .returns<Array<{ application_id: string }>>();
  if (onboardingError) throw new Error("rm_partner_intake_scope_unavailable");
  const applicationIds = [...new Set((onboarding ?? []).map(row => row.application_id).filter(Boolean))];
  if (!applicationIds.length) return predicates;
  const { data: parents, error: parentError } = await admin.from("partners")
    .select("id,partner_code").in("source_application_id", applicationIds)
    .is("parent_partner_id", null).returns<Array<{ id: string; partner_code: string | null }>>();
  if (parentError) throw new Error("rm_partner_intake_scope_unavailable");
  const parentIds = (parents ?? []).map(p => p.id);
  if (!parentIds.length) return predicates;
  const { data: branches, error: branchError } = await admin.from("partners")
    .select("id,partner_code").in("parent_partner_id",parentIds)
    .returns<Array<{ id: string; partner_code: string | null }>>();
  if (branchError) throw new Error("rm_branch_intake_scope_unavailable");
  const family = [...(parents ?? []), ...(branches ?? [])];
  const familyIds = family.map(p => p.id);
  // Codes are canonical partner identifiers; no customer-name based expansion.
  const codes = [...new Set(family.map(p => p.partner_code?.trim()).filter((v): v is string => Boolean(v)))];
  // Legacy intake imports use PART-2026-NNNNN while the partner master uses PTNNNNN.
  // Expand aliases only from verified Partner/Branch codes (never user-entered names).
  const sourceCodes = [...new Set(codes.flatMap(code => {
    const match = /^PT(\d{5})$/.exec(code);
    return match ? [code, `PART-2026-${match[1]}`] : [code];
  }))];
  if (sourceCodes.length) predicates.push(`lead_source_code.in.(${sourceCodes.join(",")})`);
  const { data: identities, error: identityError } = await admin.from("portal_access_identities")
    .select("profile_id").in("entity_id", familyIds).in("entity_type", ["partner","branch"])
    .returns<Array<{ profile_id: string | null }>>();
  if (identityError) throw new Error("rm_partner_login_scope_unavailable");
  const submitterIds = [...new Set((identities ?? []).map(i => i.profile_id).filter((v): v is string => Boolean(v)))];
  if (submitterIds.length) predicates.push(`submitted_by_profile_id.in.(${submitterIds.join(",")})`);
  const { data: intermediaries, error: intermediaryError } = await admin.from("intermediaries")
    .select("id").in("intermediary_code", codes.length ? codes : ["__no_codes__"])
    .returns<Array<{ id: string }>>();
  if (intermediaryError) throw new Error("rm_partner_intermediary_scope_unavailable");
  const intermediaryIds = (intermediaries ?? []).map(i => i.id);
  if (intermediaryIds.length) {
    predicates.push(`lead_source_id.in.(${intermediaryIds.join(",")})`);
    const { data: accounts, error: accountError } = await admin.from("intermediary_portal_accounts")
      .select("id").in("intermediary_id", intermediaryIds).returns<Array<{ id: string }>>();
    if (accountError) throw new Error("rm_partner_portal_scope_unavailable");
    const accountIds = (accounts ?? []).map(a => a.id);
    if (accountIds.length) predicates.push(`submitted_by_portal_account_id.in.(${accountIds.join(",")})`);
  }
  return predicates;
}
