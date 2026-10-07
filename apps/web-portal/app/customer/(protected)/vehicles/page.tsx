import Link from "next/link";
import { CarFront, Search, ShieldCheck } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  EmptyCustomerState,
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

export default async function CustomerVehiclesPage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string; q?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const [vehicles, policies] = await Promise.all([
    loadCustomerWebVehicles(account.id),
    loadCustomerWebPolicies(account.id),
  ]);
  const activePolicyByVehicle = new Map(
    policies
      .filter((policy) => policy.vehicle_id && customerPolicyTone(policy.end_date).tone !== "expired")
      .map((policy) => [policy.vehicle_id as string, policy]),
  );
  const query = params.q?.trim().toLowerCase() ?? "";
  const rows = vehicles.filter((vehicle) => {
    if (!query) return true;
    return [
      customerDisplayVehicleNo(vehicle),
      vehicle.make,
      vehicle.model,
      vehicle.chassis_no,
      vehicle.engine_no,
      vehicle.vehicle_type,
    ].some((value) => value?.toLowerCase().includes(query));
  });

  return (
    <div className="space-y-5">
      <CustomerPageHeading
        eyebrow="My fleet"
        title="Vehicles"
        description="Vehicles linked to your selected Customer account, with current insurance status."
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/vehicles" />

      <form className="flex max-w-xl items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 py-2.5 shadow-[0_6px_18px_rgba(28,50,82,0.03)]">
        <Search className="h-4 w-4 text-[#73829A]" />
        <input type="hidden" name="account" value={account.id} />
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search registration, chassis, make or model"
          className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#10213D] outline-none placeholder:text-[#9AA6B7]"
        />
        <button className="rounded-lg bg-[#142746] px-3 py-1.5 text-[10px] font-black text-white">Search</button>
      </form>

      {rows.length === 0 ? (
        <EmptyCustomerState
          title={vehicles.length ? "No matching vehicles" : "No vehicles found"}
          body={vehicles.length ? "Try a different registration, chassis, make or model." : "Vehicles linked to this Customer account will appear here."}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((vehicle) => {
            const policy = activePolicyByVehicle.get(vehicle.id);
            return (
              <Link
                key={vehicle.id}
                href={{ pathname: `/customer/vehicles/${vehicle.id}`, query: { account: account.id } }}
                className="group rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,0.04)] transition hover:-translate-y-0.5 hover:border-[#B9C9DB]"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#174EA6]"><CarFront className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-[14px] font-black text-[#10213D]">{customerDisplayVehicleNo(vehicle)}</h2>
                      <StatusPill tone={policy ? "active" : "expired"}>{policy ? "Covered" : "No active policy"}</StatusPill>
                    </div>
                    <p className="mt-1 truncate text-[11px] font-semibold text-[#6E7D93]">{[vehicle.make, vehicle.model].filter(Boolean).join(" · ") || vehicle.vehicle_type}</p>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10.5px]">
                      <div><p className="font-bold text-[#8995A8]">Chassis</p><p className="truncate font-black text-[#35445B]">{vehicle.chassis_no || "—"}</p></div>
                      <div><p className="font-bold text-[#8995A8]">Engine</p><p className="truncate font-black text-[#35445B]">{vehicle.engine_no || "—"}</p></div>
                      <div><p className="font-bold text-[#8995A8]">Type</p><p className="truncate font-black text-[#35445B]">{vehicle.vehicle_type || "—"}</p></div>
                      <div>
                        <p className="font-bold text-[#8995A8]">Insurance</p>
                        <p className="inline-flex items-center gap-1 truncate font-black text-[#35445B]"><ShieldCheck className="h-3 w-3" />{policy?.policy_no || "Not active"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
