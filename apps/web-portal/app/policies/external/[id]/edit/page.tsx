import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ExternalPolicyForm, type ExternalPolicyInitialValues } from "../../external-policy-form";

type ExternalPolicyRow = {
  id: string;
  customer_id: string;
  vehicle_id: string;
  insurance_company_id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  premium_amount: number | null;
  insured_declared_value: number | null;
};
type CustomerRow = { id: string; contact_name: string; company_name: string | null; phone: string | null };
type VehicleRow = { id: string; customer_id: string; vehicle_no: string; make: string | null; model: string | null; vehicle_type: string | null };
type InsurerRow = { id: string; name: string; is_active: boolean };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditExternalPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePolicyEditor();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: policy, error: policyError } = await admin.from("external_policies")
    .select("id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,start_date,end_date,premium_amount,insured_declared_value")
    .eq("id", id)
    .maybeSingle<ExternalPolicyRow>();
  if (policyError) throw new Error(`Unable to load external policy: ${policyError.message}`);
  if (!policy) notFound();

  const accessibleCustomerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_policies");
  if (accessibleCustomerIds !== null && !accessibleCustomerIds.includes(policy.customer_id)) redirect("/access-denied");

  let customerQuery = admin.from("customers").select("id,contact_name,company_name,phone").order("contact_name", { ascending: true });
  let vehicleQuery = admin.from("vehicles").select("id,customer_id,vehicle_no,make,model,vehicle_type").order("vehicle_no", { ascending: true });
  if (accessibleCustomerIds !== null) {
    customerQuery = customerQuery.in("id", accessibleCustomerIds);
    vehicleQuery = vehicleQuery.in("customer_id", accessibleCustomerIds);
  }

  const [customersResult, vehiclesResult, activeInsurersResult, currentInsurerResult] = await Promise.all([
    customerQuery.returns<CustomerRow[]>(),
    vehicleQuery.returns<VehicleRow[]>(),
    admin.from("insurance_companies").select("id,name,is_active").eq("is_active", true).order("name", { ascending: true }).returns<InsurerRow[]>(),
    admin.from("insurance_companies").select("id,name,is_active").eq("id", policy.insurance_company_id).maybeSingle<InsurerRow>(),
  ]);
  if (customersResult.error || vehiclesResult.error || activeInsurersResult.error || currentInsurerResult.error) throw new Error("Unable to load external policy edit data.");

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

  const insurerById = new Map<string, InsurerRow>();
  for (const insurer of activeInsurersResult.data ?? []) insurerById.set(insurer.id, insurer);
  if (currentInsurerResult.data) insurerById.set(currentInsurerResult.data.id, currentInsurerResult.data);
  const insurers = Array.from(insurerById.values()).sort((a, b) => a.name.localeCompare(b.name)).map((insurer) => ({ id: insurer.id, name: insurer.is_active ? insurer.name : `${insurer.name} — Inactive` }));

  const initialValues: ExternalPolicyInitialValues = {
    policyId: policy.id,
    customerId: policy.customer_id,
    vehicleId: policy.vehicle_id,
    insuranceCompanyId: policy.insurance_company_id,
    policyNo: policy.policy_no,
    policyType: policy.policy_type,
    startDate: policy.start_date,
    endDate: policy.end_date,
    premiumAmount: policy.premium_amount === null ? "" : String(policy.premium_amount),
    insuredDeclaredValue: policy.insured_declared_value === null ? "" : String(policy.insured_declared_value),
  };

  return (
    <AppShell title="Edit External Policy" backHref="/policies/external">
      <ExternalPolicyForm mode="edit" customers={customers} insurers={insurers} initialValues={initialValues} />
    </AppShell>
  );
}
