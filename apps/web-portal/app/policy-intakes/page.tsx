import { AppShell } from "@/components/shell";
import { ItSuperUserDeletePanel } from "@/components/it-super-user-delete-panel";
import { PolicyIntakeWorkspace, type PolicyIntakeViewKey, type PolicyIntakeWorkspaceRow } from "@/components/policy-intake-workspace";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { requirePolicyIntakeViewer } from "@/lib/policy-intake-server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { requireCapability } from "@/lib/master-data-server";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { getOperationsHeadDownlinePolicyScope, operationsHeadPolicyFilter } from "@/lib/policy-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PolicyIntakeListRow = Omit<PolicyIntakeWorkspaceRow, "submitted_by_name"> & {
  submitted_by_profile_id: string | null;
  submitted_by_portal_account_id: string | null;
};
type ProfileName = { id: string; full_name: string };
type PortalAccount = { id: string; intermediary_id: string; auth_user_id: string | null };
type BranchContact = { legacy_branch_profile_id: string | null; contact_name: string | null };
type IntermediaryName = { id: string; display_name: string };
type PolicyIntakeSearchParams = { view?: string };

function resolveInitialView(value: string | undefined, reviewer: boolean): PolicyIntakeViewKey {
  if (value === "in_review") return "in_review";
  return reviewer ? "action" : "all";
}

