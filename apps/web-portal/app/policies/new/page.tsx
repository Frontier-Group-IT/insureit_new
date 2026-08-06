import { createInsuranceCompany } from "@/app/master-data-form-actions";
import { addPolicy } from "@/app/policies/policy-actions";
import { PolicyFormAuthbridge } from "@/components/policy-form-authbridge";
import { PolicyOnboardingIntelligence } from "@/components/policy-onboarding-intelligence";
import { PolicySourceMasterWire } from "@/components/policy-source-master-wire";
import { AppShell } from "@/components/shell";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerOption = { id: string; contact_name: string };
type VehicleOption = { id: string; vehicle_no: string; customer_id: string };
type InsurerOption = { id: string; name: string; branch_name: string | null };
type IntermediaryOption = {
  id: string;
  intermediary_type: "posp" | "misp" | "partner";
  display_name: string;
  intermediary_code: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPolicyPage() {
  await requirePolicyEditor();
  const admin = createSupabaseAdminClient();

  const [customersResult, vehiclesResult, insurersResult, salesEmployees, intermediariesResult] = await Promise.all([
    admin.from("customers").select("id, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    admin.from("vehicles").select("id, vehicle_no, customer_id").order("created_at", { ascending: false }).returns<VehicleOption[]>(),
    admin.from("insurance_companies").select("id, name, branch_name").order("name", { ascending: true }).returns<InsurerOption[]>(),
    loadPospMispAssociates(admin),
    admin
      .from("intermediaries")
      .select("id,intermediary_type,display_name,intermediary_code")
      .in("intermediary_type", ["posp", "misp", "partner"])
      .eq("account_status", "active")
      .order("display_name", { ascending: true })
      .returns<IntermediaryOption[]>()
  ]);

  if (customersResult.error) throw new Error(`Unable to load customers: ${customersResult.error.message}`);
  if (vehiclesResult.error) throw new Error(`Unable to load vehicles: ${vehiclesResult.error.message}`);
  if (insurersResult.error) throw new Error(`Unable to load insurers: ${insurersResult.error.message}`);
  if (intermediariesResult.error) throw new Error(`Unable to load intermediary masters: ${intermediariesResult.error.message}`);

  const customerOptions = (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.contact_name }));
  const vehicleOptions = (vehiclesResult.data ?? []).map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicle_no, customerId: vehicle.customer_id }));
  const insurerOptions = (insurersResult.data ?? []).map((insurer) => ({ value: insurer.id, label: insurer.branch_name ? `${insurer.name} — ${insurer.branch_name}` : insurer.name }));
  const rmOptions = salesEmployees.map((employee) => {
    const name = employee.full_name?.trim() || "Unnamed Sales Employee";
    return { value: name, label: employee.employee_code ? `${name} - ${employee.employee_code}` : name };
  });
  const sourceOptions = (intermediariesResult.data ?? [])
    .filter((item) => item.intermediary_code?.trim() && item.display_name?.trim())
    .map((item) => ({
      type: item.intermediary_type === "posp" ? "POSP" as const : item.intermediary_type === "misp" ? "MISP" as const : "SIBL / Partner" as const,
      value: item.id,
      label: item.display_name.trim(),
      code: item.intermediary_code!.trim()
    }));

  return (
    <AppShell title="Add Policy">
      <PolicySourceMasterWire rms={rmOptions} sources={sourceOptions} />
      <PolicyOnboardingIntelligence />
      <PolicyFormAuthbridge action={addPolicy} createInsurerAction={createInsuranceCompany} customers={customerOptions} vehicles={vehicleOptions} insurers={insurerOptions} submitLabel="Create Policy" />
    </AppShell>
  );
}