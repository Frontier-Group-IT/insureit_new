import { createInsuranceCompany } from "@/app/master-data-form-actions";
import { addPolicy } from "@/app/policies/policy-actions";
import { PolicyFormAuthbridge } from "@/components/policy-form-authbridge";
import { PolicyIntelligencePositionGuard } from "@/components/policy-intelligence-position-guard";
import { PolicyOnboardingIntelligence } from "@/components/policy-onboarding-intelligence";
import { PolicySourceMasterWire } from "@/components/policy-source-master-wire";
import { AppShell } from "@/components/shell";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type CustomerOption = { id: string; contact_name: string };
type VehicleOption = { id: string; vehicle_no: string; customer_id: string };
type InsurerOption = { id: string; name: string };
type IntermediaryOption = {
  id: string;
  intermediary_type: "posp" | "misp" | "partner";
  display_name: string;
  intermediary_code: string | null;
  associate_employee_id: string | null;
  application_id: string | null;
};
type ApplicationPartnerRow = { id: string; partner_record_id: string | null };
type PartnerAssociateRow = { partner_record_id: string | null; associate_employee_id: string | null; created_at: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPolicyPage() {
  await requirePolicyEditor();
  const admin = createSupabaseAdminClient();

  const [customersResult, vehiclesResult, insurersResult, salesEmployees, intermediariesResult] = await Promise.all([
    admin.from("customers").select("id, contact_name").order("created_at", { ascending: false }).returns<CustomerOption[]>(),
    admin.from("vehicles").select("id, vehicle_no, customer_id").order("created_at", { ascending: false }).returns<VehicleOption[]>(),
    admin.from("insurance_companies").select("id, name").eq("is_active", true).order("name", { ascending: true }).returns<InsurerOption[]>(),
    loadPospMispAssociates(admin),
    admin
      .from("intermediaries")
      .select("id,intermediary_type,display_name,intermediary_code,associate_employee_id,application_id")
      .in("intermediary_type", ["posp", "misp", "partner"])
      .eq("account_status", "active")
      .order("display_name", { ascending: true })
      .returns<IntermediaryOption[]>()
  ]);

  if (customersResult.error) throw new Error(`Unable to load customers: ${customersResult.error.message}`);
  if (vehiclesResult.error) throw new Error(`Unable to load vehicles: ${vehiclesResult.error.message}`);
  if (insurersResult.error) throw new Error(`Unable to load insurers: ${insurersResult.error.message}`);
  if (intermediariesResult.error) throw new Error(`Unable to load intermediary masters: ${intermediariesResult.error.message}`);

  const intermediaryRows = intermediariesResult.data ?? [];
  const partnerApplicationIds = intermediaryRows
    .filter((item) => item.intermediary_type === "partner" && !item.associate_employee_id && item.application_id)
    .map((item) => item.application_id!)
    .filter((value, index, values) => values.indexOf(value) === index);

  const partnerApplicationsResult = partnerApplicationIds.length
    ? await admin
      .from("intermediary_onboarding_applications")
      .select("id,partner_record_id")
      .in("id", partnerApplicationIds)
      .returns<ApplicationPartnerRow[]>()
    : { data: [] as ApplicationPartnerRow[], error: null };
  if (partnerApplicationsResult.error) throw new Error(`Unable to resolve partner RM linkage: ${partnerApplicationsResult.error.message}`);

  const partnerRecordByApplication = new Map(
    (partnerApplicationsResult.data ?? [])
      .filter((row) => row.partner_record_id)
      .map((row) => [row.id, row.partner_record_id!])
  );
  const partnerRecordIds = Array.from(new Set(partnerRecordByApplication.values()));

  const partnerAssociatesResult = partnerRecordIds.length
    ? await admin
      .from("posp_misp_onboarding_profiles")
      .select("partner_record_id,associate_employee_id,created_at")
      .in("partner_record_id", partnerRecordIds)
      .not("associate_employee_id", "is", null)
      .order("created_at", { ascending: false })
      .returns<PartnerAssociateRow[]>()
    : { data: [] as PartnerAssociateRow[], error: null };
  if (partnerAssociatesResult.error) throw new Error(`Unable to resolve partner RM assignment: ${partnerAssociatesResult.error.message}`);

  const associateByPartnerRecord = new Map<string, string>();
  for (const row of partnerAssociatesResult.data ?? []) {
    if (row.partner_record_id && row.associate_employee_id && !associateByPartnerRecord.has(row.partner_record_id)) {
      associateByPartnerRecord.set(row.partner_record_id, row.associate_employee_id);
    }
  }

  const employeeById = new Map(salesEmployees.map((employee) => [employee.id, employee]));
  const customerOptions = (customersResult.data ?? []).map((customer) => ({ value: customer.id, label: customer.contact_name }));
  const vehicleOptions = (vehiclesResult.data ?? []).map((vehicle) => ({ value: vehicle.id, label: vehicle.vehicle_no, customerId: vehicle.customer_id }));
  const insurerOptions = (insurersResult.data ?? []).map((insurer) => ({ value: insurer.id, label: insurer.name }));
  const rmOptions = salesEmployees.map((employee) => {
    const name = employee.full_name?.trim() || "Unnamed Sales Employee";
    return { value: name, label: employee.employee_code ? `${name} - ${employee.employee_code}` : name };
  });
  const sourceOptions = intermediaryRows
    .filter((item) => item.intermediary_code?.trim() && item.display_name?.trim())
    .map((item) => {
      const partnerRecordId = item.application_id ? partnerRecordByApplication.get(item.application_id) : null;
      const associateEmployeeId = item.associate_employee_id || (partnerRecordId ? associateByPartnerRecord.get(partnerRecordId) : null) || null;
      const associate = associateEmployeeId ? employeeById.get(associateEmployeeId) : null;
      return {
        type: item.intermediary_type === "posp" ? "POSP" as const : item.intermediary_type === "misp" ? "MISP" as const : "SIBL / Partner" as const,
        value: item.id,
        label: item.display_name.trim(),
        code: item.intermediary_code!.trim(),
        rmName: associate?.full_name?.trim() || "",
        rmCode: associate?.employee_code?.trim() || ""
      };
    });

  return (
    <AppShell title="Add Policy">
      <PolicySourceMasterWire rms={rmOptions} sources={sourceOptions} />
      <PolicyOnboardingIntelligence />
      <PolicyIntelligencePositionGuard />
      <PolicyFormAuthbridge action={addPolicy} createInsurerAction={createInsuranceCompany} customers={customerOptions} vehicles={vehicleOptions} insurers={insurerOptions} submitLabel="Create Policy" />
    </AppShell>
  );
}
