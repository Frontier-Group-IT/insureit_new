import Link from "next/link";
import { ArrowRight, CarFront, ShieldCheck } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  MetricCard,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import {
  customerDisplayVehicleNo,
  customerPolicyTone,
  loadCustomerWebPolicies,
  loadCustomerWebVehicles,
  resolveCustomerWebScope,
} from "@/lib/customer-web-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const [vehicles, policies] = await Promise.all([
    loadCustomerWebVehicles(account.id),
    loadCustomerWebPolicies(account.id),
  ]);

  const currentPolicies = policies.filter((policy) => customerPolicyTone(policy.end_date).tone !== "expired");
  const activeVehicleIds = new Set(currentPolicies.map((policy) => policy.vehicle_id).filter(Boolean));
  const protectedVehicles = vehicles.filter((vehicle) => activeVehicleIds.has(vehicle.id)).length;
  const duePolicies = policies.filter((policy) => customerPolicyTone(policy.end_date).tone === "due");
  const expiredPolicies = policies.filter((policy) => customerPolicyTone(policy.end_date).tone === "expired");
  const coverage = vehicles.length ? Math.round((protectedVehicles / vehicles.length) * 100) : 0;
  const accountQuery = { account: account.id };

  return (
    <div className="space-y-5">
      <CustomerPageHeading
        eyebrow="Customer dashboard"
        title={`Welcome, ${account.contact_name?.split(" ")[0] || "Customer"}`}
        description="Your fleet and insurance portfolio from the same Customer account used in the mobile app."
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/home" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Vehicles" value={vehicles.length} helper="Linked to this Customer account" />
        <MetricCard label="Active cover" value={currentPolicies.length} helper="Policies not yet expired" />
        <MetricCard label="Renewal due" value={duePolicies.length} helper="Expiring within 30 days" />
        <MetricCard label="Fleet covered" value={`${coverage}%`} helper={`${protectedVehicles} of ${vehicles.length} vehicles`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#718096]">Fleet snapshot</p>
              <h2 className="mt-1 text-[17px] font-black text-[#10213D]">Your vehicles</h2>
            </div>
            <Link href={{ pathname: "/customer/vehicles", query: accountQuery }} className="inline-flex items-center gap-1 text-[11px] font-black text-[#174EA6]">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 grid gap-2">
            {vehicles.slice(0, 4).map((vehicle) => {
              const covered = activeVehicleIds.has(vehicle.id);
              return (
                <Link
                  key={vehicle.id}
                  href={{ pathname: `/customer/vehicles/${vehicle.id}`, query: accountQuery }}
                  className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#FBFCFE] px-3 py-3 transition hover:border-[#B8C7DA] hover:bg-white"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#174EA6]"><CarFront className="h-4.5 w-4.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-black text-[#10213D]">{customerDisplayVehicleNo(vehicle)}</span>
                    <span className="block truncate text-[10px] font-semibold text-[#74839A]">{[vehicle.make, vehicle.model].filter(Boolean).join(" · ") || vehicle.vehicle_type}</span>
                  </span>
                  <StatusPill tone={covered ? "active" : "expired"}>{covered ? "Covered" : "No active policy"}</StatusPill>
                </Link>
              );
            })}
            {vehicles.length === 0 ? <p className="py-8 text-center text-[11px] font-semibold text-[#718096]">No vehicles are linked to this Customer account yet.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#718096]">Insurance snapshot</p>
              <h2 className="mt-1 text-[17px] font-black text-[#10213D]">Policies</h2>
            </div>
            <Link href={{ pathname: "/customer/policies", query: accountQuery }} className="inline-flex items-center gap-1 text-[11px] font-black text-[#174EA6]">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {policies.slice(0, 4).map((policy) => {
              const status = customerPolicyTone(policy.end_date);
              return (
                <Link
                  key={`${policy.source}:${policy.id}`}
                  href={{ pathname: `/customer/policies/${policy.id}`, query: { account: account.id, source: policy.source } }}
                  className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#FBFCFE] px-3 py-3 transition hover:border-[#B8C7DA] hover:bg-white"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#174EA6]"><ShieldCheck className="h-4.5 w-4.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-black text-[#10213D]">{policy.policy_no}</span>
                    <span className="block truncate text-[10px] font-semibold text-[#74839A]">{policy.insurer_name || policy.policy_type}</span>
                  </span>
                  <StatusPill tone={status.tone}>{status.tone === "due" ? `Due ${status.days}d` : status.tone}</StatusPill>
                </Link>
              );
            })}
            {policies.length === 0 ? <p className="py-8 text-center text-[11px] font-semibold text-[#718096]">No policies are available for this Customer account yet.</p> : null}
          </div>
        </section>
      </div>

      {expiredPolicies.length > 0 ? (
        <div className="rounded-2xl border border-[#F1D6D6] bg-[#FFF8F8] px-4 py-3 text-[11px] font-semibold text-[#8F3A3A]">
          {expiredPolicies.length} expired polic{expiredPolicies.length === 1 ? "y" : "ies"} in this account. Open Policies for details.
        </div>
      ) : null}
    </div>
  );
}
