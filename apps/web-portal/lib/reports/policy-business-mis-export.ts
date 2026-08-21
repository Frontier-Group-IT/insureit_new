import "server-only";
import { getAccessibleCustomerIds } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolvePolicyBusinessFilters, type PolicyBusinessQuery } from "@/lib/reports/policy-business";

type ViewerProfile = { id: string; role: string | null };
type Related<T> = T | T[] | null;
type CustomerRow = { contact_name: string | null; phone: string | null; customer_code: string | null };
type VehicleRow = {
  vehicle_no: string | null;
  vehicle_class_code: string | null;
  vehicle_class_description: string | null;
  make: string | null;
  model: string | null;
  fuel_type: string | null;
  gvw_kg: number | string | null;
  engine_capacity_cc: number | string | null;
  seating_capacity: number | string | null;
  year: number | string | null;
  chassis_no: string | null;
  engine_no: string | null;
  rto_state: string | null;
  rto_name: string | null;
};
type InsurerRow = { name: string | null };
type PremiumRow = {
  od_premium: number | string | null;
  tp_premium: number | string | null;
  cpa_amount: number | string | null;
  net_premium: number | string | null;
  gst_amount: number | string | null;
  gross_premium: number | string | null;
};
type PayinRow = {
  payout_basis: string | null;
  projected_od_percent: number | string | null;
  projected_od_amount: number | string | null;
  projected_tp_percent: number | string | null;
  projected_tp_amount: number | string | null;
  total_projected_payin: number | string | null;
  tds_amount: number | string | null;
  payin_after_tds: number | string | null;
};
type PayoutRow = {
  od_payout_percent: number | string | null;
  tp_payout_percent: number | string | null;
  gross_payout: number | string | null;
  retention_amount: number | string | null;
};
type PolicyRow = {
  id: string;
  issuance_date: string | null;
  rm_name: string | null;
  intermediary_type: string | null;
  lead_source: string | null;
  intermediary_code: string | null;
  policy_type: string | null;
  insured_declared_value: number | string | null;
  policy_no: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  customers: Related<CustomerRow>;
  vehicles: Related<VehicleRow>;
  insurance_companies: Related<InsurerRow>;
  policy_premium_details: Related<PremiumRow>;
  policy_payin_details: Related<PayinRow>;
  policy_intermediary_payouts: Related<PayoutRow>;
};

export type PolicyBusinessMisRow = {
  policyId: string;
  issuanceDate: string;
  rmName: string;
  intermediaryType: string;
  leadSource: string;
  intermediaryCode: string;
  vehicleClass: string;
  registrationNo: string;
  insuredName: string;
  phoneNo: string;
  classDescription: string;
  capacityType: string;
  make: string;
  model: string;
  fuelType: string;
  capacity: number | null;
  manufacturingYear: number | null;
  chassisNo: string;
  engineNo: string;
  policyProduct: string;
  idv: number;
  odPremium: number;
  tpPremium: number;
  cpa: number;
  netPremium: number;
  gst: number;
  grossPremium: number;
  policyNumber: string;
  insuranceCompany: string;
  validFrom: string;
  validUpto: string;
  rtoState: string;
  rtoName: string;
  payinBasis: string;
  payinOdPercent: number;
  payinOdAmount: number;
  payinTpPercent: number;
  payinTpAmount: number;
  totalPayin: number;
  tds: number;
  payinAfterTds: number;
  payoutOdPercent: number;
  payoutTpPercent: number;
  grossPayout: number;
  retention: number;
};

const PAGE_SIZE = 1000;
const MAX_EXPORT_ROWS = 10_000;
const SELECT = `
  id,issuance_date,rm_name,intermediary_type,lead_source,intermediary_code,policy_type,insured_declared_value,policy_no,start_date,end_date,status,
  customers!policies_customer_id_fkey(contact_name,phone,customer_code),
  vehicles!policies_vehicle_id_fkey(vehicle_no,vehicle_class_code,vehicle_class_description,make,model,fuel_type,gvw_kg,engine_capacity_cc,seating_capacity,year,chassis_no,engine_no,rto_state,rto_name),
  insurance_companies!policies_insurance_company_id_fkey(name),
  policy_premium_details(od_premium,tp_premium,cpa_amount,net_premium,gst_amount,gross_premium),
  policy_payin_details(payout_basis,projected_od_percent,projected_od_amount,projected_tp_percent,projected_tp_amount,total_projected_payin,tds_amount,payin_after_tds),
  policy_intermediary_payouts(od_payout_percent,tp_payout_percent,gross_payout,retention_amount)
`;

