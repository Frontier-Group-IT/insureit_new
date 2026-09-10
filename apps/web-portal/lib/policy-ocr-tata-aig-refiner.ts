import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const PARSER_ID = "tata_aig_motor_v1";
const PARSER_VERSION = "tata_aig_tw_bundled_v1.0.0";

type Fields = Map<string, ParsedPolicyField>;
type TextHit = { value: string; page: number; evidence: string };
type MoneyHit = { value: number; page: number; evidence: string };
type PeriodHit = { from: string; upto: string; page: number; evidence: string };

const LABELS: Record<string, string> = {
  vehicle_registration_status: "Registration status",
  vehicle_registration_number: "Registration number",
  vehicle_class: "Vehicle class",
  vehicle_make: "Vehicle make",
  vehicle_model: "Vehicle model",
  vehicle_fuel_type: "Fuel type",
  vehicle_manufacturing_year: "Manufacturing year",
  vehicle_capacity: "Vehicle capacity",
  vehicle_chassis_number: "Chassis number",
  vehicle_engine_number: "Engine number",
  vehicle_rto_name: "RTO name",
  policy_product: "Policy product",
  idv: "IDV / Sum insured",
  od_premium: "OD premium",
  tp_premium: "Third party premium",
  cpa_opted: "CPA opted",
  cpa_premium: "CPA amount",
  policy_number: "Policy number",
  insurer_name: "Insurance company",
  policy_start_date: "Valid from",
  policy_end_date: "Valid upto",
  total_premium: "Printed net premium",
  tax_amount: "Printed GST",
  gross_premium: "Printed gross premium",
};

const OWNED_KEYS = new Set([
  "vehicle_registration_status",
  "vehicle_registration_number",
  "vehicle_class",
  "vehicle_make",
  "vehicle_model",
  "vehicle_fuel_type",
  "vehicle_manufacturing_year",
  "vehicle_capacity",
  "vehicle_chassis_number",
  "vehicle_engine_number",
  "vehicle_rto_name",
  "policy_product",
  "idv",
  "od_premium",
  "tp_premium",
  "cpa_opted",
  "cpa_premium",
  "policy_number",
  "insurer_name",
  "policy_start_date",
  "policy_end_date",
  "total_premium",
  "tax_amount",
  "gross_premium",
]);

