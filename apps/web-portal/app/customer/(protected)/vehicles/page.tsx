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
  const items = vehicles.map(vehicle => {
    const policy = activePolicyByVehicle.get(vehicle.id);
    return {
      id: vehicle.id,
      number: customerDisplayVehicleNo(vehicle),
      make: vehicle.make ?? "",
      model: vehicle.model ?? "",
      type: vehicle.vehicle_type ?? "",
      chassis: vehicle.chassis_no ?? "",
      engine: vehicle.engine_no ?? "",
      policy: policy?.policy_no ?? null,
    };
  });
  return <div className="space-y-3">
    <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/vehicles" />
    <CustomerVehiclesRegister accountId={account.id} items={items} initialQuery={params.q ?? ""} />
  </div>;
}
