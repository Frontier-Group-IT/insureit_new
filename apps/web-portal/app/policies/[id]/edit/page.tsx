import { notFound } from "next/navigation";
import { PolicyActivityStatus } from "@/components/policy-activity-status";
import { PolicyCommercialShell } from "@/components/policy-commercial-shell";
import { PolicyEditActionFooter } from "@/components/policy-edit-action-footer";
import { PolicyLinkedMasterActions } from "@/components/policy-linked-master-actions";
import { type PolicyRmOption, type PolicySourceOption, type PolicyUnifiedInitialValues } from "@/components/policy-unified-form";
import type { NonMotorUnifiedInitialValues } from "@/components/non-motor-unified-mode";
import { PolicyRemarksActionStyle } from "@/components/policy-remarks-action-style";
import { AppShell } from "@/components/shell";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { loadPolicyPayinBilling } from "@/app/policies/policy-payin-billing-actions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getCustomerManager } from "@/lib/master-data-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getActiveInsuranceCompanyOptions } from "@/lib/reference-data-cache";

type PolicyRow = {
  id: string; customer_id: string; vehicle_id: string | null; insurance_company_id: string;
  policy_no: string; policy_type: string; policy_product: string | null; premium_amount: number | null; insured_declared_value: number | null;
  start_date: string; end_date: string; policy_code: string | null;
  intermediary_type: string | null; intermediary_code: string | null; lead_source: string | null;
  rm_name: string | null; business_line: string | null; issuance_date: string | null; remarks: string | null;
  status: string | null; created_by: string | null; created_at: string | null; updated_at: string | null;
};
type CustomerRow = { id: string; contact_name: string; company_name: string | null; phone: string | null; email: string | null; address: string | null; customer_type: string | null; updated_at: string | null };
type VehicleRow = {
  id: string; vehicle_no: string; vehicle_type: string | null; vehicle_class_code: string | null;
  vehicle_class_description: string | null; make: string | null; model: string | null; year: number | null;
  chassis_no: string | null; engine_no: string | null; fuel_type: string | null;
  engine_capacity_cc: number | null; seating_capacity: number | null; gvw_kg: number | null;
  rto_name: string | null; rto_state: string | null; updated_at: string | null;
};
type PremiumRow = { od_premium: number | null; tp_premium: number | null; cpa_opted: boolean | null; cpa_amount: number | null; net_premium: number | null; gst_amount: number | null; gross_premium: number | null };
type PayinRow = { payout_basis: string | null; projected_od_percent: number | null; projected_tp_percent: number | null; insurer_scheme_amount: number | null; commercial_basis: string | null; projected_commission_percent: number | null; projected_commission_amount: number | null; commercial_status: string | null };
type PayoutRow = { retention_amount: number | null; od_payout_percent: number | null; tp_payout_percent: number | null; status: string | null; payout_date: string | null; voucher_number: string | null; payout_basis: string | null; partner_payout_percent: number | null; partner_payout_amount: number | null; gross_payout: number | null; commercial_status: string | null };
type NonMotorDetailsRow = {
  category: string | null; risk_title: string | null; risk_location: string | null; occupancy_type: string | null;
  transit_from: string | null; transit_to: string | null; transit_mode: string | null; nature_of_business: string | null;
  liability_type: string | null; employee_count: number | null; annual_wages: number | null; annual_turnover: number | null;
  sum_insured: number | null; deductible: number | null; proposal_number: string | null; previous_insurer: string | null;
  previous_policy_number: string | null; previous_claims: string | null; add_ons: string | null; warranties: string | null;
  special_conditions: string | null; endorsements: string | null; remarks: string | null;
  risk_details: Record<string, unknown> | null; additional_details: Record<string, unknown> | null;
};
type NonMotorPremiumRow = { net_premium: number | null; gst_amount: number | null; gross_premium: number | null };
type NonMotorPayinRow = { commercial_basis: string | null; projected_commission_percent: number | null; projected_commission_amount: number | null; insurer_scheme_amount: number | null };
type NonMotorPayoutRow = { payout_basis: string | null; partner_payout_percent: number | null; partner_payout_amount: number | null };
type CustomerOptionRow = { id: string; contact_name: string; company_name: string | null; phone: string; email: string | null };

