import type { N8nOcrBridgeInput, N8nOcrBridgeResponse, N8nOcrField } from "./policy-intake-n8n-validation";

/**
 * Separate fail-closed 16-check Tata AIG third-party-only contract.
 * A valid extraction is NOT authority to register a policy or bypass review.
 */
const TP_PRODUCTS = {
  tata_aig_private_car_liability_only_n8n_native_pdf: "tata-aig-tp-v1",
  tata_aig_private_car_three_year_tp_n8n_native_pdf: "tata-aig-3y-tp-v1",
} as const;
const CHECK_KEYS = [
  "insurer","product","policy","insured","registration","vehicle","specs","rto",
  "tp_period","pa_period","liability","net","tax","header_total","receipt_date","no_od_cover",
] as const;
const FIELD_KEYS = new Set([
  "policy_number","insurer_name","policy_product","insured_name","vehicle_registration_status",
  "vehicle_registration_number","vehicle_class","vehicle_make","vehicle_model","vehicle_fuel_type",
  "vehicle_manufacturing_year","vehicle_capacity","vehicle_chassis_number","vehicle_engine_number",
  "vehicle_rto_name","vehicle_rto_state","policy_start_date","policy_end_date",
  "third_party_start_date","third_party_end_date","cpa_start_date","cpa_end_date",
  "od_premium","add_on_premium","tp_premium","cpa_premium","cpa_opted",
]);
const REQUIRED = [
  "policy_number","insurer_name","policy_product","insured_name","vehicle_registration_status",
  "vehicle_class","vehicle_make","vehicle_model","vehicle_fuel_type",
  "vehicle_manufacturing_year","vehicle_capacity","vehicle_chassis_number",
  "vehicle_engine_number","vehicle_rto_name","policy_start_date","policy_end_date",
  "third_party_start_date","third_party_end_date","od_premium","add_on_premium",
  "tp_premium","cpa_premium","cpa_opted",
];
const WARNINGS = new Set([
  "tata_aig_issuance_date_requires_verified_pdf_signature",
  "tata_aig_human_review_required",
]);
type Json = Record<string, unknown>;
const obj = (v: unknown): v is Json => Boolean(v && typeof v === "object" && !Array.isArray(v));
const fail = (code: string): never => { throw new Error(code); };
function validDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === v;
}
function monetary(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1e9
      || Math.abs(v * 100 - Math.round(v * 100)) > 0.00001) fail("n8n_tp_premium_invalid");
  return v;
}
const cents = (v: number) => Math.round(v * 100);
export function isTataAigTpParser(id: unknown): id is keyof typeof TP_PRODUCTS {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(TP_PRODUCTS, id);
}
export function validateTataAigTpResponse(
  value: Json,
  ids: Pick<N8nOcrBridgeInput, "intakeId" | "documentId" | "requestId">,
): N8nOcrBridgeResponse {
  if (value.contract_version !== "1" || value.intake_id !== ids.intakeId
    || value.document_id !== ids.documentId || value.request_id !== ids.requestId)
    fail("n8n_request_identity_mismatch");
  if (!isTataAigTpParser(value.parser_id)
    || value.parser_version !== TP_PRODUCTS[value.parser_id]
    || value.ok !== true || value.review_required !== true || value.auto_finalize_allowed !== false
    || value.extraction_method !== "native_pdf_text")
    fail("n8n_tp_contract_invalid");
  const longTerm = value.parser_id === "tata_aig_private_car_three_year_tp_n8n_native_pdf";
  if (!obj(value.checks) || Object.keys(value.checks).length !== CHECK_KEYS.length
    || CHECK_KEYS.some(k => value.checks && (value.checks as Json)[k] !== true)
    || value.checks_passed !== CHECK_KEYS.length
    || !Array.isArray(value.failed_checks) || value.failed_checks.length !== 0)
    fail("n8n_tp_checks_invalid");
  if (!Array.isArray(value.warnings) || value.warnings.length !== 2
    || value.warnings.some(w => typeof w !== "string" || !WARNINGS.has(w))
    || new Set(value.warnings).size !== 2)
    fail("n8n_tp_warning_invalid");
  if (!Array.isArray(value.fields) || value.fields.length < REQUIRED.length
    || value.fields.length > FIELD_KEYS.size) fail("n8n_tp_fields_invalid");
  const seen = new Set<string>();
  const fields: N8nOcrField[] = value.fields.map((item: unknown) => {
    if (!obj(item) || typeof item.key !== "string" || !FIELD_KEYS.has(item.key)
      || seen.has(item.key) || typeof item.value !== "string" || !item.value.trim()
      || item.value.length > 300 || typeof item.label !== "string" || item.label.length > 100
      || item.confidence !== null || !Number.isInteger(item.page) || Number(item.page) < 1
      || Number(item.page) > 20 || typeof item.evidence !== "string" || item.evidence.length > 120)
      fail("n8n_tp_field_invalid");
    seen.add(item.key);
    return {key:item.key,value:item.value,label:item.label,page:item.page as number,
      confidence:null,evidence:item.evidence};
  });
  if (REQUIRED.some(k => !seen.has(k))) fail("n8n_tp_required_field_missing");
  const get=(key:string)=>fields.find(f=>f.key===key)?.value.trim() ?? "";
  if (!/^\d{10}\s+\d{2}\s+\d{2}$/.test(get("policy_number"))
    || get("insurer_name") !== "TATA AIG GENERAL INSURANCE COMPANY LIMITED"
    || get("policy_product") !== "Third-Party Only" || get("vehicle_class") !== "PCP"
    || !get("insured_name") || !/^[A-Z ]{2,80}$/i.test(get("vehicle_make"))
    || !/^(PETROL|DIESEL|CNG|LPG|ELECTRIC)$/i.test(get("vehicle_fuel_type"))
    || !/^(19|20)\d{2}$/.test(get("vehicle_manufacturing_year"))
    || !/^\d{2,5}$/.test(get("vehicle_capacity"))
    || !/^[A-Z0-9]{12,25}$/i.test(get("vehicle_chassis_number"))
    || !/^[A-Z0-9]{8,25}$/i.test(get("vehicle_engine_number"))
    || get("vehicle_engine_number")===get("vehicle_chassis_number"))
    fail("n8n_tp_policy_or_vehicle_invalid");
  const status = get("vehicle_registration_status").toLowerCase();
  if (longTerm ? status !== "unregistered" || seen.has("vehicle_registration_number")
      : status !== "registered" || !/^[A-Z]{2}[A-Z0-9]{7,13}$/.test(get("vehicle_registration_number")))
    fail("n8n_tp_registration_invalid");
  const tpStart=get("third_party_start_date"),tpEnd=get("third_party_end_date");
  if (!validDate(tpStart) || !validDate(tpEnd) || tpEnd < tpStart
    || get("policy_start_date") !== tpStart || get("policy_end_date") !== tpEnd)
    fail("n8n_tp_coverage_invalid");
  if (longTerm) {
    if (Number(tpEnd.slice(0,4)) !== Number(tpStart.slice(0,4))+3
      || get("cpa_opted") !== "No" || seen.has("cpa_start_date") || seen.has("cpa_end_date"))
      fail("n8n_tp_cpa_period_invalid");
  } else if (get("cpa_opted") !== "Yes" || get("cpa_start_date") !== tpStart
      || get("cpa_end_date") !== tpEnd || !get("vehicle_rto_state")) {
    fail("n8n_tp_cpa_period_invalid");
  }
  const p=value.premium_components;
  if (!obj(p) || !Array.isArray(p.od_addons) || p.od_addons.length !== 0
    || p.basic_od_premium !== 0 || p.addon_subtotal !== 0) fail("n8n_tp_premium_shape_invalid");
  const basic=monetary(p.basic_tp_premium),cpa=monetary(p.owner_driver_cpa);
  const paid=monetary(p.paid_driver_liability),liability=monetary(p.total_liability_premium);
  const net=monetary(p.printed_net_premium),tax=monetary(p.printed_total_tax);
  const gross=monetary(p.gross_premium);
  const receiptDate=p.receipt_date;
  if (typeof receiptDate !== "string" || !validDate(receiptDate)) fail("n8n_tp_receipt_date_invalid");
  const fieldCents=(k:string)=>/^\d+(?:\.\d{1,2})?$/.test(get(k))
    ? cents(Number(get(k))) : NaN;
  if (cents(basic+cpa+paid)!==cents(liability)
    || cents(liability)!==cents(net) || cents(net+tax)!==cents(gross)
    || fieldCents("tp_premium")!==cents(basic+paid)
    || fieldCents("cpa_premium")!==cents(cpa)
    || fieldCents("od_premium")!==0 || fieldCents("add_on_premium")!==0
    || (longTerm ? cpa!==0 || paid!==0 : cpa<=0))
    fail("n8n_tp_premium_reconciliation_failed");
  return {
    ok:true,fields,warnings:value.warnings as string[],parserId:value.parser_id,
    parserVersion:value.parser_version as string,checksPassed:16,receiptDate,
    premium:{basicOd:0,odAddons:[],totalOd:0,basicTp:basic,cpa,liability,
      net,exactIgst:tax,tax,gross,tataAig:{product:"Third-Party Only",
      postNcbOd:0,addonSubtotal:0,paidDriverLiability:paid,
      passengerPa:0,roadsideAssistance:0,printedNet:net,ncbDiscount:0}},
  };
}
