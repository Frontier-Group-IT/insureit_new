import Link from "next/link";
import { Search } from "lucide-react";
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
    <div className="space-y-3">
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

      {rows.length === 0 ? <EmptyCustomerState title="No matching vehicles" body="Try another registration, chassis or model." /> : (
        <div className="overflow-x-auto rounded-xl border border-[#D8E1EC] bg-white">
          <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
            <thead className="bg-[#F1F5FA] text-[10px] font-extrabold uppercase text-[#687991]"><tr>
              {["Vehicle no.","Make / model","Type","Chassis no.","Engine no.","Active policy","Cover status",""].map(h=><th key={h} scope="col" className="border-b border-[#DCE5EF] px-3 py-3">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#E7EDF5]">{rows.map(vehicle=>{const policy=activePolicyByVehicle.get(vehicle.id);return <tr key={vehicle.id} className="hover:bg-[#F6F9FE]">
              <td className="px-3 py-2.5 font-extrabold text-[#133C73]">{customerDisplayVehicleNo(vehicle)}</td>
              <td className="px-3 py-2.5 font-semibold">{[vehicle.make,vehicle.model].filter(Boolean).join(" · ")||"—"}</td>
              <td className="px-3 py-2.5">{vehicle.vehicle_type||"—"}</td>
              <td className="px-3 py-2.5">{vehicle.chassis_no||"—"}</td>
              <td className="px-3 py-2.5">{vehicle.engine_no||"—"}</td>
              <td className="px-3 py-2.5 font-bold">{policy?.policy_no||"—"}</td>
              <td className="px-3 py-2.5"><StatusPill tone={policy?"active":"expired"}>{policy?"Covered":"No active policy"}</StatusPill></td>
              <td className="px-3 py-2.5"><Link href={{pathname:`/customer/vehicles/${vehicle.id}`,query:{account:account.id}}} className="font-extrabold text-[#1754A5] hover:underline">View →</Link></td>
            </tr>})}</tbody>
          </table>
        </div>
      )}
