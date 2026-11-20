import type { PolicyIssuanceDateEvidence } from "@/lib/policy-issuance-signature-evidence";
const KEYS = new Set([
  "policy_number", "insurer_name", "policy_product", "policy_issuance_date", "policy_start_date", "policy_end_date",
  "third_party_start_date", "third_party_end_date", "third_party_policy_number", "third_party_insurer_name",
  "insured_name", "vehicle_make", "vehicle_model", "vehicle_class", "vehicle_fuel_type",
  "vehicle_motor_power_kw", "vehicle_capacity", "vehicle_rto_state", "vehicle_registration_status",
  "vehicle_registration_number", "vehicle_engine_number", "vehicle_chassis_number",
  "vehicle_manufacturing_year", "vehicle_rto_name", "idv", "od_premium", "tp_premium", "cpa_premium",
]);

// Fail closed if n8n omits or renames any safety check in this parser contract.
const REQUIRED_CHECKS = new Set([
  "is_icici_3005", "insured_name_present", "policy_number_present",
  "vehicle_details_present", "dates_present", "od_liability_equal_net",
  "tp_cpa_equal_liability", "net_tax_equal_gross", "idv_present",
  "manufacturing_year_present", "basic_od_plus_addons_equals_printed_total",
  "basic_tp_equals_derived_tp", "exact_igst_rounds_to_tax",
]);

const REQUIRED_OD_CHECKS = new Set([
  "is_icici_3005_od", "insured_name_present", "policy_number_present",
  "vehicle_details_present", "dates_present", "od_subtotal_reconciled",
  "ncb_deduction_reconciled", "net_tax_equal_gross", "idv_present",
  "manufacturing_year_present", "third_party_reference_present",
  "zero_tp_charged", "exact_igst_rounds_to_tax",
]);

export type N8nOcrField = {
  key: string; label: string; value: string; confidence: number | null;
  page: number | null; evidence: string;
};
/** Premium data is returned to the authorized reviewer only after server-side
 * arithmetic checks, never persisted or used to book a policy by the preview. */
export type N8nVerifiedPremiumBreakdown = {
  basicOd: number;
  odAddons: Array<{ name: string; amount: number }>;
  totalOd: number;
  basicTp: number;
  cpa: number;
  liability: number;
  net: number;
  exactIgst: number;
  tax: number;
  gross: number;
  /** OD-only: original PDF subtotal and No Claim Bonus/OD deductions. */
  odSubtotal?: number;
  odDeductions?: number;
  /** Tata AIG's separate OD, RSA and non-owner-liability components. */
  tataAig?: {
    product: string; postNcbOd: number; addonSubtotal: number;
    paidDriverLiability: number; passengerPa: number;
    roadsideAssistance: number; printedNet: number; ncbDiscount: number;
  };
};
export type N8nOcrBridgeResponse = {
  ok: true; fields: N8nOcrField[]; warnings: string[];
  parserId: string; parserVersion: string;
  premium: N8nVerifiedPremiumBreakdown;
  checksPassed: number;
  /** Printed n8n receipt date, not independently authoritative issuance. */
  receiptDate?: string;
  /** Optional signature timestamp proposal from the CURRENT signed PDF. */
  issuanceEvidence?: PolicyIssuanceDateEvidence;
};
export type N8nOcrBridgeInput = {
  intakeId: string; documentId: string; requestId: string; file: File;
};

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validate the remote response rather than trusting an external workflow to
 * authorize intake changes. No database write, claim, customer creation or
 * finalization happens here. The caller owns scope and lifecycle checks.
 */
