import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getOperationsDashboardData } from "@/lib/operations-dashboard";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { getDashboardCurrentData, type DashboardAccess } from "./dashboard-data";
import { getDashboardBusinessData, type DashboardBusinessQuery } from "./dashboard-business";
import { DashboardFullyLoaded } from "./dashboard-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardV2Page({ searchParams }: { searchParams: Promise<DashboardBusinessQuery> }) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const accessToken = await getServerAccessToken();
  const [{ profile }, base] = await Promise.all([
    getAuthenticatedProfile(accessToken),
    getOperationsDashboardData(supabase),
  ]);

  const [
    viewPolicies,
    editPolicies,
    createPolicies,
    viewVehicles,
    viewClaims,
    viewIntermediaries,
    viewPolicyIntakes,
    reviewPolicyIntakes,
    createPolicyIntakes,
    viewCustomers,
    viewTasks,
    viewKyc,
    accountsCapability,
  ] = await Promise.all([
    hasEffectiveCapability(profile, "view_policies", "view"),
    hasEffectiveCapability(profile, "view_policies", "edit"),
    hasEffectiveCapability(profile, "create_policies", "edit"),
    hasEffectiveCapability(profile, "view_vehicles", "view"),
    hasEffectiveCapability(profile, "view_claims", "view"),
    hasEffectiveCapability(profile, "view_intermediaries", "view"),
    hasEffectiveCapability(profile, "view_policy_intakes", "view"),
    hasEffectiveCapability(profile, "review_policy_intakes", "edit"),
    hasEffectiveCapability(profile, "create_policy_intakes", "edit"),
    hasEffectiveCapability(profile, "view_customers", "view"),
    hasEffectiveCapability(profile, "view_tasks", "view"),
    hasEffectiveCapability(profile, "view_kyc", "view"),
    hasEffectiveCapability(profile, "view_accounts", "view"),
  ]);

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