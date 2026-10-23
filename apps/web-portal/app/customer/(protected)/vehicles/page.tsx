import { CheckCircle2 } from "lucide-react";
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
    const allPolicies = [...associated].sort((a,b) => {
      const rank = (p: typeof associated[number]) => inactivePolicyStatuses.has((p.status ?? "").trim().toLowerCase()) ? 3 : customerPolicyTone(p.end_date).tone === "active" ? 0 : customerPolicyTone(p.end_date).tone === "due" ? 1 : 2;
      return rank(a)-rank(b) || b.end_date.localeCompare(a.end_date);
    });
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
      policies: allPolicies.map(p => ({ id: p.id, number: p.policy_no || "—", insurerName: p.insurer_name ?? null, status: inactivePolicyStatuses.has((p.status ?? "").trim().toLowerCase()) ? "inactive" as const : customerPolicyTone(p.end_date).tone })),
      insurerName: policy?.insurer_name ?? null,
      status,
    };
  });
  return <div className="space-y-3">
    <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/vehicles" />
    {params.added === "1" ? <div role="status" className="flex items-center gap-2 rounded-xl border border-[#B4E5CE] bg-[#ECFBF3] px-4 py-3 text-sm font-semibold text-[#116747]"><CheckCircle2 className="h-5 w-5"/>Vehicle saved successfully. You can add its policy or start a claim.</div> : null}
    <CustomerVehiclesRegister accountId={account.id} items={items} initialQuery={params.q ?? ""} />
  </div>;
}
