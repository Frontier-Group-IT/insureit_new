import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { accessRank, getEffectivePermissionAccessMap } from "@/lib/effective-permissions";
import { loadLifeHealthCaseSummary } from "@/lib/life-health-case-summary";
import { getOperationsDashboardData } from "@/lib/operations-dashboard";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getDashboardCurrentData, type DashboardAccess } from "../dashboard-v2/dashboard-data";
import { getDashboardBusinessData, type DashboardBusinessQuery } from "../dashboard-v2/dashboard-business";
import { DashboardRegisterSync } from "../dashboard-v2/dashboard-register-sync";
import { DashboardFullyLoaded } from "../dashboard-v2/dashboard-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardBusinessQuery> }) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const [base, permissionMap] = await Promise.all([
    getOperationsDashboardData(supabase, profile),
    getEffectivePermissionAccessMap(profile),
  ]);
  const can = (
    capability: keyof typeof permissionMap,
    minimum: "view" | "edit" | "approve" = "view",
  ) => accessRank[permissionMap[capability] ?? "none"] >= accessRank[minimum];

  const isDownlineHead = profile?.role === "operations_head_life";
  const viewPolicies = can("view_policies");
  const editPolicies = can("view_policies", "edit");
  const createPolicies = can("create_policies", "edit");
  const viewVehicles = can("view_vehicles");
  const viewClaims = can("view_claims");
  const viewIntermediaries = can("view_intermediaries");
  const viewPolicyIntakes = can("view_policy_intakes");
  const reviewPolicyIntakes = can("review_policy_intakes", "edit");
  const createPolicyIntakes = can("create_policy_intakes", "edit");
  const viewCustomers = can("view_customers");
  const viewTasks = can("view_tasks");
  const viewKyc = can("view_kyc");
  const accountsCapability = can("view_accounts");
  const viewReports = can("view_reports");

  // This role sees policy commercials only inside per-policy downline analytics.
  const commercial = isDownlineHead || canAccessPolicyCommercials(profile);
  const isRelationshipManager = profile?.role === "relationship_manager";
  const dashboardCommercialAccess = commercial || isRelationshipManager;
  const dashboardCommercialOperationsAccess = !isRelationshipManager && accountsCapability && commercial;
  const access: DashboardAccess = {
    viewPolicies,
    viewVehicles,
    viewClaims,
    viewIntermediaries,
    viewPolicyIntakes,
    reviewPolicyIntakes,
    viewCustomers,
    viewTasks,
    viewKyc,
    viewAccounts: accountsCapability && commercial,
    viewReports,
    commercial,
  };

  if (isDownlineHead) {
    // Keep the default dashboard component and arrangement, but suppress
    // unrelated fleet/claims/tasks/accounts modules and global summaries.
    access.viewVehicles = false;
    access.viewClaims = false;
    access.viewIntermediaries = false;
    access.viewPolicyIntakes = false;
    access.reviewPolicyIntakes = false;
    access.viewCustomers = false;
    access.viewTasks = false;
    access.viewKyc = false;
    access.viewAccounts = false;
    access.viewReports = false;
    access.commercial = true;
  }

  const proposalSummaryRequest = viewPolicies && !isDownlineHead
    ? loadLifeHealthCaseSummary(createSupabaseAdminClient())
    : Promise.resolve(null);

  const [data, business, proposalSummary] = await Promise.all([
    getDashboardCurrentData(profile, access, base),
    getDashboardBusinessData(profile, query, isDownlineHead || dashboardCommercialAccess, !isDownlineHead && dashboardCommercialOperationsAccess),
    proposalSummaryRequest,
  ]);

  return (
    <ClaimManagerShell title="Operations Overview" activeNav="dashboard">
      <DashboardFullyLoaded
        data={data}
        access={access}
        business={business}
        canCreatePolicy={isDownlineHead || createPolicies || editPolicies}
        canCreatePolicyIntake={createPolicyIntakes}
        showRmPerformanceButton={viewReports && !isRelationshipManager}
      />
      <DashboardRegisterSync proposalPending={proposalSummary?.pending ?? 0} />
    </ClaimManagerShell>
  );
}