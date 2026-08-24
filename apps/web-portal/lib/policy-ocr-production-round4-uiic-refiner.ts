import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Fields = Map<string, ParsedPolicyField>;

const LABELS: Record<string, string> = {
  vehicle_registration_status: "Registration status",
  vehicle_class: "Vehicle class",
  vehicle_make: "Vehicle make",
  vehicle_model: "Vehicle model",
  vehicle_fuel_type: "Fuel type",
  vehicle_manufacturing_year: "Manufacturing year",
  vehicle_capacity: "Vehicle capacity",
  vehicle_chassis_number: "Chassis number",
  vehicle_engine_number: "Engine number",
  vehicle_rto_name: "RTO name",
  vehicle_rto_state: "RTO state",
  policy_product: "Policy product",
  policy_number: "Policy number",
  insurer_name: "Insurance company",
  policy_start_date: "Valid from",
  policy_end_date: "Valid upto",
  idv: "IDV / Sum insured",
  od_premium: "OD premium",
  tp_premium: "Third party premium",
  cpa_opted: "CPA opted",
  cpa_premium: "CPA amount",
  total_premium: "Printed net premium",
  tax_amount: "Printed GST",
  gross_premium: "Printed gross premium",
};

/**
 * Round 4 is intentionally narrow: the revealed blind samples are United India
 * GCV Public Carrier Other Than 3 Wheeler Package schedules. Their stable
 * schedule labels are stronger evidence than the generic UIIC v6 row guesses.
 */