export function validateN8nPolicyIntakeResponse(
  value: unknown, ids: Pick<N8nOcrBridgeInput, "intakeId" | "documentId" | "requestId">,
): N8nOcrBridgeResponse {
  // Tata AIG uses a separately proven 18-check accounting contract. Leave
  // every ICICI-3005/3005-O guard below unchanged.
  if (plainObject(value) && typeof value.parser_id === "string"
      && value.parser_id.startsWith("tata_aig_")) {
    return validateTataAigN8nResponse(value, ids);
  }
  if (!plainObject(value) || value.contract_version !== "1") throw new Error("n8n_contract_version_invalid");
  if (value.intake_id !== ids.intakeId || value.document_id !== ids.documentId
      || value.request_id !== ids.requestId) throw new Error("n8n_request_identity_mismatch");
  const isOd = value.parser_id === "icici_3005_od_n8n_native_pdf"
    && value.parser_version === "bridge-od-v1";
  const isBundled = value.parser_id === "icici_3005_n8n_native_pdf"
    && value.parser_version === "bridge-v1";
  // The shared n8n webhook serves commercial motor parsers as well. If the
  // separate commercial classifier missed one, report that routing defect
  // instead of disguising it as an untrained policy or generic review failure.
  if (["go_digit_cv_native_pdf","new_india_cv_native_pdf","iffco_tokio_cv_native_pdf"]
      .includes(String(value.parser_id))) {
    throw new Error("n8n_commercial_classifier_missed_layout");
  }
  if (value.ok !== true || value.review_required !== true || value.auto_finalize_allowed !== false
      || (!isOd && !isBundled)
      || value.extraction_method !== "native_pdf_text") throw new Error("n8n_review_required");
  const checks = value.checks;
  const requiredChecks = isOd ? REQUIRED_OD_CHECKS : REQUIRED_CHECKS;
  if (!plainObject(checks) || Object.keys(checks).length !== requiredChecks.size
      || [...requiredChecks].some((key) => checks[key] !== true)
      || Object.values(checks).some((check) => check !== true)) {
    throw new Error("n8n_financial_validation_failed");
  }
  if (!Array.isArray(value.fields) || value.fields.length < 12 || value.fields.length > KEYS.size
      || !Array.isArray(value.warnings) || value.warnings.length > 30) throw new Error("n8n_fields_invalid");

  const seen = new Set<string>();
  const fields: N8nOcrField[] = value.fields.map((field: unknown): N8nOcrField => {
    if (!plainObject(field) || typeof field.key !== "string" || !KEYS.has(field.key)
        || seen.has(field.key) || typeof field.value !== "string"
        || !field.value.trim() || field.value.length > 300
        || typeof field.label !== "string" || field.label.length > 100
        || typeof field.evidence !== "string" || field.evidence.length > 120
        || field.confidence !== null
        || (field.page !== null && (!Number.isInteger(field.page) || Number(field.page) < 1 || Number(field.page) > 10)))
      throw new Error("n8n_field_shape_invalid");
    seen.add(field.key);
    return { key: field.key, label: field.label, value: field.value,
      confidence: null, page: field.page as number | null, evidence: field.evidence };
  });

  for (const key of ["policy_number", "insurer_name", "insured_name", "policy_start_date",
    "policy_end_date", "third_party_start_date", "third_party_end_date",
    "vehicle_engine_number", "vehicle_chassis_number", "od_premium", "tp_premium"]) {
    if (!seen.has(key)) throw new Error("n8n_required_field_missing");
  }
  const fieldValue = (key: string) => fields.find((field) => field.key === key)?.value ?? "";
  const isoDate = (date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(date + "T00:00:00Z");
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  };
  // The current verified ICICI PDF workflow supplies an optional separately
  // printed "Policy Issued On" field. Never substitute cover start or today's
  // date. Validate it when present; missing evidence remains unverified.
  const issuanceDate = fieldValue("policy_issuance_date");
  if (issuanceDate && !isoDate(issuanceDate)) throw new Error("n8n_issuance_date_invalid");
  const startDate = fieldValue("policy_start_date");
  const endDate = fieldValue("policy_end_date");
  const tpStartDate = fieldValue("third_party_start_date");
  const tpEndDate = fieldValue("third_party_end_date");
  if (!isoDate(startDate) || !isoDate(endDate) || endDate < startDate
      || !isoDate(tpStartDate) || !isoDate(tpEndDate) || tpEndDate < tpStartDate
      || (!isOd && (tpStartDate !== startDate || tpEndDate < endDate))) {
    throw new Error("n8n_coverage_dates_invalid");
  }
  const policyNumber = fieldValue("policy_number");
  const expectedNumber = isOd
    ? /^3005\/O\/\d{7,12}\/\d{2}\/[A-Z0-9]{3}$/
    : /^3005\/\d{7,12}\/\d{2}\/[A-Z0-9]{3}$/;
  if (!expectedNumber.test(policyNumber)) throw new Error("n8n_wrong_policy_product");
  if (isOd && (!fieldValue("third_party_policy_number") || !fieldValue("third_party_insurer_name")
      || fieldValue("policy_product") !== "Stand-Alone Own Damage")) {
    throw new Error("n8n_od_reference_missing");
  }

  // Never accept a remote boolean as proof that the policy's money adds up.
  // All components below are parsed from PDF text by the n8n workflow.
  if (!plainObject(value.premium_components)) throw new Error("n8n_premium_breakdown_missing");
  const premium = value.premium_components;
  function exactMoney(v: unknown): number {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1_000_000_000
        || Math.abs(v * 100 - Math.round(v * 100)) > 0.00001) {
      throw new Error("n8n_premium_amount_invalid");
    }
    return v;
  }
  const basicOd = exactMoney(premium.basic_od_premium);
  const od = exactMoney(premium.total_od_premium);
  const tp = exactMoney(premium.basic_tp_premium);
  const cpa = exactMoney(premium.owner_driver_cpa);
  const liability = exactMoney(premium.total_liability_premium);
  const net = exactMoney(premium.net_premium);
  const igst = exactMoney(premium.igst_exact);
  const tax = exactMoney(premium.printed_total_tax);
  const gross = exactMoney(premium.gross_premium);
  if (!Array.isArray(premium.od_addons) || premium.od_addons.length > 12) {
    throw new Error("n8n_premium_addons_invalid");
  }
  const odAddons = premium.od_addons.map((addon: unknown): { name: string; amount: number } => {
    if (!plainObject(addon) || typeof addon.name !== "string"
        || addon.name.trim().length < 2 || addon.name.length > 90) {
      throw new Error("n8n_premium_addon_invalid");
    }
    return { name: addon.name.trim(), amount: exactMoney(addon.amount) };
  });
  const addOns = odAddons.reduce((total, addon) => total + addon.amount, 0);
  const cents = (number: number) => Math.round(number * 100);
  let odSubtotal: number | undefined;
  let odDeductions: number | undefined;
  if (isOd) {
    const subtotal = exactMoney(premium.printed_od_subtotal);
    const deduction = exactMoney(premium.od_deductions);
    odSubtotal = subtotal;
    odDeductions = deduction;
    if (cents(basicOd + addOns) !== cents(subtotal)
        || cents(subtotal - deduction) !== cents(od)
        || tp !== 0 || cpa !== 0 || liability !== 0 || cents(net) !== cents(od)
        || cents(net + tax) !== cents(gross) || Math.round(igst) !== tax) {
      throw new Error("n8n_premium_reconciliation_failed");
    }
  } else if (cents(basicOd + addOns) !== cents(od)
      || cents(tp + cpa) !== cents(liability)
      || cents(od + liability) !== cents(net)
      || cents(net + tax) !== cents(gross)
      || Math.round(igst) !== tax) {
    throw new Error("n8n_premium_reconciliation_failed");
  }
  const fieldByKey = new Map(fields.map((field) => [field.key, field.value]));
  const equalsField = (key: string, amount: number) =>
    Number((fieldByKey.get(key) ?? "").replace(/,/g, "")) === amount;
  if (!equalsField("od_premium", od) || !equalsField("tp_premium", tp)
      || !equalsField("cpa_premium", cpa)) {
    throw new Error("n8n_premium_field_mismatch");
  }

  const warnings = value.warnings.map((warning: unknown) => {
    if (typeof warning !== "string" || warning.length > 240) throw new Error("n8n_warning_invalid");
    return warning;
  });
  return { ok: true, fields, warnings, parserId: String(value.parser_id),
    parserVersion: String(value.parser_version),
    checksPassed: requiredChecks.size,
    premium: { basicOd, odAddons, totalOd: od, basicTp: tp, cpa, liability,
      net, exactIgst: igst, tax, gross,
      ...(isOd ? { odSubtotal, odDeductions } : {}) } };
}

