import { notFound } from "next/navigation";
import { PolicyEditForm, type PolicyEditValues } from "@/components/policy-edit-form";
import { PolicyEditIntelligenceAnchor } from "@/components/policy-edit-intelligence-anchor";
import { PolicyIntelligencePositionGuard } from "@/components/policy-intelligence-position-guard";
import { PolicyOnboardingIntelligence } from "@/components/policy-onboarding-intelligence";
import { PolicySourceMasterWire } from "@/components/policy-source-master-wire";
import { AppShell } from "@/components/shell";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PolicyRow = {
  id: string; customer_id: string; vehicle_id: string; insurance_company_id: string;
  policy_no: string; policy_type: string; insured_declared_value: number | null;
  start_date: string; end_date: string; policy_code: string | null;
  intermediary_type: string | null; intermediary_code: string | null; lead_source: string | null;
  rm_name: string | null; business_line: string | null; issuance_date: string | null; remarks: string | null;
};
type CustomerRow = { id: string; contact_name: string; phone: string | null };
type VehicleRow = {
  id: string; vehicle_no: string; vehicle_type: string | null; vehicle_class_code: string | null;
  vehicle_class_description: string | null; make: string | null; model: string | null; year: number | null;
  chassis_no: string | null; engine_no: string | null; fuel_type: string | null;
  engine_capacity_cc: number | null; seating_capacity: number | null; gvw_kg: number | null;
  rto_name: string | null; rto_state: string | null;
};
type PremiumRow = { od_premium: number | null; tp_premium: number | null; cpa_opted: boolean | null; cpa_amount: number | null };
type PayinRow = { payout_basis: string | null; projected_od_percent: number | null; projected_tp_percent: number | null; insurer_scheme_amount: number | null };
type PayoutRow = { retention_amount: number | null; od_payout_percent: number | null; tp_payout_percent: number | null; status: string | null; payout_date: string | null; voucher_number: string | null };
type InsurerOption = { id: string; name: string; is_active: boolean };
type IntermediaryOption = { id: string; intermediary_type: "posp" | "misp" | "partner"; display_name: string; intermediary_code: string | null };

export const dynamic = "force-dynamic";
export const revalidate = 0;

