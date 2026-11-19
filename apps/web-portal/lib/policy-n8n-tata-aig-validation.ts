import type { N8nOcrBridgeInput, N8nOcrBridgeResponse, N8nOcrField } from "./policy-intake-n8n-validation";

/** Independent Tata AIG private-car native-PDF contract. Never relax ICICI's checks. */
const PRODUCTS = {
  tata_aig_private_car_saod_n8n_native_pdf: "Stand-Alone Own Damage",
  tata_aig_private_car_package_n8n_native_pdf: "Package",
  tata_aig_private_car_bundled_n8n_native_pdf: "Bundled",
} as const;
const CHECKS = new Set([
  "current_insurer_verified", "supported_layout_verified", "policy_identity_verified",
  "insured_present", "vehicle_identity_verified", "vehicle_registration_status_verified",
  "vehicle_specs_verified", "rto_resolved", "idv_verified", "coverage_periods_verified",
  "basic_od_ncb_reconciled", "itemized_addons_reconciled", "liability_components_reconciled",
  "net_premium_reconciled", "tax_premium_reconciled", "gross_premium_reconciled",
  "receipt_signature_date_agree", "policy_number_receipt_agree",
]);
const FIELD_KEYS = new Set([
  "policy_number", "insurer_name", "policy_product", "insured_name",
  "vehicle_registration_status", "vehicle_registration_number", "vehicle_class",
  "vehicle_make", "vehicle_model", "vehicle_fuel_type", "vehicle_manufacturing_year",
  "vehicle_capacity", "vehicle_motor_power_kw", "vehicle_chassis_number",
  "vehicle_engine_number", "vehicle_rto_name", "vehicle_rto_state", "idv",
  "policy_start_date", "policy_end_date", "third_party_start_date",
  "third_party_end_date", "third_party_policy_number", "cpa_start_date",
  "cpa_end_date", "od_premium", "add_on_premium", "tp_premium",
  "cpa_premium", "cpa_opted",
]);
const REQUIRED_FIELDS = [
  "policy_number", "insurer_name", "policy_product", "insured_name",
  "vehicle_registration_status", "vehicle_class", "vehicle_make", "vehicle_model",
  "vehicle_fuel_type", "vehicle_manufacturing_year", "vehicle_capacity",
  "vehicle_chassis_number", "vehicle_engine_number", "vehicle_rto_name",
  "vehicle_rto_state", "idv", "policy_start_date", "policy_end_date",
  "third_party_start_date", "third_party_end_date", "od_premium",
  "add_on_premium", "tp_premium", "cpa_premium", "cpa_opted",
];
const INFO_WARNINGS = new Set([
  "tata_aig_issuance_date_unverified",
  "tata_aig_human_review_required",
  "tata_aig_printed_net_rounding",
]);
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fail(code: string): never { throw new Error(code); }
function amount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0
    || value > 1_000_000_000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.00001)
    fail("n8n_tata_aig_amount_invalid");
  return value;
}
const cents = (value: number) => Math.round(value * 100);
const near = (left: number, right: number, tolerance = 0.05) => Math.abs(left - right) <= tolerance;
function date(raw: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const parsed = new Date(raw + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10) === raw;
}

