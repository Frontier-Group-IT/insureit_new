import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

/** Fail-closed RM intake scope: verified associated parent Partners and their Branches. */
export async function getRmPolicyIntakePredicates(profileId: string, role: string | null | undefined) {
  if (role !== "relationship_manager") return [];
  const admin = createSupabaseAdminClient();
  const scope = await getEmployeeAccessScope(profileId, role, "view_policy_intakes");
  const predicates = [`submitted_by_profile_id.eq.${profileId}`];
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