/** Independent Tata AIG private-car native-PDF contract. Never relax ICICI's checks. */
const PRODUCTS = {
  tata_aig_private_car_saod_n8n_native_pdf: "Stand-Alone Own Damage",
  tata_aig_private_car_package_n8n_native_pdf: "Package",
  tata_aig_private_car_bundled_n8n_native_pdf: "Bundled",
  tata_aig_two_wheeler_bundled_n8n_native_pdf: "Bundled",
} as const;
const CHECKS = new Set([
  "current_insurer_verified", "supported_layout_verified", "policy_identity_verified",
  "insured_present", "vehicle_identity_verified", "vehicle_registration_status_verified",
  "vehicle_specs_verified", "rto_resolved", "idv_verified", "coverage_periods_verified",
  "basic_od_ncb_reconciled", "itemized_addons_reconciled", "liability_components_reconciled",
  "net_premium_reconciled", "tax_premium_reconciled", "gross_premium_reconciled",
  "receipt_date_document_consistent", "policy_number_receipt_agree",
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
  "tata_aig_signature_date_not_in_native_text",
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
  const receiptDate=(value.premium_components && object(value.premium_components)
    && typeof value.premium_components.receipt_date === "string")
    ? value.premium_components.receipt_date : undefined;
  if (receiptDate !== undefined && !date(receiptDate)) fail("n8n_tata_aig_receipt_date_invalid");
  const twoWheeler = parserId === "tata_aig_two_wheeler_bundled_n8n_native_pdf";
  const checks = value.checks;
  // Allow previously published Tata AIG response versions (which had printed
  // digital-signature dates) as well as the native PDF.js receipt-date check.
  // Exactly one of these receipt proof keys must exist, never both.
  const receiptProofKey = object(checks) && Object.prototype.hasOwnProperty.call(
    checks, "receipt_date_document_consistent")
      ? "receipt_date_document_consistent" : "receipt_signature_date_agree";
  const expectedChecks = new Set([...CHECKS].map(key =>
    key === "receipt_date_document_consistent" ? receiptProofKey : key));
  if (!object(checks) || Object.keys(checks).length !== CHECKS.size
    || Object.keys(checks).some(key => !expectedChecks.has(key))
    || [...expectedChecks].some(key => checks[key] !== true))
    fail("n8n_financial_validation_failed");
  const saod = product === "Stand-Alone Own Damage";
  if (!Array.isArray(value.fields) || value.fields.length < REQUIRED_FIELDS.length - (saod ? 2 : 0)
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
  // SAOD provides only new own-damage coverage. The policy may reference
  // a previous insurer's TP period, but that is not a new TP cover here.
  if (REQUIRED_FIELDS.some(key => !(saod && (key === "third_party_start_date" || key === "third_party_end_date")) && !seen.has(key))
    || seen.has("policy_issuance_date"))
    fail("n8n_required_field_missing");
  const get = (key: string) => fields.find(field => field.key === key)?.value ?? "";
  const eq = (key: string, number: number) => {
    const raw = get(key).replace(/,/g, "");
    return /^\d+(?:\.\d{1,2})?$/.test(raw) && cents(Number(raw)) === cents(number);
  };
  if (!/^\d{14}$/.test(get("policy_number"))
    || get("insurer_name") !== "Tata AIG General Insurance Company Limited"
    || get("policy_product") !== product || get("vehicle_class") !== (twoWheeler ? "TWP" : "PCP")
    // Tata AIG's native-PDF parser verifies the printed fuel type. Private
    // cars may be diesel, petrol, CNG, LPG or electric; only two-wheelers in
    // this trained product profile are required to be electric.
    || !(twoWheeler ? get("vehicle_fuel_type").toUpperCase() === "ELECTRIC"
      : ["PETROL","DIESEL","CNG","LPG","ELECTRIC"].includes(get("vehicle_fuel_type").toUpperCase()))
    || (twoWheeler && (get("vehicle_motor_power_kw") !== get("vehicle_capacity")
      || !/^[1-9][0-9]?(?:\\.[0-9]{1,2})?$/.test(get("vehicle_motor_power_kw"))))
    || !/^(?:19|20)\d{2}$/.test(get("vehicle_manufacturing_year"))
    || !(twoWheeler ? /^[1-9][0-9]?(?:\.\d{1,2})?$/.test(get("vehicle_capacity"))
      : /^[0-9]{2,5}(?:\.\d{1,2})?$/.test(get("vehicle_capacity")))
    || get("vehicle_engine_number").length < 6 || get("vehicle_chassis_number").length < 12
    || get("vehicle_engine_number") === get("vehicle_chassis_number")
    || !/^[a-z ]{2,60}$/i.test(get("vehicle_rto_name"))
    || !(twoWheeler ? get("vehicle_rto_state").toUpperCase() === "MADHYA PRADESH"
      && ["JABALPUR", "SATNA"].includes(get("vehicle_rto_name").toUpperCase())
      : ["HARYANA", "DELHI"].includes(get("vehicle_rto_state").toUpperCase())))

    fail("n8n_tata_aig_vehicle_or_policy_invalid");

  const status = get("vehicle_registration_status");
  const plate = get("vehicle_registration_number");
  if (status === "registered") {
    if (twoWheeler || !/^(?:HR|DL)[A-Z0-9]{7,13}$/.test(plate)
      || (plate.startsWith("HR") ? "HARYANA" : "DELHI") !== get("vehicle_rto_state").toUpperCase())
      fail("n8n_tata_aig_registration_invalid");
  } else if (status === "unregistered") {
    if (plate || seen.has("vehicle_registration_number")) fail("n8n_tata_aig_registration_invalid");
  } else fail("n8n_tata_aig_registration_invalid");
  const odStart = get("policy_start_date"), odEnd = get("policy_end_date");
  const tpStart = get("third_party_start_date"), tpEnd = get("third_party_end_date");
  if (!date(odStart) || !date(odEnd) || odEnd < odStart
    || (saod ? (Boolean(tpStart) !== Boolean(tpEnd)
        || (Boolean(tpStart) && (!date(tpStart) || !date(tpEnd) || tpEnd < tpStart)))
      : (!date(tpStart) || !date(tpEnd) || tpEnd < tpStart || tpStart !== odStart || tpEnd < odEnd
        || (product === "Bundled" && tpEnd === odEnd)
        || (twoWheeler && (tpEnd.slice(0,4) !== String(Number(odEnd.slice(0,4))+4)
          || tpStart !== odStart))))) fail("n8n_coverage_dates_invalid");

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
    ...(receiptDate?{receiptDate}:{}),
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