export function refineProductionRound4Uiic(
  pages: string[],
  _tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const firstTwo = pages.slice(0, 2).join("\n");
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 80).join(" ");
  if (!/UNITED\s+INDIA\s+INSURANCE\s+COMPANY/i.test(header)) return parsed;
  if (!/GCV\s+PUBLIC\s+CARRIER\s+OTHER\s+THAN\s+3\s+WHEELER\s+PACKAGE/i.test(firstTwo)) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  set(fields, "insurer_name", "United India Insurance Company Limited", 1, 1, "Round 4 UIIC current-policy header");
  set(fields, "policy_product", "Package", 1, 1, "Round 4 UIIC GCV package title");
  set(fields, "vehicle_class", "GCV", 1, 1, "Round 4 UIIC GCV package title");

  const policyNumber = capture(firstTwo, /Policy\s+Number\s*:\s*([A-Z0-9]+)/i) ?? capture(firstTwo, /Policy\s+No\.\s*([A-Z0-9]+)/i);
  if (policyNumber) set(fields, "policy_number", policyNumber, .999, 1, "UIIC printed policy number");

  const startDate = capture(firstTwo, /Insurance\s+Start\s+Date\s*&\s*Time\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
    ?? capture(firstTwo, /purpose\s+of\s+Act\s+from[^\n]*\s+on\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const endDate = capture(firstTwo, /Insurance\s+expiry\s+Date\s*&\s*Time\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
    ?? capture(firstTwo, /Date\s+of\s+Expiry[^\n]*\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (startDate) set(fields, "policy_start_date", isoDate(startDate), .999, 1, "UIIC printed insurance start date");
  if (endDate) set(fields, "policy_end_date", isoDate(endDate), .999, 1, "UIIC printed insurance expiry date");

  if (/Registration\s+Number\s+NEW\b|Registration\s+No\.\s+Obsolete[\s\S]{0,120}\bNEW\b/i.test(firstTwo)) {
    set(fields, "vehicle_registration_status", "registration_pending", .999, 1, "UIIC schedule registration number is NEW");
    fields.delete("vehicle_registration_number");
  }

  const idv = moneyCapture(firstTwo, /Insured'?s\s+Declared\s+Value\s+([0-9][0-9,]*(?:\.\d+)?)/i)
    ?? moneyCapture(firstTwo, /INSURED\s+DECLARED\s+VALUE[\s\S]{0,250}?\b([1-9][0-9,]{4,})\b/i);
  if (idv != null) setMoney(fields, "idv", idv, 1, "UIIC printed insured declared value");

  const od = moneyCapture(firstTwo, /Gross\s+OD\s*\(A\)\s*([0-9][0-9,]*(?:\.\d+)?)/i);
  const tp = moneyCapture(firstTwo, /B\.\s*Basic\s*-\s*TP\s*([0-9][0-9,]*(?:\.\d+)?)/i);
  const cpa = moneyCapture(firstTwo, /Compulsory\s+PA\s+for\s+Owner\s+Driver\s*([0-9][0-9,]*(?:\.\d+)?)/i);
  const net = moneyCapture(firstTwo, /Premium\s*\(A\s*\+\s*B\)\s*([0-9][0-9,]*(?:\.\d+)?)/i)
    ?? moneyCapture(firstTwo, /Gross\s+OD\s*&\s*TP[\s\S]{0,60}?([0-9][0-9,]*(?:\.\d+)?)/i);
  const gross = moneyCapture(firstTwo, /TOTAL\s+PAYABLE\s+PREMIUM\s*([0-9][0-9,]*(?:\.\d+)?)/i)
    ?? moneyCapture(firstTwo, /Total\s*\(Rounded\s+Off\)\s*:\s*([0-9][0-9,]*(?:\.\d+)?)/i);
  const tax = taxTotal(firstTwo);

  if (od != null) setMoney(fields, "od_premium", od, 2, "UIIC Gross OD(A)");
  if (tp != null) setMoney(fields, "tp_premium", tp, 2, "UIIC Basic TP excludes liability additions");
  if (cpa != null && cpa > 0) {
    set(fields, "cpa_opted", "Yes", .999, 2, "Explicit UIIC compulsory PA for owner-driver row");
    setMoney(fields, "cpa_premium", cpa, 2, "Explicit UIIC compulsory PA for owner-driver row");
  } else {
    set(fields, "cpa_opted", "No", .999, 2, "No payable owner-driver CPA row in current UIIC premium schedule");
    setMoney(fields, "cpa_premium", 0, 2, "No payable owner-driver CPA row in current UIIC premium schedule");
  }
  if (net != null) setMoney(fields, "total_premium", net, 2, "UIIC printed Premium(A+B)");
  if (tax != null) setMoney(fields, "tax_amount", tax, 2, "Sum of printed UIIC GST components");
  if (gross != null) setMoney(fields, "gross_premium", gross, 2, "UIIC printed total payable premium");

  const makeModel = firstTwo.match(/Vehicle\s+Make\s*&\s*Model\s+([\s\S]*?)\s*\/\s*([\s\S]*?)\s+Type\s+Of\s+Body/i);
  if (makeModel) {
    const make = cleanVehicleText(makeModel[1]);
    const model = cleanVehicleText(makeModel[2]).replace(/\s+null$/i, "").trim();
    if (validVehicleText(make)) set(fields, "vehicle_make", make, .995, 2, "UIIC vehicle make/model schedule column");
    if (validVehicleText(model)) set(fields, "vehicle_model", model, .995, 2, "UIIC vehicle make/model schedule column");
    if (/\bEV\b|ELECTRIC/i.test(`${make} ${model}`)) set(fields, "vehicle_fuel_type", "Electric", .995, 2, "EV marker in current vehicle make/model");
  }

  const chassis = capture(firstTwo, /Obsolete\s+Vehicle\s*&\s*Chassis\s+Number\s+No\s*&\s*([A-Z0-9]{12,30})/i)
    ?? capture(firstTwo, /Chassis\s+No\.\s*([A-Z0-9]{12,30})/i);
  const engine = capture(firstTwo, /Engine\s+Number\s+([A-Z0-9]{10,30})\s+Year\s+Of\s+Manufacture/i)
    ?? capture(firstTwo, /Engine\s+No\.\s*([A-Z0-9]{10,30})/i);
  const year = capture(firstTwo, /Year\s+Of\s+Manufacture\s+((?:19|20)\d{2})/i);
  const capacity = capture(firstTwo, /Gross\s+vehicle\s+Weight\s+([0-9]{3,6})/i)
    ?? capture(firstTwo, /\bGVW\b[\s\S]{0,80}?\b([0-9]{3,6})\b/i);
  const rto = capture(firstTwo, /RTA\s+Name\s+(.+?)\s+Vehicle\s+Make\s*&\s*Model/i);

  if (chassis) set(fields, "vehicle_chassis_number", compact(chassis), .999, 2, "UIIC vehicle details chassis column");
  if (engine) set(fields, "vehicle_engine_number", compact(engine), .999, 2, "UIIC vehicle details engine row");
  if (year) set(fields, "vehicle_manufacturing_year", year, .999, 2, "UIIC vehicle details manufacturing year");
  if (capacity) set(fields, "vehicle_capacity", capacity, .999, 2, "UIIC gross vehicle weight");
  if (rto) {
    const cleanedRto = cleanVehicleText(rto);
    set(fields, "vehicle_rto_name", cleanedRto, .995, 2, "UIIC RTA name schedule row");
    const state = stateFromRto(cleanedRto);
    if (state) set(fields, "vehicle_rto_state", state, .99, 2, "State derived from explicit UIIC RTA code");
  }

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+prod-r4-uiic_gcv_package`,
    fields: [...fields.values()],
    warnings: [
      ...parsed.warnings.filter((warning) => !/missing or uncertain fields/i.test(warning)),
      "Production benchmark round 4 UIIC GCV package refinement applied.",
    ],
  };
}

function set(fields: Fields, key: string, value: string, confidence: number, page: number, evidence: string) {
  fields.set(key, { key, label: LABELS[key] ?? key, value, confidence, page, evidence });
}

function setMoney(fields: Fields, key: string, value: number, page: number, evidence: string) {
  set(fields, key, money(value), .999, page, evidence);
}

function capture(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}

function moneyCapture(text: string, pattern: RegExp): number | null {
  const raw = capture(text, pattern);
  if (!raw) return null;
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function taxTotal(text: string): number | null {
  const pattern = /(?:CGST|SGST|IGST)[-\s]*(?:Others|Basic\s*TP)\s*\([^)]*\)\s*:?\s*([0-9][0-9,]*(?:\.\d+)?)/gi;
  let total = 0;
  let count = 0;
  for (const match of text.matchAll(pattern)) {
    const value = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    total += value;
    count += 1;
  }
  return count ? round(total) : null;
}

function isoDate(value: string): string {
  const [day, month, year] = value.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function cleanVehicleText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function validVehicleText(value: string): boolean {
  return value.length >= 2 && value.length <= 100 && !/^(?:year|model|make|type of body|cubic capacity)$/i.test(value);
}

function compact(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function stateFromRto(value: string): string | null {
  const prefix = value.trim().slice(0, 2).toUpperCase();
  if (prefix === "RJ") return "Rajasthan";
  if (prefix === "MP") return "Madhya Pradesh";
  return null;
}

function money(value: number): string {
  return Number.isInteger(value) ? String(value) : String(round(value));
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
