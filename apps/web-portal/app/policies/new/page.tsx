import { addPolicy } from "@/app/master-data-form-actions";
import { PolicyForm } from "@/components/forms";
import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerOption = { id: string; company_name: string | null; contact_name: string };
type VehicleOption = { id: string; vehicle_no: string; customer_id: string };
type InsurerOption = { id: string; name: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPolicyPage() {
  await requireMasterDataManager();
  const admin = createSupabaseAdminClient();

  const [customersResult, vehiclesResult, insurersResult] = await Promise.all([
    admin.from("customers").select("id, company_name, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    admin.from("vehicles").select("id, vehicle_no, customer_id").order("created_at", { ascending: false }).returns<VehicleOption[]>(),
    admin.from("insurance_companies").select("id, name").order("name", { ascending: true }).returns<InsurerOption[]>()
  ]);

  if (customersResult.error) throw new Error(`Unable to load customers: ${customersResult.error.message}`);
  if (vehiclesResult.error) throw new Error(`Unable to load vehicles: ${vehiclesResult.error.message}`);
  if (insurersResult.error) throw new Error(`Unable to load insurers: ${insurersResult.error.message}`);

  const customers = customersResult.data ?? [];
  const customerNameById = new Map(customers.map((customer) => [customer.id, customer.company_name ?? customer.contact_name]));
  const customerOptions = customers.map((customer) => ({ value: customer.id, label: customer.company_name ?? customer.contact_name }));
  const vehicleOptions = (vehiclesResult.data ?? []).map((vehicle) => ({
    value: vehicle.id,
    label: `${vehicle.vehicle_no} — ${customerNameById.get(vehicle.customer_id) ?? "Unassigned customer"}`
  }));
  const insurerOptions = (insurersResult.data ?? []).map((insurer) => ({ value: insurer.id, label: insurer.name }));

  return (
    <AppShell title="Add Policy">
      <PolicyForm action={addPolicy} customers={customerOptions} vehicles={vehicleOptions} insurers={insurerOptions} submitLabel="Create Policy" />
    </AppShell>
  );
}
