import { AppShell } from "@/components/shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getIntermediaryGroupEmployeeScope,
  getIntermediaryGroupManager,
  requireIntermediaryGroupViewer,
} from "@/lib/intermediary-group-access";
import {
  BusinessGroupWorkspace,
  type BusinessGroup,
  type BusinessGroupMembership,
  type BusinessGroupPartner,
} from "./business-group-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = { success?: string; error?: string };
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
  source_application_id: string | null;
  parent_partner_id?: string | null;
};
type GroupRow = {
  id: string;
  group_code: string;
  group_name: string;
  group_mode?: "legacy_employee" | "business" | null;
  owner_employee_id: string | null;
  status: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
};

export default async function IntermediaryGroupsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const profile = await requireIntermediaryGroupViewer();
  const [manager, scope] = await Promise.all([
    getIntermediaryGroupManager(),
    getIntermediaryGroupEmployeeScope(profile),
  ]);

  const admin = createSupabaseAdminClient();

  const [
    { data: parentIntermediaries, error: parentError },
    { data: onboardingOwners, error: onboardingError },
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
  ]);

  const branchAwarePartners = await admin
    .from("partners")
    .select("id,partner_code,partner_kind,display_name,source_application_id,parent_partner_id")
    .eq("partner_status", "active_partner")
    .order("display_name")
    .returns<PartnerRow[]>();

  let partnerRows: PartnerRow[] = branchAwarePartners.data ?? [];
  let partnerLoadError = branchAwarePartners.error;
  let partnerHierarchyReady = !branchAwarePartners.error;

  if (branchAwarePartners.error) {
    const fallback = await admin
      .from("partners")
      .select("id,partner_code,partner_kind,display_name,source_application_id")
      .eq("partner_status", "active_partner")
      .order("display_name")
      .returns<PartnerRow[]>();
    partnerRows = (fallback.data ?? []).map((partner) => ({ ...partner, parent_partner_id: null }));
    partnerLoadError = fallback.error;
    partnerHierarchyReady = false;
  }

  const modeAwareGroups = await admin
    .from("intermediary_groups")
    .select("id,group_code,group_name,group_mode,owner_employee_id,status,description,created_at,created_by")
    .eq("status", "active")
    .order("group_name")
    .returns<GroupRow[]>();

  let groupRows: GroupRow[] = modeAwareGroups.data ?? [];
  let groupLoadError = modeAwareGroups.error;
  let groupHierarchyReady = !modeAwareGroups.error;

  if (modeAwareGroups.error) {
    const fallback = await admin
      .from("intermediary_groups")
      .select("id,group_code,group_name,owner_employee_id,status,description,created_at,created_by")
      .eq("status", "active")
      .order("group_name")
      .returns<GroupRow[]>();
    groupRows = (fallback.data ?? []).map((group) => ({ ...group, group_mode: "legacy_employee" as const }));
    groupLoadError = fallback.error;
    groupHierarchyReady = false;
  }

  const allGroupIds = groupRows.map((group) => group.id);
  const allPartnerIds = partnerRows.map((partner) => partner.id);
  const membershipResult = allGroupIds.length && allPartnerIds.length
    ? await admin
        .from("intermediary_group_memberships")
        .select("id,group_id,partner_id,effective_from")
        .in("group_id", allGroupIds)
        .in("partner_id", allPartnerIds)
        .is("effective_to", null)
        .returns<BusinessGroupMembership[]>()
    : { data: [] as BusinessGroupMembership[], error: null };

  const parentOwnerByApplication = new Map(
    (parentIntermediaries ?? [])
      .filter((row): row is ParentIntermediary & { application_id: string } => Boolean(row.application_id))
      .map((row) => [row.application_id, row.associate_employee_id]),
  );
  const onboardingOwnerByApplication = new Map(
    (onboardingOwners ?? []).map((row) => [row.application_id, row.associate_employee_id]),
  );
  const allowedEmployeeIds = new Set(scope.employeeIds);

  const partners: BusinessGroupPartner[] = partnerRows.flatMap((partner) => {
    const applicationId = partner.source_application_id;
    const ownerEmployeeId = applicationId
      ? parentOwnerByApplication.get(applicationId) ?? onboardingOwnerByApplication.get(applicationId) ?? null
      : null;

    if (scope.mode !== "organization" && (!ownerEmployeeId || !allowedEmployeeIds.has(ownerEmployeeId))) return [];

    return [{
      id: partner.id,
      partner_code: partner.partner_code,
      partner_kind: partner.partner_kind,
      display_name: partner.display_name,
      parent_partner_id: partner.parent_partner_id ?? null,
      owner_employee_id: ownerEmployeeId,
    }];
  });

  const visiblePartnerIds = new Set(partners.map((partner) => partner.id));
  const allMemberships = membershipResult.data ?? [];
  const visibleMemberships = allMemberships.filter((membership) => visiblePartnerIds.has(membership.partner_id));
  const visibleMembershipGroupIds = new Set(visibleMemberships.map((membership) => membership.group_id));

  const groups: BusinessGroup[] = groupRows.flatMap((group) => {
    const groupMode = group.group_mode ?? "legacy_employee";
    const visible = scope.mode === "organization"
      || (groupMode === "legacy_employee" && Boolean(group.owner_employee_id && allowedEmployeeIds.has(group.owner_employee_id)))
      || (groupMode === "business" && (group.created_by === profile.id || visibleMembershipGroupIds.has(group.id)));

    if (!visible) return [];
    return [{
      id: group.id,
      group_code: group.group_code,
      group_name: group.group_name,
      group_mode: groupMode,
      owner_employee_id: group.owner_employee_id,
      status: group.status,
      description: group.description,
      created_at: group.created_at,
      created_by: group.created_by,
    }];
  });

  const visibleGroupIds = new Set(groups.map((group) => group.id));
  const memberships = visibleMemberships.filter((membership) => visibleGroupIds.has(membership.group_id));
  const hierarchyReady = partnerHierarchyReady && groupHierarchyReady;
  const loadError = Boolean(parentError || onboardingError || partnerLoadError || groupLoadError || membershipResult.error);

  return (
    <AppShell title="Intermediary Groups" backHref="/intermediaries">
      <BusinessGroupWorkspace
        groups={groups}
        partners={partners}
        memberships={memberships}
        canManage={Boolean(manager)}
        hierarchyReady={hierarchyReady}
        success={query.success}
        error={query.error}
        loadError={loadError}
      />
    </AppShell>
  );
}