type InsurerOption = { id: string; name: string; is_active: boolean };
type CreatorProfileRow = { full_name: string };
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

function stringValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function recordString(record: Record<string, unknown> | null | undefined, key: string, fallback = "") {
  const value = record?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function vehicleCapacity(vehicle: VehicleRow, vehicleClass: string) {
  if (vehicleClass === "PCP" || vehicleClass === "TWP") return stringValue(vehicle.engine_capacity_cc);
  if (vehicleClass === "PCV") return stringValue(vehicle.seating_capacity);
  if (vehicleClass === "GCV" || vehicleClass === "CPM") return stringValue(vehicle.gvw_kg);
  return stringValue(vehicle.engine_capacity_cc || vehicle.gvw_kg || vehicle.seating_capacity);
}

export default async function EditPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const policyEditor = await requirePolicyEditor();
  const commercialAccess = canAccessPolicyCommercials(policyEditor);
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const policyResult = await admin.from("policies")
    .select("id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,policy_product,premium_amount,insured_declared_value,start_date,end_date,policy_code,intermediary_type,intermediary_code,lead_source,rm_name,business_line,issuance_date,remarks,status,created_by,created_at,updated_at")
    .eq("id", id).maybeSingle<PolicyRow>();
  if (policyResult.error) throw new Error(`Unable to load policy details: ${policyResult.error.message}`);
  if (!policyResult.data) notFound();
  const policy = policyResult.data;
  const vehicleId = policy.vehicle_id;
  const isNonMotor = policy.business_line === "Non Motor";

  const [customerManager, canEditVehicle] = await Promise.all([
    getCustomerManager(policy.customer_id),
    hasEffectiveCapability(policyEditor, "view_vehicles", "edit"),
  ]);

  const creatorResult = policy.created_by
    ? await admin.from("profiles").select("full_name").eq("id", policy.created_by).maybeSingle<CreatorProfileRow>()
    : { data: null as CreatorProfileRow | null, error: null };
  if (creatorResult.error) throw new Error(`Unable to load policy creator: ${creatorResult.error.message}`);

  const [customerResult, vehicleResult, premiumResult, payinResult, payoutResult, activeInsurerOptions, currentInsurerResult, salesEmployees, intermediariesResult, nonMotorDetailsResult, customersResult] = await Promise.all([
    admin.from("customers").select("id,contact_name,company_name,phone,email,address,customer_type,updated_at").eq("id", policy.customer_id).maybeSingle<CustomerRow>(),
    vehicleId
      ? admin.from("vehicles").select("id,vehicle_no,vehicle_type,vehicle_class_code,vehicle_class_description,make,model,year,chassis_no,engine_no,fuel_type,engine_capacity_cc,seating_capacity,gvw_kg,rto_name,rto_state,updated_at").eq("id", vehicleId).maybeSingle<VehicleRow>()
      : Promise.resolve({ data: null as VehicleRow | null, error: null }),
    admin.from("policy_premium_details").select("od_premium,tp_premium,cpa_opted,cpa_amount,net_premium,gst_amount,gross_premium").eq("policy_id", id).maybeSingle<PremiumRow>(),
    admin.from("policy_payin_details").select("payout_basis,projected_od_percent,projected_tp_percent,insurer_scheme_amount,commercial_basis,projected_commission_percent,projected_commission_amount,commercial_status").eq("policy_id", id).maybeSingle<PayinRow>(),
    admin.from("policy_intermediary_payouts").select("retention_amount,od_payout_percent,tp_payout_percent,status,payout_date,voucher_number,payout_basis,partner_payout_percent,partner_payout_amount,gross_payout,commercial_status").eq("policy_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle<PayoutRow>(),
    getActiveInsuranceCompanyOptions(),
    admin.from("insurance_companies").select("id,name,is_active").eq("id", policy.insurance_company_id).maybeSingle<InsurerOption>(),
    loadPospMispAssociates(admin),
    admin.from("intermediaries")
      .select("id,intermediary_type,display_name,intermediary_code,associate_employee_id,application_id")
      .in("intermediary_type", ["posp","misp","partner"])
      .eq("account_status", "active")
      .order("display_name", { ascending: true })
      .returns<IntermediaryOption[]>(),
    isNonMotor
      ? admin.from("non_motor_policy_details")
        .select("category,risk_title,risk_location,occupancy_type,transit_from,transit_to,transit_mode,nature_of_business,liability_type,employee_count,annual_wages,annual_turnover,sum_insured,deductible,proposal_number,previous_insurer,previous_policy_number,previous_claims,add_ons,warranties,special_conditions,endorsements,remarks,risk_details,additional_details")
        .eq("policy_id", id)
        .maybeSingle<NonMotorDetailsRow>()
      : Promise.resolve({ data: null as NonMotorDetailsRow | null, error: null }),
    isNonMotor
      ? admin.from("customers").select("id,contact_name,company_name,phone,email").order("contact_name", { ascending: true }).limit(750).returns<CustomerOptionRow[]>()
      : Promise.resolve({ data: [] as CustomerOptionRow[], error: null }),
  ]);

  const billingResult = commercialAccess
    ? await loadPolicyPayinBilling(id)
    : { ok: true as const, billing: { billNumber: "", billedAmount: "", billDate: "", status: "Unbilled" } };
  if (!billingResult.ok) throw new Error(`Unable to load policy PayIn billing: ${billingResult.error}`);

  const errors = [customerResult.error, vehicleResult.error, premiumResult.error, payinResult.error, payoutResult.error, currentInsurerResult.error, intermediariesResult.error, nonMotorDetailsResult.error, customersResult.error].filter(Boolean);
  if (errors.length) throw new Error(`Unable to load policy edit data: ${errors[0]?.message}`);
  if (!customerResult.data || (!isNonMotor && !vehicleResult.data)) throw new Error("The linked customer or vehicle record is missing.");

  const intermediaryRows = intermediariesResult.data ?? [];
  const partnerApplicationIds = intermediaryRows
    .filter((item) => item.intermediary_type === "partner" && !item.associate_employee_id && item.application_id)
    .map((item) => item.application_id!)
    .filter((value, index, values) => values.indexOf(value) === index);

  const partnerApplicationsResult = partnerApplicationIds.length
    ? await admin.from("intermediary_onboarding_applications").select("id,partner_record_id").in("id", partnerApplicationIds).returns<ApplicationPartnerRow[]>()
    : { data: [] as ApplicationPartnerRow[], error: null };
  if (partnerApplicationsResult.error) throw new Error(`Unable to resolve partner RM linkage: ${partnerApplicationsResult.error.message}`);

  const partnerRecordByApplication = new Map((partnerApplicationsResult.data ?? []).filter((row) => row.partner_record_id).map((row) => [row.id, row.partner_record_id!]));
  const partnerRecordIds = Array.from(new Set(partnerRecordByApplication.values()));
  const partnerAssociatesResult = partnerRecordIds.length
    ? await admin.from("posp_misp_onboarding_profiles").select("partner_record_id,associate_employee_id,created_at").in("partner_record_id", partnerRecordIds).not("associate_employee_id", "is", null).order("created_at", { ascending: false }).returns<PartnerAssociateRow[]>()
    : { data: [] as PartnerAssociateRow[], error: null };
  if (partnerAssociatesResult.error) throw new Error(`Unable to resolve partner RM assignment: ${partnerAssociatesResult.error.message}`);

  const associateByPartnerRecord = new Map<string, string>();
  for (const row of partnerAssociatesResult.data ?? []) {
    if (row.partner_record_id && row.associate_employee_id && !associateByPartnerRecord.has(row.partner_record_id)) associateByPartnerRecord.set(row.partner_record_id, row.associate_employee_id);
  }

  const customer = customerResult.data;
  const premium = premiumResult.data;
  const payin = payinResult.data;
  const payout = payoutResult.data;
  const billing = billingResult.billing;

  const payinHasConfirmedEntry = Boolean(payin) && (
    payin?.commercial_status === "entered"
    || payin?.commercial_status === "reviewed"
    || payin?.commercial_status === "not_applicable"
    || Number(payin?.projected_od_percent ?? 0) !== 0
    || Number(payin?.projected_tp_percent ?? 0) !== 0
    || Number(payin?.insurer_scheme_amount ?? 0) !== 0
  );
  const payoutHasConfirmedEntry = Boolean(payout) && (
    payout?.commercial_status === "entered"
    || payout?.commercial_status === "reviewed"
    || payout?.commercial_status === "not_applicable"
    || Number(payout?.od_payout_percent ?? 0) !== 0
    || Number(payout?.tp_payout_percent ?? 0) !== 0
    || Number(payout?.partner_payout_amount ?? 0) !== 0
    || Number(payout?.gross_payout ?? 0) !== 0
  );

  const insurerOptionsById = new Map(activeInsurerOptions.map((insurer) => [insurer.value, insurer]));
  if (currentInsurerResult.data && !currentInsurerResult.data.is_active) {
    insurerOptionsById.set(currentInsurerResult.data.id, {
      value: currentInsurerResult.data.id,
      label: `${currentInsurerResult.data.name} — Inactive`,
    });
  }
  const insurerOptions = Array.from(insurerOptionsById.values()).sort((a, b) => a.label.localeCompare(b.label));

  const employeeById = new Map(salesEmployees.map((employee) => [employee.id, employee]));
  const rmOptions: PolicyRmOption[] = salesEmployees.map((employee) => {
    const name = employee.full_name?.trim() || "Unnamed Sales Employee";
    return { value: name, label: employee.employee_code ? `${name} - ${employee.employee_code}` : name };
  });
  if (policy.rm_name && !rmOptions.some((item)=>item.value === policy.rm_name)) rmOptions.push({ value: policy.rm_name, label: `${policy.rm_name} · Saved value` });

  const sourceOptions: PolicySourceOption[] = intermediaryRows.filter((item)=>item.intermediary_code?.trim() && item.display_name?.trim()).map((item)=>{
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

  if (policy.lead_source?.trim() && policy.intermediary_code?.trim() && policy.intermediary_type) {
    const savedType = policy.intermediary_type === "POSP" ? "POSP" as const : policy.intermediary_type === "MISP" ? "MISP" as const : "SIBL / Partner" as const;
    if (!sourceOptions.some((item)=>item.type === savedType && item.label.toLowerCase() === policy.lead_source!.trim().toLowerCase())) {
      const savedRm = salesEmployees.find((employee) => employee.full_name?.trim() === policy.rm_name?.trim());
      sourceOptions.push({ type: savedType, value: `saved-${id}`, label: policy.lead_source.trim(), code: policy.intermediary_code.trim(), rmName: policy.rm_name?.trim() || "", rmCode: savedRm?.employee_code?.trim() || "" });
    }
  }

  if (isNonMotor) {
    const details = nonMotorDetailsResult.data;
    const risk = details?.risk_details ?? {};
    const additional = details?.additional_details ?? {};
    const customerOptions = (customersResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.company_name?.trim() || row.contact_name,
      contactName: row.contact_name,
      phone: row.phone,
      email: row.email ?? "",
    }));
    if (!customerOptions.some((item) => item.id === customer.id)) {
      customerOptions.unshift({
        id: customer.id,
        name: customer.company_name?.trim() || customer.contact_name,
        contactName: customer.contact_name,
        phone: customer.phone ?? "",
        email: customer.email ?? "",
      });
    }

    const nonMotorInitialValues: NonMotorUnifiedInitialValues = {
      customerMode: "existing",
      customerId: customer.id,
      customerType: customer.customer_type === "corporate" ? "Organisation" : "Individual",
      insuredName: customer.company_name?.trim() || customer.contact_name,
      contactName: customer.contact_name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      policyNumber: policy.policy_no,
      insurerId: policy.insurance_company_id,
      productName: policy.policy_product ?? policy.policy_type,
      category: details?.category ?? policy.policy_type,
      status: policy.status ? policy.status.charAt(0).toUpperCase() + policy.status.slice(1).toLowerCase() : "Active",
      riskTitle: recordString(risk, "riskTitle", details?.risk_title ?? ""),
      riskLocation: recordString(risk, "riskLocation", details?.risk_location ?? ""),
      occupancyType: recordString(risk, "occupancyType", details?.occupancy_type ?? ""),
      cargoDescription: recordString(risk, "cargoDescription"),
      transitFrom: recordString(risk, "transitFrom", details?.transit_from ?? ""),
      transitTo: recordString(risk, "transitTo", details?.transit_to ?? ""),
      transitMode: recordString(risk, "transitMode", details?.transit_mode ?? ""),
      projectName: recordString(risk, "projectName"),
      projectValue: recordString(risk, "projectValue"),
      natureOfBusiness: recordString(risk, "natureOfBusiness", details?.nature_of_business ?? ""),
      liabilityType: recordString(risk, "liabilityType", details?.liability_type ?? ""),
      employeeCount: recordString(risk, "employeeCount", stringValue(details?.employee_count)),
      annualWages: recordString(risk, "annualWages", stringValue(details?.annual_wages)),
      businessName: recordString(risk, "businessName"),
      annualTurnover: recordString(risk, "annualTurnover", stringValue(details?.annual_turnover)),
      sumInsured: stringValue(details?.sum_insured ?? policy.insured_declared_value),
      deductible: stringValue(details?.deductible),
      netPremium: stringValue(premium?.net_premium),
      gstAmount: stringValue(premium?.gst_amount),
      grossPremium: stringValue(premium?.gross_premium ?? policy.premium_amount),
      startDate: policy.start_date,
      endDate: policy.end_date,
      payinBasis: payin?.commercial_basis === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "NET_PREMIUM_PERCENT",
      payinPercent: payin?.commercial_basis === "FIXED_AMOUNT" ? "" : stringValue(payin?.projected_commission_percent),
      payinFixedAmount: payin?.commercial_basis === "FIXED_AMOUNT" ? stringValue(payin?.projected_commission_amount) : "",
      insurerSchemeAmount: stringValue(payin?.insurer_scheme_amount),
      payoutBasis: payout?.payout_basis === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "NET_PREMIUM_PERCENT",
      payoutPercent: payout?.payout_basis === "FIXED_AMOUNT" ? "" : stringValue(payout?.partner_payout_percent),
      payoutFixedAmount: payout?.payout_basis === "FIXED_AMOUNT" ? stringValue(payout?.partner_payout_amount) : "",
      proposalNumber: recordString(additional, "proposalNumber", details?.proposal_number ?? ""),
      previousInsurer: recordString(additional, "previousInsurer", details?.previous_insurer ?? ""),
      previousPolicyNumber: recordString(additional, "previousPolicyNumber", details?.previous_policy_number ?? ""),
      previousClaims: recordString(additional, "previousClaims", details?.previous_claims ?? ""),
      addOns: recordString(additional, "addOns", details?.add_ons ?? ""),
      warranties: recordString(additional, "warranties", details?.warranties ?? ""),
      specialConditions: recordString(additional, "specialConditions", details?.special_conditions ?? ""),
      endorsements: recordString(additional, "endorsements", details?.endorsements ?? ""),
      remarks: recordString(additional, "remarks", details?.remarks ?? policy.remarks ?? ""),
    };
    const initialValues: PolicyUnifiedInitialValues = {
      policyId: policy.id,
      policyCode: policy.policy_code ?? "",
      issuanceDate: policy.issuance_date ?? policy.start_date,
      rmName: policy.rm_name ?? "",
      intermediaryType: policy.intermediary_type ?? "",
      leadSource: policy.lead_source ?? "",
      intermediaryCode: policy.intermediary_code ?? "",
      businessLine: "Non Motor",
      insuredName: customer.company_name?.trim() || customer.contact_name,
      phoneNo: customer.phone ?? "",
      policyProduct: policy.policy_type,
      idv: stringValue(policy.insured_declared_value),
      policyNo: policy.policy_no,
      insurerId: policy.insurance_company_id,
      validFrom: policy.start_date,
      validUpto: policy.end_date,
      remarks: policy.remarks ?? "",
    };

    return (
      <AppShell title="Edit Policy">
        <PolicyRemarksActionStyle />
        <div data-policy-edit-form>
          <PolicyCommercialShell
            key={customer.updated_at ?? "customer"}
            mode="edit"
            insurers={insurerOptions}
            customers={customerOptions}
            rms={rmOptions}
            sources={sourceOptions}
            initialValues={initialValues}
            nonMotorInitialValues={nonMotorInitialValues}
            commercialAccess={commercialAccess}
          />
          <PolicyLinkedMasterActions
            customerId={policy.customer_id}
            vehicleId={null}
            canEditCustomer={Boolean(customerManager)}
            canEditVehicle={false}
          />
        </div>
        <div className="mx-auto mt-4 max-w-[1480px]">
          <PolicyActivityStatus
            policyId={policy.id}
            createdBy={creatorResult.data?.full_name ?? null}
            createdAt={policy.created_at}
            updatedAt={policy.updated_at}
          />
        </div>
      </AppShell>
    );
  }

  const vehicle = vehicleResult.data!;
  const vehicleClass = vehicle.vehicle_class_code || vehicle.vehicle_type || "MISD";

  const initialValues: PolicyUnifiedInitialValues = {
    policyId: policy.id,
    policyCode: policy.policy_code ?? "",
    issuanceDate: policy.issuance_date ?? policy.start_date,
    rmName: policy.rm_name ?? "",
    intermediaryType: policy.intermediary_type ?? "",
    leadSource: policy.lead_source ?? "",
    intermediaryCode: policy.intermediary_code ?? "",
    businessLine: policy.business_line ?? "Motor",
    registrationNo: vehicle.vehicle_no,
    insuredName: customer.contact_name,
    phoneNo: customer.phone ?? "",
    vehicleClass,
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    fuelType: vehicle.fuel_type ?? "",
    capacity: vehicleCapacity(vehicle, vehicleClass),
    manufacturingYear: stringValue(vehicle.year),
    chassisNo: vehicle.chassis_no ?? "",
    engineNo: vehicle.engine_no ?? "",
    rtoState: vehicle.rto_state ?? "",
    rtoName: vehicle.rto_name ?? "",
    policyProduct: policy.policy_type,
    idv: stringValue(policy.insured_declared_value),
    od: stringValue(premium?.od_premium),
    tp: stringValue(premium?.tp_premium),
    cpaOpted: premium?.cpa_opted === false ? "No" : "Yes",
    cpa: stringValue(premium?.cpa_amount),
    policyNo: policy.policy_no,
    insurerId: policy.insurance_company_id,
    validFrom: policy.start_date,
    validUpto: policy.end_date,
    payoutBasis: commercialAccess ? (payin?.payout_basis ?? "NET") : "",
    projectedOdPercent: commercialAccess && payinHasConfirmedEntry ? stringValue(payin?.projected_od_percent) : "",
    projectedTpPercent: commercialAccess && payinHasConfirmedEntry ? stringValue(payin?.projected_tp_percent) : "",
    insurerScheme: commercialAccess && payinHasConfirmedEntry ? stringValue(payin?.insurer_scheme_amount) : "",
    payinBillNo: commercialAccess ? billing.billNumber : "",
    payinBilledAmount: commercialAccess ? billing.billedAmount : "",
    payinBillDate: commercialAccess ? billing.billDate : "",
    payinStatus: commercialAccess ? billing.status : "Unbilled",
    retention: commercialAccess ? stringValue(payout?.retention_amount) : "",
    payoutOdPercent: commercialAccess && payoutHasConfirmedEntry ? stringValue(payout?.od_payout_percent) : "",
    payoutTpPercent: commercialAccess && payoutHasConfirmedEntry ? stringValue(payout?.tp_payout_percent) : "",
    payoutStatus: commercialAccess ? (payout?.status ?? "Pending") : "Pending",
    payoutDate: commercialAccess ? (payout?.payout_date ?? "") : "",
    payoutVoucherNo: commercialAccess ? (payout?.voucher_number ?? "") : "",
    remarks: policy.remarks ?? "",
  };

  const masterRevisionKey = `${customer.updated_at ?? "customer"}:${vehicle.updated_at ?? "vehicle"}`;

  return (
    <AppShell title="Edit Policy">
      <PolicyRemarksActionStyle />
      <div data-policy-edit-form>
        <PolicyCommercialShell
          key={masterRevisionKey}
          mode="edit"
          insurers={insurerOptions}
          rms={rmOptions}
          sources={sourceOptions}
          initialValues={initialValues}
          commercialAccess={commercialAccess}
        />
        <PolicyLinkedMasterActions
          customerId={policy.customer_id}
          vehicleId={vehicleId}
          canEditCustomer={Boolean(customerManager)}
          canEditVehicle={canEditVehicle}
        />
      </div>
      <div className="mx-auto mt-4 max-w-[1480px]">
        <PolicyActivityStatus
          policyId={policy.id}
          createdBy={creatorResult.data?.full_name ?? null}
          createdAt={policy.created_at}
          updatedAt={policy.updated_at}
        />
        <PolicyEditActionFooter />
      </div>
    </AppShell>
  );
}