import { addPolicy, createInsuranceCompany } from "@/app/master-data-form-actions";
import { PolicyForm } from "@/components/policy-form";
import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerOption = { id: string; contact_name: string };
type VehicleOption = { id: string; vehicle_no: string; customer_id: string };
type InsurerOption = { id: string; name: string; branch_name: string | null };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPolicyPage() {
  await requireMasterDataManager();
  const admin = createSupabaseAdminClient();

  const [customersResult, vehiclesResult, insurersResult] = await Promise.all([
    admin.from("customers").select("id, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    admin.from("vehicles").select("id, vehicle_no, customer_id").order("created_at", { ascending: false }).returns<VehicleOption[]>(),
    admin.from("insurance_companies").select("id, name, branch_name").order("name", { ascending: true }).returns<InsurerOption[]>()
  ]);

  if (customersResult.error) throw new Error(`Unable to load customers: ${customersResult.error.message}`);
  if (vehiclesResult.error) throw new Error(`Unable to load vehicles: ${vehiclesResult.error.message}`);
  if (insurersResult.error) throw new Error(`Unable to load insurers: ${insurersResult.error.message}`);

  const customerOptions = (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.contact_name }));
  const vehicleOptions = (vehiclesResult.data ?? []).map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicle_no, customerId: vehicle.customer_id }));
  const insurerOptions = (insurersResult.data ?? []).map((insurer) => ({ value: insurer.id, label: insurer.branch_name ? `${insurer.name} — ${insurer.branch_name}` : insurer.name }));

  return (
    <AppShell title="Add Policy">
      <PolicyForm action={addPolicy} createInsurerAction={createInsuranceCompany} customers={customerOptions} vehicles={vehicleOptions} insurers={insurerOptions} submitLabel="Create Policy" />
    </AppShell>
  );
}
