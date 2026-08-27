import { AppShell } from "@/components/shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getIntermediaryGroupEmployeeScope,
  getIntermediaryGroupManager,
  getIntermediaryGroupTransferManager,
  requireIntermediaryGroupViewer,
} from "@/lib/intermediary-group-access";
import {
  IntermediaryGroupWorkspace,
  type GroupWorkspaceEmployee,
  type GroupWorkspaceGroup,
  type GroupWorkspaceMembership,
  type GroupWorkspacePartner,
} from "./intermediary-group-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = { success?: string; error?: string };
type ParentIntermediary = {
  id: string;
  application_id: string | null;
  intermediary_code: string | null;
  display_name: string;
  associate_employee_id: string | null;
};
type OnboardingOwner = { application_id: string; associate_employee_id: string | null };
type PartnerRow = {
  id: string;
  partner_code: string;
  partner_kind: string;
  display_name: string;
  source_application_id: string | null;
};

export default async function IntermediaryGroupsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const profile = await requireIntermediaryGroupViewer();
  const [manager, transferManager, scope] = await Promise.all([
    getIntermediaryGroupManager(),
    getIntermediaryGroupTransferManager(),
    getIntermediaryGroupEmployeeScope(profile),
  ]);

  const admin = createSupabaseAdminClient();

  let employeeRequest = admin
    .from("employees")
    .select("id,employee_code,full_name,designation")
    .eq("employment_status", "active")
    .order("full_name");
  if (scope.mode !== "organization") {
    employeeRequest = scope.employeeIds.length
      ? employeeRequest.in("id", scope.employeeIds)
      : employeeRequest.in("id", ["00000000-0000-0000-0000-000000000000"]);
  }

  let groupRequest = admin
    .from("intermediary_groups")
    .select("id,group_code,group_name,owner_employee_id,status,description,created_at")
    .eq("status", "active")
    .order("group_name");
  if (scope.mode !== "organization") {
    groupRequest = scope.employeeIds.length
      ? groupRequest.in("owner_employee_id", scope.employeeIds)
      : groupRequest.in("owner_employee_id", ["00000000-0000-0000-0000-000000000000"]);
  }

  const [
    { data: employees },
    { data: parentIntermediaries },
    { data: onboardingOwners },
    { data: partnerRows, error: partnerLoadError },
    { data: groups, error: groupLoadError },
  ] = await Promise.all([
    employeeRequest.returns<GroupWorkspaceEmployee[]>(),
    admin
      .from("intermediaries")
      .select("id,application_id,intermediary_code,display_name,associate_employee_id")
      .eq("intermediary_type", "partner")
      .order("display_name")
      .returns<ParentIntermediary[]>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("application_id,associate_employee_id")
      .returns<OnboardingOwner[]>(),
    admin
      .from("partners")
      .select("id,partner_code,partner_kind,display_name,source_application_id")
      .order("display_name")
      .returns<PartnerRow[]>(),
    groupRequest.returns<GroupWorkspaceGroup[]>(),
  ]);

  const parentByApplication = new Map(
    (parentIntermediaries ?? [])
      .filter((row): row is ParentIntermediary & { application_id: string } => Boolean(row.application_id))
      .map((row) => [row.application_id, row]),
  );
  const onboardingOwnerByApplication = new Map(
    (onboardingOwners ?? []).map((row) => [row.application_id, row.associate_employee_id]),
  );
  const scopedEmployeeIds = new Set(scope.employeeIds);

  const partners: GroupWorkspacePartner[] = (partnerRows ?? []).flatMap((partner) => {
    const sourceApplicationId = partner.source_application_id;
    if (!sourceApplicationId) return [];

    const parentIntermediary = parentByApplication.get(sourceApplicationId) ?? null;
    const ownerEmployeeId =
      parentIntermediary?.associate_employee_id ??
      onboardingOwnerByApplication.get(sourceApplicationId) ??
      null;

    if (!ownerEmployeeId) return [];
    if (scope.mode !== "organization" && !scopedEmployeeIds.has(ownerEmployeeId)) return [];

    return [{
      ...partner,
      owner_employee_id: ownerEmployeeId,
      registration_code: parentIntermediary?.intermediary_code ?? null,
    }];
  });

  const groupIds = (groups ?? []).map((group) => group.id);
  const partnerIds = partners.map((partner) => partner.id);
  const { data: memberships } =
    groupIds.length && partnerIds.length
      ? await admin
          .from("intermediary_group_memberships")
          .select("id,group_id,partner_id,effective_from")
          .in("group_id", groupIds)
          .in("partner_id", partnerIds)
          .is("effective_to", null)
          .returns<GroupWorkspaceMembership[]>()
      : { data: [] as GroupWorkspaceMembership[] };

  return (
    <AppShell title="Intermediary Groups" backHref="/intermediaries">
      <IntermediaryGroupWorkspace
        employees={employees ?? []}
        groups={groups ?? []}
        partners={partners}
        memberships={memberships ?? []}
        canManage={Boolean(manager)}
        canTransfer={Boolean(transferManager)}
        defaultOwnerEmployeeId={profile.employee_id ?? ""}
        success={query.success}
        error={query.error}
        loadError={Boolean(groupLoadError || partnerLoadError)}
      />
    </AppShell>
  );
}
