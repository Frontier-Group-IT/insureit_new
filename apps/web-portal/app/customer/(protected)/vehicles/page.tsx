import Link from "next/link";
import { Plus, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
import { CustomerVehiclesRegister } from "./customer-vehicles-register";
import {
  CustomerAccountTabs,
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
  searchParams?: Promise<{ account?: string; q?: string; added?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const [vehicles, policies] = await Promise.all([
    loadCustomerWebVehicles(account.id),
    loadCustomerWebPolicies(account.id),
  ]);
  const policiesByVehicle = new Map<string, typeof policies>();
  for (const policy of policies) {
    if (!policy.vehicle_id) continue;
    const related = policiesByVehicle.get(policy.vehicle_id) ?? [];
    related.push(policy);
    policiesByVehicle.set(policy.vehicle_id, related);
  }
  const inactivePolicyStatuses = new Set(["superseded", "cancelled", "canceled", "rejected", "void", "inactive"]);
  const items = vehicles.map(vehicle => {
    const associated = policiesByVehicle.get(vehicle.id) ?? [];
    const eligible = associated.filter(policy => !inactivePolicyStatuses.has((policy.status ?? "").trim().toLowerCase()));
    const active = eligible.filter(policy => customerPolicyTone(policy.end_date).tone !== "expired");
    const priority = { active: 2, due: 1, expired: 0 };
    active.sort((a, b) => priority[customerPolicyTone(b.end_date).tone] - priority[customerPolicyTone(a.end_date).tone]);
    const policy = active[0];
    const status: "due" | "active" | "inactive" | "expired" = policy ? customerPolicyTone(policy.end_date).tone : eligible.length ? "expired" : "inactive";
    return {
      id: vehicle.id,
      number: customerDisplayVehicleNo(vehicle),
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      type: vehicle.vehicle_type ?? "",
      chassis: vehicle.chassis_no ?? "",
      engine: vehicle.engine_no ?? "",
      policy: policy?.policy_no ?? null,
      status,
    };
  });
  return <div className="space-y-3">
    <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/vehicles" />
    {params.added === "1" ? <div role="status" className="flex items-center gap-2 rounded-xl border border-[#B4E5CE] bg-[#ECFBF3] px-4 py-3 text-sm font-semibold text-[#116747]"><CheckCircle2 className="h-5 w-5"/>Vehicle saved successfully. You can add its policy or start a claim.</div> : null}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D8E5F3] bg-white p-3"><h2 className="text-base font-bold text-[#17345D]">My Vehicles</h2><div className="flex flex-wrap gap-2"><Link href={{pathname:"/customer/add-vehicle",query:{account:account.id}}} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1756A9] px-3 py-2 text-xs font-bold text-white"><Plus className="h-4 w-4"/>Add Vehicle</Link><Link href={{pathname:"/customer/add-policy",query:{account:account.id}}} className="inline-flex items-center gap-1.5 rounded-lg border border-[#CEDDEE] px-3 py-2 text-xs font-bold text-[#1756A9]"><FileText className="h-4 w-4"/>Add Policy</Link><Link href={{pathname:"/customer/start-claim",query:{account:account.id}}} className="inline-flex items-center gap-1.5 rounded-lg border border-[#CEDDEE] px-3 py-2 text-xs font-bold text-[#1756A9]"><ShieldCheck className="h-4 w-4"/>Start Claim</Link></div></div>
    <CustomerVehiclesRegister accountId={account.id} items={items} initialQuery={params.q ?? ""} />
  </div>;
}
