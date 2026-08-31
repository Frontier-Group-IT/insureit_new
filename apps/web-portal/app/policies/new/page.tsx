import { loadPolicyIntakeOnboardingDraft } from "@/app/policy-intakes/handoff-actions";
import { PolicyCommercialShell } from "@/components/policy-commercial-shell";
import { type PolicyRmOption, type PolicySourceOption } from "@/components/policy-unified-form";
import { PolicyOnboardingProductGuard } from "@/components/policy-onboarding-product-guard";
import { PolicyRemarksActionStyle } from "@/components/policy-remarks-action-style";
import { AppShell } from "@/components/shell";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getActiveInsuranceCompanyOptions, getActiveVehicleManufacturerOptions } from "@/lib/reference-data-cache";

type CustomerRow = { id: string; contact_name: string; company_name: string | null; phone: string; email: string | null };
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
type PrefillVehicle = { id:string; customer_id:string; vehicle_no:string; registration_status:string|null; vehicle_type:string|null; make:string|null; model:string|null; fuel_type:string|null; year:number|null; chassis_no:string|null; engine_no:string|null; engine_capacity_cc:number|null; seating_capacity:number|null; gvw_kg:number|null; rto_state:string|null; rto_name:string|null };
type PrefillCustomer = { id:string; contact_name:string; company_name:string|null; phone:string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPolicyPage({ searchParams }: { searchParams: Promise<{ intake_id?:string; customer_id?:string; vehicle_id?:string }> }) {
  const profile = await requirePolicyCreator();
  const commercialAccess = canAccessPolicyCommercials(profile);
  const admin = createSupabaseAdminClient();
  const params = await searchParams;
  let workflowInitialValues: import("@/components/policy-unified-form").PolicyUnifiedInitialValues | undefined;
  let workflowRegistrationMode: "registered" | "unregistered" | undefined;
  let preselectedCustomerId: string | null = null;
  let sourceIntakeId: string | null = null;
  let initialDraftRevision: number | null = null;

  if (params.intake_id) {
    const intakeDraft = await loadPolicyIntakeOnboardingDraft(params.intake_id);
    if (!intakeDraft.ok) return <SetupError message={intakeDraft.error} />;
    const { registrationMode, ...form } = intakeDraft.draft;
    workflowInitialValues = form; workflowRegistrationMode = registrationMode;
    preselectedCustomerId = intakeDraft.matchedCustomerId; sourceIntakeId = params.intake_id; initialDraftRevision = intakeDraft.draftRevision;
  } else if (params.customer_id && params.vehicle_id) {
    const [{data:customer},{data:vehicle}] = await Promise.all([
      admin.from("customers").select("id,contact_name,company_name,phone").eq("id",params.customer_id).maybeSingle<PrefillCustomer>(),
      admin.from("vehicles").select("id,customer_id,vehicle_no,registration_status,vehicle_type,make,model,fuel_type,year,chassis_no,engine_no,engine_capacity_cc,seating_capacity,gvw_kg,rto_state,rto_name").eq("id",params.vehicle_id).maybeSingle<PrefillVehicle>(),
    ]);
    if (!customer || !vehicle || vehicle.customer_id !== customer.id) return <SetupError message="The saved vehicle/customer handoff is no longer available." />;
    const pending = vehicle.registration_status === "registration_pending" || /^(?:NEW|PENDING)-/i.test(vehicle.vehicle_no);
    const capacity = vehicle.vehicle_type === "PCV" ? vehicle.seating_capacity : vehicle.vehicle_type === "GCV" || vehicle.vehicle_type === "CPM" ? vehicle.gvw_kg : vehicle.engine_capacity_cc;
    workflowRegistrationMode = pending ? "unregistered" : "registered"; preselectedCustomerId = customer.id;
    workflowInitialValues = { insuredName:customer.company_name?.trim()||customer.contact_name,phoneNo:customer.phone,registrationNo:pending?"":vehicle.vehicle_no,vehicleClass:vehicle.vehicle_type??"",make:vehicle.make??"",model:vehicle.model??"",fuelType:vehicle.fuel_type??"",manufacturingYear:vehicle.year?.toString()??"",capacity:capacity?.toString()??"",chassisNo:vehicle.chassis_no??"",engineNo:vehicle.engine_no??"",rtoState:vehicle.rto_state??"",rtoName:vehicle.rto_name??"",businessLine:"Motor" };
  }

  let salesEmployees: Awaited<ReturnType<typeof loadPospMispAssociates>> = [];
  try {
    salesEmployees = await loadPospMispAssociates(admin);
  } catch {
    return <SetupError />;
  }

  const referenceData = await Promise.all([
    getActiveInsuranceCompanyOptions(),
    getActiveVehicleManufacturerOptions(),
    admin.from("customers").select("id,contact_name,company_name,phone,email").order("contact_name", { ascending: true }).limit(750).returns<CustomerRow[]>(),
    admin
      .from("intermediaries")
      .select("id,intermediary_type,display_name,intermediary_code,associate_employee_id,application_id")
      .in("intermediary_type", ["posp", "misp", "partner"])
      .eq("account_status", "active")
      .order("display_name", { ascending: true })
      .returns<IntermediaryOption[]>(),
  ]).catch(() => null);

  if (!referenceData) return <SetupError />;
  const [insurerOptions, cachedManufacturers, customersResult, intermediariesResult] = referenceData;
  if (customersResult.error || intermediariesResult.error) return <SetupError />;
  const manufacturerOptions = cachedManufacturers.map((option) => option.value);

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
  if (partnerApplicationsResult.error) return <SetupError />;

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
  if (partnerAssociatesResult.error) return <SetupError />;

  const associateByPartnerRecord = new Map<string, string>();
  for (const row of partnerAssociatesResult.data ?? []) {
    if (row.partner_record_id && row.associate_employee_id && !associateByPartnerRecord.has(row.partner_record_id)) {
      associateByPartnerRecord.set(row.partner_record_id, row.associate_employee_id);
    }
  }

  const employeeById = new Map(salesEmployees.map((employee) => [employee.id, employee]));
  const customerOptions = (customersResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.company_name?.trim() || row.contact_name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email ?? "",
  }));
  const rmOptions: PolicyRmOption[] = salesEmployees.map((employee) => {
    const name = employee.full_name?.trim() || "Unnamed Sales Employee";
    return { value: name, label: employee.employee_code ? `${name} - ${employee.employee_code}` : name };
  });
  const sourceOptions: PolicySourceOption[] = intermediaryRows
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
      <PolicyRemarksActionStyle />
      <PolicyOnboardingProductGuard />
      <PolicyCommercialShell
        mode="create"
        insurers={insurerOptions}
        customers={customerOptions}
        rms={rmOptions}
        sources={sourceOptions}
        manufacturers={manufacturerOptions}
        commercialAccess={commercialAccess}
        initialValues={workflowInitialValues}
        initialRegistrationMode={workflowRegistrationMode}
        preselectedCustomerId={preselectedCustomerId}
        sourceIntakeId={sourceIntakeId}
        initialDraftRevision={initialDraftRevision}
      />
    </AppShell>
  );
}

function SetupError({ message }: { message?: string }) {
  return (
    <AppShell title="Add Policy">
      <div className="mx-auto max-w-[900px] rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm">
        <h2 className="text-[13px] font-semibold text-amber-900">Policy setup information is temporarily unavailable.</h2>
        <p className="mt-1 text-[10.5px] leading-5 text-amber-800">{message ?? "Insurer, customer, intermediary or relationship master data could not be loaded. Refresh the page or try again shortly; no policy information has been changed."}</p>
      </div>
    </AppShell>
  );
}
