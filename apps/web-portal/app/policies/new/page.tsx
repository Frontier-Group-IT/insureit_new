import { loadPolicyIntakeOnboardingDraft } from "@/app/policy-intakes/handoff-actions";
import { readVerifiedNiaPrintedPremiumReference, type NiaPrintedPremiumReference } from "@/lib/policy-n8n-onboarding-premium";
import { PolicyCommercialShell } from "@/components/policy-commercial-shell";
import { type PolicyRmOption } from "@/components/policy-unified-form";
import { PolicyOnboardingProductGuard } from "@/components/policy-onboarding-product-guard";
import { PolicyRemarksActionStyle } from "@/components/policy-remarks-action-style";
import { AppShell } from "@/components/shell";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { requireCapability } from "@/lib/master-data-server";
import { getOperationsHeadDownlinePolicyScope, operationsHeadPolicyFilter } from "@/lib/policy-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getActiveInsuranceCompanyOptions, getActiveVehicleManufacturerOptions } from "@/lib/reference-data-cache";

type CustomerRow = { id: string; contact_name: string; company_name: string | null; phone: string; email: string | null };
type IntermediaryOption = { id: string; intermediary_type: "posp" | "misp" | "partner"; display_name: string; intermediary_code: string | null; mobile: string | null; associate_employee_id: string | null; application_id: string | null };
type ApplicationPartnerRow = { id: string; partner_record_id: string | null };
type PartnerAssociateRow = { partner_record_id: string | null; associate_employee_id: string | null; created_at: string };
type PrefillVehicle = { id:string; customer_id:string; vehicle_no:string; registration_status:string|null; vehicle_type:string|null; make:string|null; model:string|null; fuel_type:string|null; year:number|null; chassis_no:string|null; engine_no:string|null; engine_capacity_cc:number|null; seating_capacity:number|null; gvw_kg:number|null; rto_state:string|null; rto_name:string|null };
type PrefillCustomer = { id:string; contact_name:string; company_name:string|null; phone:string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPolicyPage({ searchParams }: { searchParams: Promise<{ intake_id?:string; customer_id?:string; vehicle_id?:string }> }) {
  const { profile: requester } = await getAuthenticatedProfile(await getServerAccessToken());
  const profile = requester?.role === "operations_head_life" ? await requireCapability("view_policies") : await requirePolicyCreator();
  const commercialAccess = canAccessPolicyCommercials(profile, profile.role === "operations_head_life");
  const admin = createSupabaseAdminClient();
  const scoped = profile.role === "operations_head_life" ? await getOperationsHeadDownlinePolicyScope(profile.id) : null;
  const scopedFilter = scoped ? operationsHeadPolicyFilter(scoped) : null;
  if (scoped && !scoped.intermediaryCodes.length) return <SetupError message="No downline Partner/POSP/MISP is available for policy creation." />;
  const [scopedPolicies, scopedCases] = scoped && scopedFilter ? await Promise.all([
    admin.from("policies").select("customer_id").or(scopedFilter).returns<Array<{customer_id:string}>>(),
    admin.from("life_health_cases").select("customer_id").or(scopedFilter).returns<Array<{customer_id:string}>>(),
  ]) : [{ data: [] as Array<{customer_id:string}>, error: null }, { data: [] as Array<{customer_id:string}>, error: null }];
  if (scoped && (scopedPolicies.error || scopedCases.error)) return <SetupError />;
  const allowedCustomerIds = new Set([...(scopedPolicies.data ?? []), ...(scopedCases.data ?? [])].map(row => row.customer_id));
  const params = await searchParams;
  let workflowInitialValues: import("@/components/policy-unified-form").PolicyUnifiedInitialValues | undefined;
  let workflowRegistrationMode: "registered" | "unregistered" | undefined;
  let preselectedCustomerId: string | null = null;
  let sourceIntakeId: string | null = null;
  let initialDraftRevision: number | null = null;
  let vehicleHandoff = false;
  let printedPremiumReference:NiaPrintedPremiumReference|null = null;

  if (params.intake_id) {
    const intakeDraft = await loadPolicyIntakeOnboardingDraft(params.intake_id);
    if (!intakeDraft.ok) return <SetupError message={intakeDraft.error} />;
    const { registrationMode, ...form } = intakeDraft.draft;
    workflowInitialValues = form; workflowRegistrationMode = registrationMode;
    preselectedCustomerId = intakeDraft.matchedCustomerId; sourceIntakeId = params.intake_id; initialDraftRevision = intakeDraft.draftRevision;
    // The generic GCV calculator estimates GST. NIA schedules may print a
    // different independently rounded mixed-rate GST, which must not be
    // passed through the estimator as though it were an invoice total.
    const {data:source}=await admin.from("policy_intake_requests")
      .select("ocr_parser_id,ocr_status,ocr_fields,storage_path,storage_bucket")
      .eq("id",params.intake_id).maybeSingle<{
        ocr_parser_id:string|null;ocr_status:string;
        ocr_fields:Array<{key:string;value:string}>|null;
        storage_path:string|null;storage_bucket:string|null;
      }>();
    if(source?.ocr_parser_id==="new_india_cv_native_pdf" && source.ocr_status==="completed"){
      const [queue,document]=await Promise.all([
        admin.from("policy_intake_ai_processing_queue")
          .select("parser_id,checks_passed,extraction_fingerprint,document_id")
          .eq("intake_id",params.intake_id).maybeSingle<{
            parser_id:string|null;checks_passed:number;
            extraction_fingerprint:string|null;document_id:string;
          }>(),
        admin.from("policy_intake_documents").select("id,storage_path,storage_bucket")
          .eq("intake_id",params.intake_id).eq("is_current",true).maybeSingle<{
            id:string;storage_path:string;storage_bucket:string;
          }>(),
      ]);
      const currentPdfVerified=Boolean(!queue.error&&!document.error&&queue.data&&document.data
        &&queue.data.document_id===document.data.id&&queue.data.extraction_fingerprint
        &&source.storage_path===document.data.storage_path
        &&source.storage_bucket===document.data.storage_bucket);
      printedPremiumReference=readVerifiedNiaPrintedPremiumReference({
        parserId:queue.data?.parser_id??null,checksPassed:queue.data?.checks_passed??0,
        currentPdfVerified,remarks:intakeDraft.draft.remarks,
        policyNumber:intakeDraft.draft.policyNo,fields:source.ocr_fields??[],
      });
    }
  } else if (params.customer_id && params.vehicle_id) {
    if (scoped && !allowedCustomerIds.has(params.customer_id)) return <SetupError message="The customer is outside the approved downline portfolio." />;
    const [{data:customer},{data:vehicle}] = await Promise.all([
      admin.from("customers").select("id,contact_name,company_name,phone").eq("id",params.customer_id).maybeSingle<PrefillCustomer>(),
      admin.from("vehicles").select("id,customer_id,vehicle_no,registration_status,vehicle_type,make,model,fuel_type,year,chassis_no,engine_no,engine_capacity_cc,seating_capacity,gvw_kg,rto_state,rto_name").eq("id",params.vehicle_id).maybeSingle<PrefillVehicle>(),
    ]);
    if (!customer || !vehicle || vehicle.customer_id !== customer.id) return <SetupError message="The saved vehicle/customer handoff is no longer available." />;
    const pending = vehicle.registration_status === "registration_pending" || /^(?:NEW|PENDING)-/i.test(vehicle.vehicle_no);
    const capacity = vehicle.vehicle_type === "PCV" ? vehicle.seating_capacity : vehicle.vehicle_type === "GCV" || vehicle.vehicle_type === "CPM" ? vehicle.gvw_kg : vehicle.engine_capacity_cc;
    workflowRegistrationMode = pending ? "unregistered" : "registered"; preselectedCustomerId = customer.id; vehicleHandoff = true;
    workflowInitialValues = { insuredName:customer.company_name?.trim()||customer.contact_name,phoneNo:customer.phone,registrationNo:pending?"":vehicle.vehicle_no,vehicleClass:vehicle.vehicle_type??"",make:vehicle.make??"",model:vehicle.model??"",fuelType:vehicle.fuel_type??"",manufacturingYear:vehicle.year?.toString()??"",capacity:capacity?.toString()??"",chassisNo:vehicle.chassis_no??"",engineNo:vehicle.engine_no??"",rtoState:vehicle.rto_state??"",rtoName:vehicle.rto_name??"",businessLine:"Motor" };
  }

  let salesEmployees: Awaited<ReturnType<typeof loadPospMispAssociates>> = [];
  try { salesEmployees = await loadPospMispAssociates(admin); } catch { return <SetupError />; }

  const referenceData = await Promise.all([
    getActiveInsuranceCompanyOptions(), getActiveVehicleManufacturerOptions(),
    admin.from("customers").select("id,contact_name,company_name,phone,email").order("contact_name", { ascending: true }).limit(750).returns<CustomerRow[]>(),
    admin.from("intermediaries").select("id,intermediary_type,display_name,intermediary_code,mobile,associate_employee_id,application_id").in("intermediary_type", ["posp", "misp", "partner"]).eq("account_status", "active").order("display_name", { ascending: true }).returns<IntermediaryOption[]>(),
  ]).catch(() => null);
  if (!referenceData) return <SetupError />;
  const [insurerOptions, cachedManufacturers, customersResult, intermediariesResult] = referenceData;
  if (customersResult.error || intermediariesResult.error) return <SetupError />;
  const manufacturerOptions = cachedManufacturers.map((option) => option.value);

  const intermediaryRows = (intermediariesResult.data ?? []).filter(item => !scoped || scoped.intermediaryCodes.includes(item.intermediary_code?.trim() ?? ""));
  // Prefer the current onboarding owner over an intermediary's cached owner:
  // after a Partner/POSP/MISP RM transfer the cache may still hold the old RM.
  const sourceApplicationIds = [...new Set(intermediaryRows.map(item => item.application_id).filter((id): id is string => Boolean(id)))];
  const sourceOwnersResult = sourceApplicationIds.length
    ? await admin.from("posp_misp_onboarding_profiles").select("application_id,associate_employee_id").in("application_id", sourceApplicationIds)
        .returns<Array<{application_id:string;associate_employee_id:string|null}>>()
    : { data: [] as Array<{application_id:string;associate_employee_id:string|null}>, error: null };
  if (sourceOwnersResult.error) return <SetupError />;
  const currentOwnerByApplication = new Map((sourceOwnersResult.data ?? [])
    .map(item => [item.application_id, item.associate_employee_id] as const));
  const partnerApplicationIds = intermediaryRows.filter((item) => item.intermediary_type === "partner" && !item.associate_employee_id && item.application_id).map((item) => item.application_id!).filter((value, index, values) => values.indexOf(value) === index);
  const partnerApplicationsResult = partnerApplicationIds.length ? await admin.from("intermediary_onboarding_applications").select("id,partner_record_id").in("id", partnerApplicationIds).returns<ApplicationPartnerRow[]>() : { data: [] as ApplicationPartnerRow[], error: null };
  if (partnerApplicationsResult.error) return <SetupError />;
  const partnerRecordByApplication = new Map((partnerApplicationsResult.data ?? []).filter((row) => row.partner_record_id).map((row) => [row.id, row.partner_record_id!]));
  const partnerRecordIds = Array.from(new Set(partnerRecordByApplication.values()));
  const partnerAssociatesResult = partnerRecordIds.length ? await admin.from("posp_misp_onboarding_profiles").select("partner_record_id,associate_employee_id,created_at").in("partner_record_id", partnerRecordIds).not("associate_employee_id", "is", null).order("created_at", { ascending: false }).returns<PartnerAssociateRow[]>() : { data: [] as PartnerAssociateRow[], error: null };
  if (partnerAssociatesResult.error) return <SetupError />;

  const associateByPartnerRecord = new Map<string, string>();
  for (const row of partnerAssociatesResult.data ?? []) if (row.partner_record_id && row.associate_employee_id && !associateByPartnerRecord.has(row.partner_record_id)) associateByPartnerRecord.set(row.partner_record_id, row.associate_employee_id);
  const employeeById = new Map(salesEmployees.map((employee) => [employee.id, employee]));
  const customerOptions = (customersResult.data ?? []).filter(row => !scoped || allowedCustomerIds.has(row.id)).map((row) => ({ id: row.id, name: row.company_name?.trim() || row.contact_name, contactName: row.contact_name, phone: row.phone, email: row.email ?? "" }));
  const rmOptions: PolicyRmOption[] = salesEmployees.filter(employee => !scoped || scoped.employeeIds.includes(employee.id)).map((employee) => { const name = employee.full_name?.trim() || "Unnamed Sales Employee"; return { value: name, label: employee.employee_code ? `${name} - ${employee.employee_code}` : name }; });
  const sourceOptions = intermediaryRows.filter((item) => item.intermediary_code?.trim() && item.display_name?.trim()).map((item) => {
    const partnerRecordId = item.application_id ? partnerRecordByApplication.get(item.application_id) : null;
    const currentOwnerKnown = Boolean(item.application_id && currentOwnerByApplication.has(item.application_id));
    const associateEmployeeId = currentOwnerKnown
      ? (currentOwnerByApplication.get(item.application_id!) ?? null)
      : (item.associate_employee_id || (partnerRecordId ? associateByPartnerRecord.get(partnerRecordId) : null) || null);
    const associate = associateEmployeeId ? employeeById.get(associateEmployeeId) : null;
    return { type: item.intermediary_type === "posp" ? "POSP" as const : item.intermediary_type === "misp" ? "MISP" as const : "SIBL / Partner" as const, value: item.id, label: item.display_name.trim(), code: item.intermediary_code!.trim(), rmName: associate?.full_name?.trim() || "", rmCode: associate?.employee_code?.trim() || "", mobile: item.mobile?.replace(/\D/g, "").slice(-10) || "" };
  });

  return (
    <AppShell title="Add Policy">
      {sourceIntakeId && workflowInitialValues?.remarks?.includes("n8n validated ICICI 3005") ? (
        <div role="status" className="mx-auto mb-3 max-w-[1450px] rounded-xl border border-[#b6d4c7] bg-[#f2fbf6] px-4 py-3">
          <p className="text-[12px] font-bold text-[#1b5740]">n8n-verified Policy Intake · Manual onboarding review</p>
          <p className="mt-1 text-[10.5px] leading-5 text-[#3d6a57]">
            Verified fields have been mapped into the existing Policy Onboarding form where supported.
            Basic OD and add-on premiums are separated to prevent double counting. Insured Name
            may be prefilled from the verified policy PDF, but customer matching is never inferred
            from the PDF name. Check the name and kW capacity against the original PDF, along with
            all remaining fields, TP/CPA expiry and pay-in/payout before booking. No policy is automatically registered.
          </p>
        </div>
      ) : null}
      {sourceIntakeId && workflowInitialValues?.remarks?.includes("n8n validated ICICI 3005") && !workflowInitialValues.issuanceDate ? (
        <div role="alert" className="mx-auto mb-3 max-w-[1450px] rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-[12px] font-bold text-amber-900">Policy issuance date is not verified in the current PDF extraction</p>
          <p className="mt-1 text-[10.5px] leading-5 text-amber-800">
            This field is deliberately blank instead of using today or the coverage start date.
            The currently published n8n workflow now supports the original policy issue-date label.
            Recheck this Intake using its current policy PDF to retrieve an independently printed issue date.
            If the PDF has no such date, review the original copy and enter the correct date manually;
            any required date approval still applies.
          </p>
          <a className="mt-2 inline-block text-[11px] font-semibold underline" href={"/development/ai-policy-onboarding?intake_id="+encodeURIComponent(sourceIntakeId)}>
            Open AI Intake to recheck the current PDF
          </a>
        </div>
      ) : null}
      <PolicyRemarksActionStyle />
      <PolicyOnboardingProductGuard insurers={insurerOptions} />
      <PolicyCommercialShell mode="create" insurers={insurerOptions} customers={customerOptions} rms={rmOptions} sources={sourceOptions} manufacturers={manufacturerOptions} commercialAccess={commercialAccess} initialValues={workflowInitialValues} printedPremiumReference={printedPremiumReference} initialRegistrationMode={workflowRegistrationMode} authoritativeInitialValues={vehicleHandoff} preselectedCustomerId={preselectedCustomerId} preselectedVehicleId={vehicleHandoff ? params.vehicle_id ?? null : null} sourceIntakeId={sourceIntakeId} initialDraftRevision={initialDraftRevision} />
    </AppShell>
  );
}

function SetupError({ message }: { message?: string }) {
  return <AppShell title="Add Policy"><div className="mx-auto max-w-[900px] rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 shadow-sm"><h2 className="text-[13px] font-semibold text-amber-900">Policy setup information is temporarily unavailable.</h2><p className="mt-1 text-[10.5px] leading-5 text-amber-800">{message ?? "Insurer, customer, intermediary or relationship master data could not be loaded. Refresh the page or try again shortly; no policy information has been changed."}</p></div></AppShell>;
}
