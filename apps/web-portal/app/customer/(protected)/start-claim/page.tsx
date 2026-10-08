import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope, loadCustomerWebVehicles, loadCustomerWebPolicies } from "@/lib/customer-web-data";
import { loadCustomerClaims } from "@/lib/customer-web-phase2-data";
import { CustomerStartClaimSelector } from "@/components/customer-portal/customer-start-claim-selector";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerStartClaimPage({ searchParams }: { searchParams?: Promise<{ account?: string; vehicle?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const [vehicles, policies, claims] = await Promise.all([
    loadCustomerWebVehicles(account.id),
    loadCustomerWebPolicies(account.id),
    loadCustomerClaims(account.id),
  ]);
  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/start-claim" />
      <CustomerStartClaimSelector
        accountId={account.id}
        vehicles={vehicles}
        policies={policies}
        existingClaims={claims.map((claim) => ({
          id: claim.id,
          policy_id: claim.policy_id,
          external_policy_id: claim.external_policy_id,
          current_status: claim.current_status,
        }))}
        initialVehicleId={params.vehicle}
      />
    </div>
  );
}
