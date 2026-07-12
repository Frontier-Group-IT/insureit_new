import { notFound } from "next/navigation";
import { createInsuranceCompany, savePolicy } from "@/app/master-data-form-actions";
import { PolicyForm } from "@/components/policy-form";
import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerOption = { id: string; contact_name: string };
type VehicleOption = { id: string; vehicle_no: string; customer_id: string };
type InsurerOption = { id: string; name: string; branch_name: string | null };
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
    admin.from("customers").select("id, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    admin.from("vehicles").select("id, vehicle_no, customer_id").order("created_at", { ascending: false }).returns<VehicleOption[]>(),
    admin.from("insurance_companies").select("id, name, branch_name").order("name", { ascending: true }).returns<InsurerOption[]>()
  ]);

  if (policyResult.error) throw new Error(`Unable to load policy details: ${policyResult.error.message}`);
  if (!policyResult.data) notFound();
  if (customersResult.error) throw new Error(`Unable to load customers: ${customersResult.error.message}`);
  if (vehiclesResult.error) throw new Error(`Unable to load vehicles: ${vehiclesResult.error.message}`);
  if (insurersResult.error) throw new Error(`Unable to load insurers: ${insurersResult.error.message}`);

  const customerOptions = (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.contact_name }));
  const vehicleOptions = (vehiclesResult.data ?? []).map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicle_no, customerId: vehicle.customer_id }));
  const insurerOptions = (insurersResult.data ?? []).map((insurer) => ({ value: insurer.id, label: insurer.branch_name ? `${insurer.name} — ${insurer.branch_name}` : insurer.name }));

  return (
    <AppShell title="Edit Policy">
      <PolicyForm
        action={savePolicy.bind(null, id)}
        createInsurerAction={createInsuranceCompany}
        customers={customerOptions}
        vehicles={vehicleOptions}
        insurers={insurerOptions}
        values={policyResult.data}
        submitLabel="Save changes"
      />
    </AppShell>
  );
}
