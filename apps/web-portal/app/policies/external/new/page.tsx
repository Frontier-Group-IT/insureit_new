import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ExternalPolicyForm } from "../external-policy-form";

type CustomerRow = { id: string; contact_name: string; company_name: string | null; phone: string | null };
type VehicleRow = { id: string; customer_id: string; vehicle_no: string; make: string | null; model: string | null };
type InsurerRow = { id: string; name: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewExternalPolicyPage() {
  const profile = await requirePolicyEditor();
  const accessibleCustomerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_policies");
  if (accessibleCustomerIds !== null && !accessibleCustomerIds.length) redirect("/access-denied");

  const admin = createSupabaseAdminClient();
  let customerQuery = admin.from("customers").select("id,contact_name,company_name,phone").order("contact_name", { ascending: true });
  let vehicleQuery = admin.from("vehicles").select("id,customer_id,vehicle_no,make,model").order("vehicle_no", { ascending: true });
  if (accessibleCustomerIds !== null) {
    customerQuery = customerQuery.in("id", accessibleCustomerIds);
    vehicleQuery = vehicleQuery.in("customer_id", accessibleCustomerIds);
  }

  const [customersResult, vehiclesResult, insurersResult] = await Promise.all([
    customerQuery.returns<CustomerRow[]>(),
    vehicleQuery.returns<VehicleRow[]>(),
    admin.from("insurance_companies").select("id,name").eq("is_active", true).order("name", { ascending: true }).returns<InsurerRow[]>(),
  ]);

  if (customersResult.error || vehiclesResult.error || insurersResult.error) throw new Error("Unable to load external policy setup data.");
  const vehiclesByCustomer = new Map<string, VehicleRow[]>();
  for (const vehicle of vehiclesResult.data ?? []) {
    const list = vehiclesByCustomer.get(vehicle.customer_id) ?? [];
    list.push(vehicle);
    vehiclesByCustomer.set(vehicle.customer_id, list);
  }

  const customers = (customersResult.data ?? []).map((customer) => ({
    id: customer.id,
    label: customer.company_name?.trim() ? `${customer.contact_name} — ${customer.company_name}` : customer.contact_name,
    phone: customer.phone,
    vehicles: vehiclesByCustomer.get(customer.id) ?? [],
  }));

  return (
    <AppShell title="Add External Policy" backHref="/policies/external">
      <ExternalPolicyForm mode="create" customers={customers} insurers={insurersResult.data ?? []} />
    </AppShell>
  );
}
