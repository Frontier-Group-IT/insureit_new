import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { accessRank, getEffectivePermissionAccessMap } from "@/lib/effective-permissions";
import { getOperationsDashboardData } from "@/lib/operations-dashboard";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { getDashboardCurrentData, type DashboardAccess } from "../dashboard-v2/dashboard-data";
import { getDashboardBusinessData, type DashboardBusinessQuery } from "../dashboard-v2/dashboard-business";
import { DashboardFullyLoaded } from "../dashboard-v2/dashboard-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardBusinessQuery> }) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const base = await getOperationsDashboardData(supabase, profile);

  const permissionMap = await getEffectivePermissionAccessMap(profile);
  const can = (
    capability: keyof typeof permissionMap,
    minimum: "view" | "edit" | "approve" = "view",
  ) => accessRank[permissionMap[capability] ?? "none"] >= accessRank[minimum];

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

  const commercial = canAccessPolicyCommercials(profile);
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
    commercial,
  };

  const [data, business] = await Promise.all([
    getDashboardCurrentData(profile, access, base),
    getDashboardBusinessData(profile, query, commercial, accountsCapability && commercial),
  ]);

  return (
    <ClaimManagerShell title="Operations Overview" activeNav="dashboard">
      <DashboardFullyLoaded
        data={data}
        access={access}
        business={business}
        canCreatePolicy={createPolicies || editPolicies}
        canCreatePolicyIntake={createPolicyIntakes}
      />
    </ClaimManagerShell>
  );
}