export function refineTataAigBundledTwoWheelerPolicy(
  pages: string[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const cleanPages = pages.map(sanitize);
  const header = (cleanPages[0] ?? "").split("\n").slice(0, 80).join(" ");
  const fullText = cleanPages.join("\n");
  if (!/TATA\s+AIG\s+GENERAL\s+INSURANCE/i.test(header)) return parsed;
  if (!/BUNDLED\s+AUTO\s+SECURE\s*-?\s*TWO\s+WHEELER|TWO\s+WHEELER\s+POLICY/i.test(fullText)) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  for (const key of OWNED_KEYS) fields.delete(key);
  const warnings = parsed.warnings.filter((warning) => !/not fully supported|missing or uncertain/i.test(warning));

  setField(fields, "insurer_name", "TATA AIG General Insurance Company Limited", 1, 1, "Current-policy TATA AIG header");
  setField(fields, "policy_product", "Bundled", 1, 1, "Bundled Auto Secure - Two Wheeler Policy");

  const policy = findText(cleanPages, /Policy\s+No\.?\s*[:\-]?\s*((?:[0-9]{4,}[ \t]*){2,5})/i, normalizePolicyNumber);
  if (policy) setFromText(fields, "policy_number", policy, .99);

  const period = findOwnDamagePeriod(cleanPages);
  if (period) {
    setField(fields, "policy_start_date", period.from, .99, period.page, period.evidence);
    setField(fields, "policy_end_date", period.upto, .99, period.page, period.evidence);
  }

  const registration = findText(cleanPages, /Registration\s+No\.?\s*[:\-]?\s*([^\n|]{1,24})/i, cleanText);
  if (registration && /^NEW$/i.test(registration.value)) {
    setField(fields, "vehicle_registration_status", "registration_pending", .99, registration.page, registration.evidence);
  } else if (registration && isRegistrationNumber(registration.value)) {
    setField(fields, "vehicle_registration_status", "registered", .98, registration.page, registration.evidence);
    setField(fields, "vehicle_registration_number", compactVehicleId(registration.value), .98, registration.page, registration.evidence);
  }

  const makeModel = findText(cleanPages, /Make\s*\/\s*Model\s*\/\s*Variant\s*[:\-]?\s*([^\n|]{3,80})/i, cleanText);
  if (makeModel) {
    const [make, model] = makeModel.value.split("/").map((part) => part.trim()).filter(Boolean);
    if (make) setField(fields, "vehicle_make", make, .98, makeModel.page, makeModel.evidence);
    if (model) setField(fields, "vehicle_model", model, .98, makeModel.page, makeModel.evidence);
  }

  const fuel = findText(cleanPages, /Fuel\s+Type\s*[:\-]?\s*(BATTERY|ELECTRIC|PETROL|DIESEL|CNG|LPG|HYBRID)/i, titleCase);
  if (fuel) setFromText(fields, "vehicle_fuel_type", fuel, .98);

  const engine = findText(cleanPages, /Engine\s+No\.?\s*\/\s*Motor\s+No\.?\s*\(For\s*EV\)\s*([A-Z0-9][A-Z0-9\-/]{5,29})/i, compactVehicleId)
    ?? findText(cleanPages, /Engine\s+No\.?\s*\/\s*Motor\s+No\.?\s*\(For\s*EV\)[\s\n]+([A-Z0-9][A-Z0-9\-/]{5,29})/i, compactVehicleId);
  if (engine) setFromText(fields, "vehicle_engine_number", engine, .99);

  const chassis = findText(cleanPages, /Chassis\s+No\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{7,29})/i, compactVehicleId);
  if (chassis) setFromText(fields, "vehicle_chassis_number", chassis, .99);

  const body = findText(cleanPages, /Body\s+Type\s*[:\-]?\s*([^\n|]{2,40})/i, titleCase);
  if (body) setFromText(fields, "vehicle_class", body, .96);

  const capacity = findText(cleanPages, /CC\s*\/\s*KW\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)/i, cleanText);
  if (capacity) setFromText(fields, "vehicle_capacity", capacity, .95);

  const mfg = findText(cleanPages, /Mfg\.?\s*Year\s*[:\-]?\s*((?:19|20)\d{2})/i, cleanText);
  if (mfg) setFromText(fields, "vehicle_manufacturing_year", mfg, .98);

  const rto = findText(cleanPages, /RTO\s+Location\s*[:\-]?\s*([^\n|]{2,50})/i, cleanText);
  if (rto) setFromText(fields, "vehicle_rto_name", rto, .96);

  const idv = findMoney(cleanPages, /Total\s+IDV\s*(?:\(₹\))?[\s\n|]*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i)
    ?? findMoney(cleanPages, /Total\s+IDV[\s\S]{0,160}?([0-9]{5,12}(?:\.[0-9]{1,2})?)/i, "largest");
  if (idv) setMoney(fields, "idv", idv, .99);

  const baseOd = findMoney(cleanPages, /Total\s+Own\s+Damage\s+Premium\s*\(A\)\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  const addOn = findMoney(cleanPages, /Total\s+Add[-\s]*On\s+Premium\s*\(C\)\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  const basicTp = findMoney(cleanPages, /Basic\s+TP\s+Premium\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  const cpa = findOwnerDriverPremium(cleanPages);
  const net = findMoney(cleanPages, /Net\s+Premium\s*\(A\s*\+\s*B\s*\+\s*C\)\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  const sgst = findMoney(cleanPages, /SGST\s*9%\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  const cgst = findMoney(cleanPages, /CGST\s*9%\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  const gross = findMoney(cleanPages, /Total\s+Policy\s+Premium\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i)
    ?? findMoney(cleanPages, /Premium\s+Amount\s*\(Including\s+GST\)\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);

  if (net) setMoney(fields, "total_premium", net, .99);
  if (sgst && cgst) {
    setField(fields, "tax_amount", money(round2(sgst.value + cgst.value)), .99, sgst.page, `${sgst.evidence} | ${cgst.evidence}`);
  }
  if (gross) setMoney(fields, "gross_premium", gross, .99);

  const cpaValue = cpa?.value ?? 0;
  if (cpa) {
    setField(fields, "cpa_opted", cpaValue > 0 ? "Yes" : "No", .99, cpa.page, cpa.evidence);
    setMoney(fields, "cpa_premium", cpa, .99);
  } else {
    setField(fields, "cpa_opted", "No", .82, null, "No payable owner-driver CPA premium identified");
    setField(fields, "cpa_premium", "0", .82, null, "No payable owner-driver CPA premium identified");
  }

  if (baseOd && basicTp && net) {
    const portalOd = round2(baseOd.value + (addOn?.value ?? 0));
    const calculated = round2(portalOd + basicTp.value + cpaValue);
    if (Math.abs(calculated - net.value) <= 1) {
      setField(
        fields,
        "od_premium",
        money(portalOd),
        .99,
        baseOd.page,
        addOn
          ? `${baseOd.evidence} | ${addOn.evidence} | Portal OD includes Section-I add-on premium for reconciliation.`
          : baseOd.evidence,
      );
      setMoney(fields, "tp_premium", basicTp, .99);
    } else {
      warnings.push("TATA AIG OD/TP/CPA fields were withheld because the premium components did not reconcile to printed net premium.");
    }
  } else {
    warnings.push("TATA AIG premium fields require review because labeled OD/TP/net evidence was incomplete.");
  }

  if (net && sgst && cgst && gross) {
    const printedGross = round2(net.value + sgst.value + cgst.value);
    if (Math.abs(printedGross - gross.value) > 1) {
      warnings.push("TATA AIG printed net premium plus GST does not reconcile to total policy premium.");
    }
  }

  const required = ["policy_product", "idv", "od_premium", "tp_premium", "policy_number", "insurer_name", "policy_start_date", "policy_end_date"];
  const missing = required.filter((key) => !fields.get(key)?.value?.trim());
  if (missing.length) warnings.push(`Review required. Missing or uncertain TATA AIG fields: ${missing.join(", ")}.`);

  return {
    ...parsed,
    parserId: PARSER_ID,
    parserVersion: PARSER_VERSION,
    fields: [...fields.values()],
    warnings,
  };
}

function findOwnDamagePeriod(pages: string[]): PeriodHit | null {
  const date = "([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})";
  const pattern = new RegExp(`Own\\s+Damage\\s+Cover\\s+${date}(?:\\s*\\([^)]*\\))?\\s+${date}`, "i");
  for (let index = 0; index < pages.length; index += 1) {
    const match = pages[index].match(pattern);
    if (!match?.[1] || !match?.[2]) continue;
    const from = isoDate(match[1]);
    const upto = isoDate(match[2]);
    if (from && upto) return { from, upto, page: index + 1, evidence: match[0] };
  }
  return null;
}

function findOwnerDriverPremium(pages: string[]): MoneyHit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const match = page.match(/Compulsory\s+Personal\s+Accident\s+Cover\s+for\s+Owner\s*Driver([\s\S]{0,180}?)(?=Total\s+Liability\s+Premium|Net\s+Premium|\n[A-Z][A-Za-z -]{3,}:)/i);
    if (!match) continue;
    const values = [...match[1].matchAll(/₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g)]
      .map((item) => parseMoney(item[1]))
      .filter((value): value is number => value !== null && value >= 100 && value <= 100000);
    if (!values.length) continue;
    return { value: values[values.length - 1], page: pageIndex + 1, evidence: match[0] };
  }
  return null;
}

function findText(
  pages: string[],
  pattern: RegExp,
  transform: (value: string) => string,
): TextHit | null {
  for (let index = 0; index < pages.length; index += 1) {
    const match = pages[index].match(pattern);
    if (!match?.[1]) continue;
    const value = transform(match[1]);
    if (value) return { value, page: index + 1, evidence: match[0] };
  }
  return null;
}

function findMoney(pages: string[], pattern: RegExp, mode: "first" | "largest" = "first"): MoneyHit | null {
  for (let index = 0; index < pages.length; index += 1) {
    const match = pages[index].match(pattern);
    if (!match) continue;
    const raw = mode === "largest"
      ? [...match[0].matchAll(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/g)].map((item) => parseMoney(item[0])).filter((value): value is number => value !== null)
      : [parseMoney(match[1])].filter((value): value is number => value !== null);
    if (!raw.length) continue;
    return { value: mode === "largest" ? Math.max(...raw) : raw[0], page: index + 1, evidence: match[0] };
  }
  return null;
}

function setFromText(fields: Fields, key: string, hit: TextHit, confidence: number) {
  setField(fields, key, hit.value, confidence, hit.page, hit.evidence);
}

function setMoney(fields: Fields, key: string, hit: MoneyHit, confidence: number) {
  setField(fields, key, money(hit.value), confidence, hit.page, hit.evidence);
}

function setField(fields: Fields, key: string, value: string, confidence: number, page: number | null, evidence: string) {
  const clean = value.trim();
  if (!clean) return;
  fields.set(key, {
    key,
    label: LABELS[key] ?? key,
    value: clean,
    confidence,
    page,
    evidence: sanitize(evidence).slice(0, 500),
  });
}

function normalizePolicyNumber(value: string) {
  return value.replace(/\s+/g, "").replace(/[^0-9A-Z\-/.]/gi, "").toUpperCase();
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").replace(/[;,]+$/, "").trim();
}

function compactVehicleId(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function titleCase(value: string) {
  const lower = cleanText(value).toLowerCase();
  return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : "";
}

function isRegistrationNumber(value: string) {
  return /^[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4}$/i.test(value.trim());
}

function parseMoney(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isoDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return "";
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const month = Number(match[2]);
  const day = Number(match[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return date.toISOString().slice(0, 10);
}

function sanitize(value: string) {
  return value.replace(/\u00ad/g, "").replace(/[–—]/g, "-").replace(/\r/g, "").split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}