function stringValue(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function vehicleCapacity(vehicle: VehicleRow, vehicleClass: string) {
  if (vehicleClass === "PCP" || vehicleClass === "TWP") return stringValue(vehicle.engine_capacity_cc);
  if (vehicleClass === "PCV") return stringValue(vehicle.seating_capacity);
  if (vehicleClass === "GCV" || vehicleClass === "CPM") return stringValue(vehicle.gvw_kg);
  return stringValue(vehicle.engine_capacity_cc || vehicle.gvw_kg || vehicle.seating_capacity);
}

export default async function EditPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePolicyEditor();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const policyResult = await admin.from("policies")
    .select("id,customer_id,vehicle_id,insurance_company_id,policy_no,policy_type,insured_declared_value,start_date,end_date,policy_code,intermediary_type,intermediary_code,lead_source,rm_name,business_line,issuance_date,remarks")
    .eq("id", id).maybeSingle<PolicyRow>();
  if (policyResult.error) throw new Error(`Unable to load policy details: ${policyResult.error.message}`);
  if (!policyResult.data) notFound();
  const policy = policyResult.data;

  const [customerResult, vehicleResult, premiumResult, payinResult, payoutResult, activeInsurersResult, currentInsurerResult, salesEmployees, intermediariesResult] = await Promise.all([
    admin.from("customers").select("id,contact_name,phone").eq("id", policy.customer_id).maybeSingle<CustomerRow>(),
    admin.from("vehicles").select("id,vehicle_no,vehicle_type,vehicle_class_code,vehicle_class_description,make,model,year,chassis_no,engine_no,fuel_type,engine_capacity_cc,seating_capacity,gvw_kg,rto_name,rto_state").eq("id", policy.vehicle_id).maybeSingle<VehicleRow>(),
    admin.from("policy_premium_details").select("od_premium,tp_premium,cpa_opted,cpa_amount").eq("policy_id", id).maybeSingle<PremiumRow>(),
    admin.from("policy_payin_details").select("payout_basis,projected_od_percent,projected_tp_percent,insurer_scheme_amount").eq("policy_id", id).maybeSingle<PayinRow>(),
    admin.from("policy_intermediary_payouts").select("retention_amount,od_payout_percent,tp_payout_percent,status,payout_date,voucher_number").eq("policy_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle<PayoutRow>(),
    admin.from("insurance_companies").select("id,name,is_active").eq("is_active", true).order("name", { ascending: true }).returns<InsurerOption[]>(),
    admin.from("insurance_companies").select("id,name,is_active").eq("id", policy.insurance_company_id).maybeSingle<InsurerOption>(),
    loadPospMispAssociates(admin),
    admin.from("intermediaries").select("id,intermediary_type,display_name,intermediary_code").in("intermediary_type", ["posp","misp","partner"]).eq("account_status", "active").order("display_name", { ascending: true }).returns<IntermediaryOption[]>(),
  ]);

  const errors = [customerResult.error, vehicleResult.error, premiumResult.error, payinResult.error, payoutResult.error, activeInsurersResult.error, currentInsurerResult.error, intermediariesResult.error].filter(Boolean);
  if (errors.length) throw new Error(`Unable to load policy edit data: ${errors[0]?.message}`);
  if (!customerResult.data || !vehicleResult.data) throw new Error("The linked customer or vehicle record is missing.");

  const customer = customerResult.data;
  const vehicle = vehicleResult.data;
  const premium = premiumResult.data;
  const payin = payinResult.data;
  const payout = payoutResult.data;
  const vehicleClass = vehicle.vehicle_class_code || vehicle.vehicle_type || "MISD";

  const insurerById = new Map<string, InsurerOption>();
  for (const insurer of activeInsurersResult.data ?? []) insurerById.set(insurer.id, insurer);
  if (currentInsurerResult.data) insurerById.set(currentInsurerResult.data.id, currentInsurerResult.data);
  const insurerOptions = Array.from(insurerById.values()).sort((a,b)=>a.name.localeCompare(b.name)).map((insurer)=>({ value: insurer.id, label: insurer.is_active ? insurer.name : `${insurer.name} — Inactive` }));

  const rmOptions = salesEmployees.map((employee) => {
    const name = employee.full_name?.trim() || "Unnamed Sales Employee";
    return { value: name, label: employee.employee_code ? `${name} - ${employee.employee_code}` : name };
  });
  if (policy.rm_name && !rmOptions.some((item)=>item.value === policy.rm_name)) rmOptions.push({ value: policy.rm_name, label: `${policy.rm_name} · Saved value` });

  const sourceOptions = (intermediariesResult.data ?? []).filter((item)=>item.intermediary_code?.trim() && item.display_name?.trim()).map((item)=>({
    type: item.intermediary_type === "posp" ? "POSP" as const : item.intermediary_type === "misp" ? "MISP" as const : "SIBL / Partner" as const,
    value: item.id, label: item.display_name.trim(), code: item.intermediary_code!.trim(),
  }));
  if (policy.lead_source?.trim() && policy.intermediary_code?.trim() && policy.intermediary_type) {
    const savedType = policy.intermediary_type === "POSP" ? "POSP" as const : policy.intermediary_type === "MISP" ? "MISP" as const : "SIBL / Partner" as const;
    if (!sourceOptions.some((item)=>item.type === savedType && item.label.toLowerCase() === policy.lead_source!.trim().toLowerCase())) sourceOptions.push({ type: savedType, value: `saved-${id}`, label: policy.lead_source.trim(), code: policy.intermediary_code.trim() });
  }

  const values: PolicyEditValues = {
    policyId: policy.id, policyCode: policy.policy_code ?? "", issuanceDate: policy.issuance_date ?? policy.start_date,
    rmName: policy.rm_name ?? "", intermediaryType: policy.intermediary_type ?? "", leadSource: policy.lead_source ?? "", intermediaryCode: policy.intermediary_code ?? "", businessLine: policy.business_line ?? "Motor",
    registrationNo: vehicle.vehicle_no, insuredName: customer.contact_name, phoneNo: customer.phone ?? "", vehicleClass,
    make: vehicle.make ?? "", model: vehicle.model ?? "", fuelType: vehicle.fuel_type ?? "", capacity: vehicleCapacity(vehicle, vehicleClass), manufacturingYear: stringValue(vehicle.year), chassisNo: vehicle.chassis_no ?? "", engineNo: vehicle.engine_no ?? "", rtoState: vehicle.rto_state ?? "", rtoName: vehicle.rto_name ?? "",
    policyProduct: policy.policy_type, idv: stringValue(policy.insured_declared_value), od: stringValue(premium?.od_premium), tp: stringValue(premium?.tp_premium), cpaOpted: premium?.cpa_opted === false ? "No" : "Yes", cpa: stringValue(premium?.cpa_amount), policyNo: policy.policy_no, insurerId: policy.insurance_company_id, validFrom: policy.start_date, validUpto: policy.end_date,
    payoutBasis: payin?.payout_basis ?? "NET", projectedOdPercent: stringValue(payin?.projected_od_percent), projectedTpPercent: stringValue(payin?.projected_tp_percent), insurerScheme: stringValue(payin?.insurer_scheme_amount), retention: stringValue(payout?.retention_amount), payoutOdPercent: stringValue(payout?.od_payout_percent), payoutTpPercent: stringValue(payout?.tp_payout_percent), payoutStatus: payout?.status ?? "Pending", payoutDate: payout?.payout_date ?? "", payoutVoucherNo: payout?.voucher_number ?? "", remarks: policy.remarks ?? "",
  };

  return <AppShell title="Edit Policy">
    <PolicySourceMasterWire rms={rmOptions} sources={sourceOptions} />
    <PolicyEditIntelligenceAnchor />
    <PolicyOnboardingIntelligence />
    <PolicyIntelligencePositionGuard />
    <PolicyEditForm values={values} insurers={insurerOptions} />
  </AppShell>;
}
