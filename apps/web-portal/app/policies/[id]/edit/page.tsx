import { notFound } from "next/navigation";
import { createInsuranceCompany, savePolicy } from "@/app/master-data-form-actions";
import { PolicyForm } from "@/components/policy-form";
import { AppShell } from "@/components/shell";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerOption = { id: string; contact_name: string };
type VehicleOption = { id: string; vehicle_no: string; customer_id: string };
type InsurerOption = { id: string; name: string; is_active: boolean };
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
  await requirePolicyEditor();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const policyResult = await admin
    .from("policies")
    .select("customer_id, vehicle_id, insurance_company_id, policy_no, policy_type, insured_declared_value, start_date, end_date")
    .eq("id", id)
    .maybeSingle<PolicyValues>();

  if (policyResult.error) throw new Error(`Unable to load policy details: ${policyResult.error.message}`);
  if (!policyResult.data) notFound();

  const currentInsurerId = policyResult.data.insurance_company_id;
  const [customersResult, vehiclesResult, activeInsurersResult, currentInsurerResult] = await Promise.all([
    admin.from("customers").select("id, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    admin.from("vehicles").select("id, vehicle_no, customer_id").order("created_at", { ascending: false }).returns<VehicleOption[]>(),
    admin.from("insurance_companies").select("id, name, is_active").eq("is_active", true).order("name", { ascending: true }).returns<InsurerOption[]>(),
    admin.from("insurance_companies").select("id, name, is_active").eq("id", currentInsurerId).maybeSingle<InsurerOption>()
  ]);

  if (customersResult.error) throw new Error(`Unable to load customers: ${customersResult.error.message}`);
  if (vehiclesResult.error) throw new Error(`Unable to load vehicles: ${vehiclesResult.error.message}`);
  if (activeInsurersResult.error) throw new Error(`Unable to load insurers: ${activeInsurersResult.error.message}`);
  if (currentInsurerResult.error) throw new Error(`Unable to load the policy insurer: ${currentInsurerResult.error.message}`);

  const customerOptions = (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.contact_name }));
  const vehicleOptions = (vehiclesResult.data ?? []).map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicle_no, customerId: vehicle.customer_id }));
  const insurerById = new Map<string, InsurerOption>();
  for (const insurer of activeInsurersResult.data ?? []) insurerById.set(insurer.id, insurer);
  if (currentInsurerResult.data) insurerById.set(currentInsurerResult.data.id, currentInsurerResult.data);
  const insurerOptions = Array.from(insurerById.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((insurer) => ({ value: insurer.id, label: insurer.is_active ? insurer.name : `${insurer.name} — Inactive` }));

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
