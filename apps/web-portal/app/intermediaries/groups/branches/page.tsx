import { AppShell } from "@/components/shell";
import {
  getIntermediaryGroupEmployeeScope,
  getIntermediaryGroupManager,
  requireIntermediaryGroupViewer,
} from "@/lib/intermediary-group-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { BranchRegisterWorkspace, type BranchRegisterRow } from "./branch-register-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ParentIntermediary = {
  application_id: string | null;
  associate_employee_id: string | null;
};

type OnboardingOwner = {
  application_id: string;
  associate_employee_id: string | null;
};

type PartnerRow = {
  id: string;
  partner_code: string;
  partner_kind: string;
  display_name: string;
  partner_status: string;
  source_application_id: string | null;
  parent_partner_id: string | null;
};

type BranchProfileRow = {
  partner_id: string;
  created_by: string | null;
};

type GroupRow = {
  id: string;
  group_code: string;
  group_name: string;
};

type MembershipRow = {
  group_id: string;
  partner_id: string;
};

type EmployeeRow = {
  id: string;
  employee_code: string;
  full_name: string;
};

export default async function BranchRegisterPage() {
  const profile = await requireIntermediaryGroupViewer();
  const scope = await getIntermediaryGroupEmployeeScope(profile);
  const manager = await getIntermediaryGroupManager();
  const admin = createSupabaseAdminClient();

  const [
    { data: parentIntermediaries, error: parentError },
    { data: onboardingOwners, error: onboardingError },
    { data: partnerRows, error: partnerError },
    { data: branchProfiles, error: branchProfileError },
    { data: groups, error: groupError },
    { data: employees, error: employeeError },
  ] = await Promise.all([
    admin
      .from("intermediaries")
      .select("application_id,associate_employee_id")
      .eq("intermediary_type", "partner")
      .returns<ParentIntermediary[]>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("application_id,associate_employee_id")
      .returns<OnboardingOwner[]>(),
    admin
      .from("partners")
      .select("id,partner_code,partner_kind,display_name,partner_status,source_application_id,parent_partner_id")
      .order("display_name")
      .returns<PartnerRow[]>(),
    admin
      .from("partner_branch_profiles")
      .select("partner_id,created_by")
      .returns<BranchProfileRow[]>(),
    admin
      .from("intermediary_groups")
      .select("id,group_code,group_name")
      .eq("status", "active")
      .order("group_name")
      .returns<GroupRow[]>(),
    admin
      .from("employees")
      .select("id,employee_code,full_name")
      .eq("employment_status", "active")
      .order("full_name")
      .returns<EmployeeRow[]>(),
  ]);

  const parentOwnerByApplication = new Map(
    (parentIntermediaries ?? [])
      .filter((row): row is ParentIntermediary & { application_id: string } => Boolean(row.application_id))
      .map((row) => [row.application_id, row.associate_employee_id]),
  );
  const onboardingOwnerByApplication = new Map(
    (onboardingOwners ?? []).map((row) => [row.application_id, row.associate_employee_id]),
  );
  const partnerById = new Map((partnerRows ?? []).map((partner) => [partner.id, partner]));
  const branchProfileByPartner = new Map((branchProfiles ?? []).map((profileRow) => [profileRow.partner_id, profileRow]));
  const employeeById = new Map((employees ?? []).map((employee) => [employee.id, employee]));
  const groupById = new Map((groups ?? []).map((group) => [group.id, group]));

  const rootPartnerIds = (partnerRows ?? [])
    .filter((partner) => !partner.parent_partner_id)
    .map((partner) => partner.id);
  const membershipResult = rootPartnerIds.length
    ? await admin
        .from("intermediary_group_memberships")
        .select("group_id,partner_id")
        .in("partner_id", rootPartnerIds)
        .is("effective_to", null)
        .returns<MembershipRow[]>()
    : { data: [] as MembershipRow[], error: null };
  const membershipByPartner = new Map((membershipResult.data ?? []).map((membership) => [membership.partner_id, membership]));

  const allowedEmployeeIds = new Set(scope.employeeIds);
  const rows: BranchRegisterRow[] = (partnerRows ?? []).flatMap((branch) => {
    if (!branchProfileByPartner.has(branch.id)) return [];

    const parent = branch.parent_partner_id ? partnerById.get(branch.parent_partner_id) ?? null : null;
    const ownerApplicationId = parent?.source_application_id ?? branch.source_application_id;
    const ownerEmployeeId = ownerApplicationId
      ? parentOwnerByApplication.get(ownerApplicationId) ?? onboardingOwnerByApplication.get(ownerApplicationId) ?? null
      : null;
    const branchCreatedByViewer = branchProfileByPartner.get(branch.id)?.created_by === profile.id;

    if (
      scope.mode !== "organization"
      && (!ownerEmployeeId || !allowedEmployeeIds.has(ownerEmployeeId))
      && !branchCreatedByViewer
    ) return [];

    const membership = parent ? membershipByPartner.get(parent.id) ?? null : null;
    const group = membership ? groupById.get(membership.group_id) ?? null : null;
    const employee = ownerEmployeeId ? employeeById.get(ownerEmployeeId) ?? null : null;

    return [{
      id: branch.id,
      branch_code: branch.partner_code,
      branch_name: branch.display_name,
      branch_kind: branch.partner_kind,
      branch_status: branch.partner_status,
      parent_partner_id: parent?.id ?? null,
      parent_partner_code: parent?.partner_code ?? null,
      parent_partner_name: parent?.display_name ?? null,
      group_code: group?.group_code ?? null,
      group_name: group?.group_name ?? null,
      employee_code: employee?.employee_code ?? null,
      employee_name: employee?.full_name ?? null,
    }];
  });

  const loadError = Boolean(
    parentError
    || onboardingError
    || partnerError
    || branchProfileError
    || groupError
    || employeeError
    || membershipResult.error,
  );

  return (
    <AppShell title="Branch Register" backHref="/intermediaries/groups">
      <div className="mx-auto max-w-[1480px]">
        <BranchRegisterWorkspace rows={rows} canManage={Boolean(manager)} loadError={loadError} />
      </div>
    </AppShell>
  );
}