/** Never use receipt/signature/coverage start as an independently verified issuance date. */
export function validateTataAigN8nResponse(
  value: Record<string, unknown>,
  ids: Pick<N8nOcrBridgeInput, "intakeId" | "documentId" | "requestId">,
): N8nOcrBridgeResponse {
  if (value.contract_version !== "1" || value.intake_id !== ids.intakeId
    || value.document_id !== ids.documentId || value.request_id !== ids.requestId)
    fail("n8n_request_identity_mismatch");
  const parserId = value.parser_id;
  if (typeof parserId !== "string" || !(parserId in PRODUCTS)
    || value.parser_version !== "tata-aig-layout-v1" || value.ok !== true
    || value.review_required !== true || value.auto_finalize_allowed !== false
    || value.extraction_method !== "native_pdf_text") fail("n8n_review_required");
  const product = PRODUCTS[parserId as keyof typeof PRODUCTS];
  const checks = value.checks;
  if (!object(checks) || Object.keys(checks).length !== CHECKS.size
    || [...CHECKS].some(key => checks[key] !== true)
    || Object.values(checks).some(item => item !== true))
    fail("n8n_financial_validation_failed");
  if (!Array.isArray(value.fields) || value.fields.length < REQUIRED_FIELDS.length
    || value.fields.length > FIELD_KEYS.size) fail("n8n_fields_invalid");

  const seen = new Set<string>();
  const fields = (value.fields as unknown[]).map((item): N8nOcrField => {
    if (!object(item) || typeof item.key !== "string" || !FIELD_KEYS.has(item.key)
      || seen.has(item.key) || typeof item.value !== "string" || !item.value.trim()
      || item.value.length > 300 || typeof item.label !== "string"
      || item.label.length > 100 || item.confidence !== null
      || (item.page !== null && (!Number.isInteger(item.page) || Number(item.page) < 1 || Number(item.page) > 20))
      || typeof item.evidence !== "string" || item.evidence.length > 120)
      fail("n8n_field_shape_invalid");
    seen.add(item.key);
    return {
      key: item.key, label: item.label, value: item.value,
      page: item.page as number | null, confidence: null, evidence: item.evidence,
    };
  });
  if (REQUIRED_FIELDS.some(key => !seen.has(key)) || seen.has("policy_issuance_date"))
    fail("n8n_required_field_missing");
  const get = (key: string) => fields.find(field => field.key === key)?.value ?? "";
  const eq = (key: string, number: number) => {
    const raw = get(key).replace(/,/g, "");
    return /^\d+(?:\.\d{1,2})?$/.test(raw) && cents(Number(raw)) === cents(number);
  };
  if (!/^\d{14}$/.test(get("policy_number"))
    || get("insurer_name") !== "Tata AIG General Insurance Company Limited"
    || get("policy_product") !== product || get("vehicle_class") !== "PCP"
    || get("vehicle_fuel_type").toUpperCase() !== "PETROL"
    || !/^(?:19|20)\d{2}$/.test(get("vehicle_manufacturing_year"))
    || !/^[0-9]{2,5}(?:\.\d{1,2})?$/.test(get("vehicle_capacity"))
    || get("vehicle_engine_number").length < 6 || get("vehicle_chassis_number").length < 12
    || get("vehicle_engine_number") === get("vehicle_chassis_number")
    || !/^[a-z ]{2,60}$/i.test(get("vehicle_rto_name"))
    || !["HARYANA", "DELHI"].includes(get("vehicle_rto_state").toUpperCase()))
    fail("n8n_tata_aig_vehicle_or_policy_invalid");

  const status = get("vehicle_registration_status");
  const plate = get("vehicle_registration_number");
  if (status === "registered") {
    if (!/^(?:HR|DL)[A-Z0-9]{7,13}$/.test(plate)
      || (plate.startsWith("HR") ? "HARYANA" : "DELHI") !== get("vehicle_rto_state").toUpperCase())
      fail("n8n_tata_aig_registration_invalid");
  } else if (status === "unregistered") {
    if (plate || seen.has("vehicle_registration_number")) fail("n8n_tata_aig_registration_invalid");
  } else fail("n8n_tata_aig_registration_invalid");
  const odStart = get("policy_start_date"), odEnd = get("policy_end_date");
  const tpStart = get("third_party_start_date"), tpEnd = get("third_party_end_date");
  if (![odStart, odEnd, tpStart, tpEnd].every(date) || odEnd < odStart || tpEnd < tpStart
    || (product !== "Stand-Alone Own Damage" && (tpStart !== odStart || tpEnd < odEnd))
    || (product === "Bundled" && tpEnd === odEnd)) fail("n8n_coverage_dates_invalid");

  const money = value.premium_components;
  if (!object(money) || !Array.isArray(money.od_addons) || money.od_addons.length > 20)
    fail("n8n_premium_breakdown_missing");
  const basicOd = amount(money.basic_od_premium);
  const ncb = amount(money.ncb_deduction);
  const postNcbOd = amount(money.post_ncb_od_premium);
  const addonSubtotal = amount(money.addon_subtotal);
  const basicTp = amount(money.basic_tp_premium);
  const cpa = amount(money.owner_driver_cpa);
  const paidDriver = amount(money.paid_driver_liability);
  const passengerPa = amount(money.passenger_pa);
  const roadside = amount(money.roadside_assistance);
  const liability = amount(money.total_liability_premium);
  const printedNet = amount(money.printed_net_premium);
  const net = amount(money.component_net_premium);
  const tax = amount(money.printed_total_tax);
  const gross = amount(money.gross_premium);
  const odAddons = money.od_addons.map((item: unknown) => {
    if (!object(item) || typeof item.name !== "string"
      || item.name.length < 2 || item.name.length > 90
      || typeof item.code !== "string" || !/^TA\d{2}$/.test(item.code))
      fail("n8n_premium_addon_invalid");
    return { name: item.name, amount: amount(item.amount) };
  });
  const addonSum = odAddons.reduce((sum, item) => sum + item.amount, 0);
  const projectedTp = basicTp + paidDriver + passengerPa + (product === "Stand-Alone Own Damage" ? 0 : roadside);
  const projectedAddons = addonSubtotal + (product === "Stand-Alone Own Damage" ? roadside : 0);
  if (!near(basicOd - ncb, postNcbOd, 0.03) || !near(addonSum, addonSubtotal, 0.04)
    || !near(basicTp + cpa + paidDriver + passengerPa, liability, 0.02)
    || !near(postNcbOd + addonSubtotal + liability + roadside, net, 0.04)
    || !near(net, printedNet, 1.01) || cents(printedNet + tax) !== cents(gross)
    || !eq("od_premium", postNcbOd) || !eq("add_on_premium", projectedAddons)
    || !eq("tp_premium", projectedTp) || !eq("cpa_premium", cpa)
    || !eq("idv", Number(get("idv"))) || !(Number(get("idv")) > 0)
    || get("cpa_opted") !== (cpa > 0 ? "Yes" : "No"))
    fail("n8n_premium_reconciliation_failed");
  if (product === "Stand-Alone Own Damage" && (basicTp !== 0 || cpa !== 0 || liability !== 0))
    fail("n8n_tata_aig_saod_liability_invalid");
  if (cpa > 0 && (!date(get("cpa_start_date")) || !date(get("cpa_end_date"))
      || get("cpa_end_date") < get("cpa_start_date")))
    fail("n8n_tata_aig_cpa_period_invalid");

  if (!Array.isArray(value.warnings) || value.warnings.length > 5
    || value.warnings.some(item => typeof item !== "string" || !INFO_WARNINGS.has(item))
    || !value.warnings.includes("tata_aig_issuance_date_unverified"))
    fail("n8n_tata_aig_warning_invalid");
  return {
    ok:true, fields, warnings:value.warnings as string[],
    parserId, parserVersion:"tata-aig-layout-v1", checksPassed:CHECKS.size,
    premium:{
      basicOd, odAddons, totalOd:postNcbOd + addonSubtotal, basicTp,
      cpa, liability, net, exactIgst:tax, tax, gross,
      odSubtotal:basicOd + addonSubtotal, odDeductions:ncb,
      tataAig:{
        product, postNcbOd, addonSubtotal, paidDriverLiability:paidDriver,
        passengerPa, roadsideAssistance:roadside, printedNet, ncbDiscount:ncb,
      },
    },
  };
}