export async function loadPolicyBusinessMisExport(profile: ViewerProfile, query: PolicyBusinessQuery) {
  const filters = resolvePolicyBusinessFilters(query);
  const customerIds = await getAccessibleCustomerIds(profile.id, profile.role, "view_reports");
  if (customerIds !== null && customerIds.length === 0) return { rows: [] as PolicyBusinessMisRow[], truncated: false };

  const admin = createSupabaseAdminClient();
  const rows: PolicyRow[] = [];
  for (let offset = 0; offset <= MAX_EXPORT_ROWS; offset += PAGE_SIZE) {
    let request = admin
      .from("policies")
      .select(SELECT)
      .order("issuance_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (customerIds !== null) request = request.in("customer_id", customerIds);
    if (filters.fromDate) request = request.gte("issuance_date", filters.fromDate);
    if (filters.toDate) request = request.lte("issuance_date", filters.toDate);
    if (filters.insurerId) request = request.eq("insurance_company_id", filters.insurerId);
    if (filters.rmEmployeeId) request = request.eq("rm_employee_id", filters.rmEmployeeId);
    if (filters.intermediaryCode) request = request.eq("intermediary_code", filters.intermediaryCode);

    const { data, error } = await request.returns<PolicyRow[]>();
    if (error) throw new Error(`Detailed policy MIS query failed: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE || rows.length > MAX_EXPORT_ROWS) break;
  }

  const truncated = rows.length > MAX_EXPORT_ROWS;
  return { rows: rows.slice(0, MAX_EXPORT_ROWS).map(normalizeRow), truncated };
}

function normalizeRow(row: PolicyRow): PolicyBusinessMisRow {
  const customer = one(row.customers);
  const vehicle = one(row.vehicles);
  const insurer = one(row.insurance_companies);
  const premium = one(row.policy_premium_details);
  const payin = one(row.policy_payin_details);
  const payout = one(row.policy_intermediary_payouts);
  const vehicleClass = text(vehicle?.vehicle_class_code).toUpperCase();
  const capacityMeta = capacityFor(vehicleClass, vehicle);
  const vehicleNo = text(vehicle?.vehicle_no);

  return {
    policyId: row.id,
    issuanceDate: text(row.issuance_date),
    rmName: text(row.rm_name),
    intermediaryType: text(row.intermediary_type),
    leadSource: text(row.lead_source),
    intermediaryCode: text(row.intermediary_code),
    vehicleClass,
    registrationNo: vehicleNo.startsWith("PENDING-") ? "NEW" : vehicleNo,
    insuredName: text(customer?.contact_name),
    phoneNo: text(customer?.phone),
    classDescription: text(vehicle?.vehicle_class_description) || classDescription(vehicleClass),
    capacityType: capacityMeta.label,
    make: text(vehicle?.make),
    model: text(vehicle?.model),
    fuelType: text(vehicle?.fuel_type),
    capacity: capacityMeta.value,
    manufacturingYear: nullableNumber(vehicle?.year),
    chassisNo: text(vehicle?.chassis_no),
    engineNo: text(vehicle?.engine_no),
    policyProduct: text(row.policy_type),
    idv: number(row.insured_declared_value),
    odPremium: number(premium?.od_premium),
    tpPremium: number(premium?.tp_premium),
    cpa: number(premium?.cpa_amount),
    netPremium: number(premium?.net_premium),
    gst: number(premium?.gst_amount),
    grossPremium: number(premium?.gross_premium),
    policyNumber: text(row.policy_no),
    insuranceCompany: text(insurer?.name),
    validFrom: text(row.start_date),
    validUpto: text(row.end_date),
    rtoState: text(vehicle?.rto_state),
    rtoName: text(vehicle?.rto_name),
    payinBasis: text(payin?.payout_basis),
    payinOdPercent: number(payin?.projected_od_percent),
    payinOdAmount: number(payin?.projected_od_amount),
    payinTpPercent: number(payin?.projected_tp_percent),
    payinTpAmount: number(payin?.projected_tp_amount),
    totalPayin: number(payin?.total_projected_payin),
    tds: number(payin?.tds_amount),
    payinAfterTds: number(payin?.payin_after_tds),
    payoutOdPercent: number(payout?.od_payout_percent),
    payoutTpPercent: number(payout?.tp_payout_percent),
    grossPayout: number(payout?.gross_payout),
    retention: number(payout?.retention_amount),
  };
}

function capacityFor(vehicleClass: string, vehicle: VehicleRow | null) {
  if (vehicleClass === "GCV") return { label: "GVW", value: nullableNumber(vehicle?.gvw_kg) };
  if (vehicleClass === "CPM") return { label: "Equipment Capacity", value: nullableNumber(vehicle?.gvw_kg) ?? nullableNumber(vehicle?.engine_capacity_cc) };
  if (vehicleClass === "PCV") return { label: "Seating Capacity", value: nullableNumber(vehicle?.seating_capacity) };
  if (vehicleClass === "PCP" || vehicleClass === "TWP") return { label: "CC", value: nullableNumber(vehicle?.engine_capacity_cc) };
  return { label: "Capacity", value: nullableNumber(vehicle?.gvw_kg) ?? nullableNumber(vehicle?.engine_capacity_cc) };
}

function classDescription(vehicleClass: string) {
  if (vehicleClass === "PCP") return "Private Car";
  if (vehicleClass === "TWP") return "Two Wheeler";
  if (vehicleClass === "GCV") return "Goods Carrying Vehicle";
  if (vehicleClass === "PCV") return "Passenger Carrying Vehicle";
  if (vehicleClass === "CPM") return "Contractor Plant & Machinery";
  if (vehicleClass === "MISD") return "Miscellaneous Vehicle";
  return "";
}

function one<T>(value: Related<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
function text(value: unknown) { return value == null ? "" : String(value).trim(); }
function number(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function nullableNumber(value: unknown) { if (value == null || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
