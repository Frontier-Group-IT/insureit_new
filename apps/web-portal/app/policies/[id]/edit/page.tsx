import { notFound } from "next/navigation";
import { savePolicy } from "@/app/master-data-form-actions";
import { PolicyForm } from "@/components/forms";
import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerOption = { id: string; company_name: string | null; contact_name: string };
type VehicleOption = { id: string; vehicle_no: string; customer_id: string };
type InsurerOption = { id: string; name: string };
type PolicyValues = {
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string;
  insured_declared_value: number | null;
  start_date: string;
  end_date: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMasterDataManager();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const [policyResult, customersResult, vehiclesResult, insurersResult] = await Promise.all([
    admin.from("policies").select("customer_id, vehicle_id, insurance_company_id, policy_no, policy_type, insured_declared_value, start_date, end_date").eq("id", id).maybeSingle<PolicyValues>(),
    admin.from("customers").select("id, company_name, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    admin.from("vehicles").select("id, vehicle_no, customer_id").order("created_at", { ascending: false }).returns<VehicleOption[]>(),
    admin.from("insurance_companies").select("id, name").order("name", { ascending: true }).returns<InsurerOption[]>()
  ]);

  if (policyResult.error) throw new Error(`Unable to load policy details: ${policyResult.error.message}`);
  if (!policyResult.data) notFound();
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
    <AppShell title="Edit Policy">
      <PolicyForm
        action={savePolicy.bind(null, id)}
        customers={customerOptions}
        vehicles={vehicleOptions}
        insurers={insurerOptions}
        values={policyResult.data}
        submitLabel="Save changes"
      />
    </AppShell>
  );
}