export default async function PolicyIntakesPage({ searchParams }: { searchParams?: Promise<PolicyIntakeSearchParams> }) {
  const { profile: requester } = await getAuthenticatedProfile(await getServerAccessToken());
  const isDownlineHead = requester?.role === "operations_head_life";
  const profile = isDownlineHead ? await requireCapability("view_policies") : await requirePolicyIntakeViewer();
  const params = searchParams ? await searchParams : undefined;
  const [reviewer, creator] = await Promise.all([
    isDownlineHead ? Promise.resolve(true) : hasEffectiveCapability(profile, "review_policy_intakes", "edit"),
    isDownlineHead ? Promise.resolve(true) : hasEffectiveCapability(profile, "create_policy_intakes", "edit"),
  ]);
  const initialView = resolveInitialView(params?.view, reviewer);
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("policy_intake_requests")
    .select("id,intake_number,status,policy_type,lead_source_name,lead_source_type,lead_source_code,customer_mobile,created_at,ocr_status,ocr_fields,file_name,assigned_to_profile_id,submitted_by_profile_id,submitted_by_portal_account_id")
    .order("created_at", { ascending: false })
    .limit(500);
  if (isDownlineHead) {
    const [scope, employeeScope] = await Promise.all([
      getOperationsHeadDownlinePolicyScope(profile.id),
      getEmployeeAccessScope(profile.id, profile.role, "view_policies"),
    ]);
    const filter = operationsHeadPolicyFilter(scope);
    const { data: allowedPolicies, error: scopeError } = filter
      ? await admin.from("policies").select("id").or(filter).returns<Array<{ id: string }>>()
      : { data: [] as Array<{ id: string }>, error: null };
    if (scopeError) throw new Error("downline_policy_intake_scope_unavailable");
    const predicates: string[] = [];
    if (scope.intermediaryCodes.length) predicates.push(`lead_source_code.in.(${scope.intermediaryCodes.join(",")})`);
    if (employeeScope.profileIds.length) predicates.push(`submitted_by_profile_id.in.(${employeeScope.profileIds.join(",")})`);
    if (allowedPolicies?.length) predicates.push(`final_policy_id.in.(${allowedPolicies.map(row => row.id).join(",")})`);
    if (predicates.length) query = query.or(predicates.join(","));
    else query = query.eq("id", "00000000-0000-0000-0000-000000000000");
  } else if (!reviewer) query = query.eq("submitted_by_profile_id", profile.id);
  const { data, error } = await query.returns<PolicyIntakeListRow[]>();

  const rows = data ?? [];
  const profileIds = Array.from(new Set(rows.map((row) => row.submitted_by_profile_id).filter(Boolean) as string[]));
  const portalAccountIds = Array.from(new Set(rows.map((row) => row.submitted_by_portal_account_id).filter(Boolean) as string[]));
  const [{ data: profileRows }, { data: portalAccountRows }, { data: branchContacts }] = await Promise.all([
    profileIds.length
      ? admin.from("profiles").select("id,full_name").in("id", profileIds).returns<ProfileName[]>()
      : Promise.resolve({ data: [] as ProfileName[] }),
    portalAccountIds.length
      ? admin.from("intermediary_portal_accounts").select("id,intermediary_id,auth_user_id").in("id", portalAccountIds).returns<PortalAccount[]>()
      : Promise.resolve({ data: [] as PortalAccount[] }),
    profileIds.length
      ? admin.from("partner_branches").select("legacy_branch_profile_id,contact_name").in("legacy_branch_profile_id", profileIds).returns<BranchContact[]>()
      : Promise.resolve({ data: [] as BranchContact[] }),
  ]);
  const portalProfileIds = Array.from(new Set((portalAccountRows ?? []).map((account) => account.auth_user_id).filter(Boolean) as string[]));
  const { data: portalProfiles } = portalProfileIds.length
    ? await admin.from("profiles").select("id,full_name").in("id", portalProfileIds).returns<ProfileName[]>()
    : { data: [] as ProfileName[] };
  const profileNameById = new Map([...profileRows ?? [], ...portalProfiles ?? []].map((item) => [item.id, item.full_name]));
  const portalAccountById = new Map((portalAccountRows ?? []).map((item) => [item.id, item]));
  // An intake submitted by a branch's legacy profile must show the actual
  // branch contact, not the branch / intermediary business display name.
  const branchContactByProfileId = new Map((branchContacts ?? [])
    .filter((branch) => branch.legacy_branch_profile_id && branch.contact_name?.trim())
    .map((branch) => [branch.legacy_branch_profile_id!, branch.contact_name!.trim()]));

  const rowsWithSubmitters: PolicyIntakeWorkspaceRow[] = rows.map((row) => {
    const profileId = row.submitted_by_profile_id;
    const portalAccount = row.submitted_by_portal_account_id
      ? portalAccountById.get(row.submitted_by_portal_account_id)
      : null;
    const portalProfileId = portalAccount?.auth_user_id ?? null;
    const submittedBy = (profileId ? branchContactByProfileId.get(profileId) : null)
      || (profileId ? profileNameById.get(profileId)?.trim() : null)
      || (portalProfileId ? profileNameById.get(portalProfileId)?.trim() : null)
      || (portalAccount ? "Partner contact unavailable" : "Sales user");
    return { ...row, submitted_by_name: submittedBy };
  });
  const duplicateCheck = error ? null : await loadPolicyIntakeDuplicateMatches(admin, rows);
  const workspaceRows = duplicateCheck?.ok
    ? rowsWithSubmitters.map((row) => duplicateCheck.matches.has(row.id) ? { ...row, status: "Duplicate" } : row)
    : [];
  const unavailable = Boolean(error || (duplicateCheck && !duplicateCheck.ok));

  return <AppShell title={reviewer ? "Policy Intakes" : "My Policy Intakes"}>
    {profile.role === "it_super_user" && !unavailable ? <ItSuperUserDeletePanel
      entity="policy_intake"
      title="Delete policy intake record"
      records={workspaceRows.map((intake) => ({
        id: intake.id,
        label: intake.intake_number,
        detail: [intake.status.replaceAll("_", " "), intake.lead_source_name, intake.customer_mobile].filter(Boolean).join(" • "),
      }))}
    /> : null}
    {unavailable ? <div className="mx-auto max-w-[1480px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">Policy Intakes are temporarily unavailable.</div> : <PolicyIntakeWorkspace rows={workspaceRows} reviewer={reviewer} creator={creator} currentProfileId={profile.id} initialView={initialView} />}
  </AppShell>;
}
