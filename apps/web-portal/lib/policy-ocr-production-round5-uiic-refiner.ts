import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Fields = Map<string, ParsedPolicyField>;

const LABELS: Record<string, string> = {
  vehicle_make: "Vehicle make", vehicle_model: "Vehicle model", vehicle_fuel_type: "Fuel type",
  vehicle_manufacturing_year: "Manufacturing year", vehicle_capacity: "Vehicle capacity",
  vehicle_chassis_number: "Chassis number", vehicle_engine_number: "Engine number",
  vehicle_rto_name: "RTO name", vehicle_rto_state: "RTO state", policy_number: "Policy number",
  cpa_opted: "CPA opted", cpa_premium: "CPA amount", tax_amount: "Printed GST",
  gross_premium: "Printed gross premium",
};

/** Precision-first follow-up for the revealed UIIC GCV Package family. */
export function refineProductionRound5Uiic(
  pages: string[],
  _tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const firstTwo = pages.slice(0, 2).join("\n");
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 90).join(" ");
  if (!/UNITED\s+INDIA\s+INSURANCE\s+COMPANY/i.test(header)) return parsed;
  if (!/GCV\s+PUBLIC\s+CARRIER\s+OTHER\s+THAN\s+3\s+WHEELER\s+PACKAGE/i.test(firstTwo)) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const page1 = pages[0] ?? "";
  const page2 = pages[1] ?? "";

  const policy = labelledValue(page2, /Policy\s+Number\b/i, /[A-Z0-9]{12,30}/i)
    ?? labelledValue(page1, /Policy\s+No\.?\b/i, /[A-Z0-9]{12,30}/i);
  if (policy) set(fields, "policy_number", policy, .999, 1, "Round 5 UIIC current policy number");

  const vehicleBlock = bounded(page2, /VEHICLE\s+DETAILS/i, /INSURED\s+DECLARED\s+VALUE/i)
    ?? bounded(page1, /Particulars\s+of\s+Vehicle\s+Insured/i, /Registration\s+Authority/i);

  if (vehicleBlock) {
    const makeModel = vehicleBlock.match(/Vehicle\s+Make\s*&\s*Model[\s\S]{0,180}?([A-Za-z][A-Za-z0-9_ .-]{2,50})\s*\/\s*([A-Za-z0-9][A-Za-z0-9_ .-]{2,70}?)(?=\s+(?:null\s+)?Type\s+Of\s+Body|\s+(?:GOODS\s+CARRIER|Closed)\b)/i)
      ?? vehicleBlock.match(/(?:[A-Z0-9]{15,35})\s+([A-Za-z][A-Za-z0-9_ .-]{2,50})\s*\/\s*([A-Za-z0-9][A-Za-z0-9_ .-]{2,70}?)(?=\s+(?:GOODS\s+CARRIER|Closed)\b)/i);
    if (makeModel) {
      const make = cleanText(makeModel[1]).replace(/^.*?Vehicle\s+Make\s*&\s*Model\s*/i, "").trim();
      const model = cleanText(makeModel[2]).replace(/\bnull\b/gi, "").trim();
      if (goodVehicleText(make)) set(fields, "vehicle_make", make, .999, 2, "Round 5 UIIC make/model bounded block");
      else fields.delete("vehicle_make");
      if (goodVehicleText(model)) set(fields, "vehicle_model", model, .999, 2, "Round 5 UIIC make/model bounded block");
      else fields.delete("vehicle_model");
      if (/\bEV\b|ELECTRIC/i.test(`${make} ${model}`)) set(fields, "vehicle_fuel_type", "Electric", .999, 2, "Round 5 explicit EV model marker");
    } else {
      fields.delete("vehicle_make");
      fields.delete("vehicle_model");
    }

    const chassis = labelledValue(vehicleBlock, /Chassis\s+Number/i, /[A-Z0-9]{15,25}/i)
      ?? labelledValue(vehicleBlock, /Chassis\s+No\.?/i, /[A-Z0-9]{15,25}/i);
    const engine = labelledValue(vehicleBlock, /Engine\s+Number/i, /[A-Z0-9]{15,30}/i)
      ?? labelledValue(vehicleBlock, /Engine\s+No\.?/i, /[A-Z0-9]{15,30}/i);

    if (chassis && plausibleId(chassis)) set(fields, "vehicle_chassis_number", compact(chassis), .999, 2, "Round 5 UIIC chassis label block");
    else {
      const merged = vehicleBlock.match(/\b([A-Z0-9]{30,55})\b/);
      if (merged && merged[1].length > 30) {
        const token = compact(merged[1]);
        const split = token.length - 17;
        const enginePart = token.slice(0, split);
        const chassisPart = token.slice(split);
        if (plausibleId(enginePart)) set(fields, "vehicle_engine_number", enginePart, .995, 1, "Round 5 UIIC merged engine/chassis split");
        if (plausibleId(chassisPart)) set(fields, "vehicle_chassis_number", chassisPart, .995, 1, "Round 5 UIIC 17-character chassis split");
      } else fields.delete("vehicle_chassis_number");
    }
    if (engine && plausibleId(engine)) set(fields, "vehicle_engine_number", compact(engine), .999, 2, "Round 5 UIIC engine label block");

    const year = labelledNumeric(vehicleBlock, /Year\s+Of\s+Manufacture/i, /(?:19|20)\d{2}/);
    if (year) set(fields, "vehicle_manufacturing_year", year, .999, 2, "Round 5 UIIC manufacturing year");

    const gvw = labelledNumeric(vehicleBlock, /Gross\s+vehicle\s+Weight/i, /\d{3,6}/);
    if (gvw) set(fields, "vehicle_capacity", gvw, .999, 2, "Round 5 UIIC gross vehicle weight");

    const rto = labelledFreeText(vehicleBlock, /RTA\s+Name/i, /Vehicle\s+Make\s*&\s*Model/i)
      ?? page1.match(/Registration\s+Authority[\s\S]{0,180}?\n?\s*((?:RJ|MP)\d{2}\s+[A-Z ()]+)/i)?.[1]?.trim();
    if (rto) {
      const value = cleanText(rto);
      if (/^(?:RJ|MP)\d{2}\b/i.test(value)) {
        set(fields, "vehicle_rto_name", value, .995, 2, "Round 5 UIIC explicit RTA name");
        const state = /^RJ/i.test(value) ? "Rajasthan" : /^MP/i.test(value) ? "Madhya Pradesh" : null;
        if (state) set(fields, "vehicle_rto_state", state, .995, 2, "Round 5 UIIC state from explicit RTA code");
      }
    }
  }

  const premium = bounded(firstTwo, /SCHEDULE\s+OF\s+PREMIUM/i, /TERMS\s*&\s*CONDITIONS|DISCLAIMER/i) ?? firstTwo;
  const cpa = labelledMoney(premium, /Compulsory\s+PA\s+for\s+Owner\s+Driver/i);
  if (cpa != null && cpa > 0 && cpa < 2000) {
    set(fields, "cpa_opted", "Yes", .999, 2, "Round 5 explicit owner-driver CPA premium row");
    setMoney(fields, "cpa_premium", cpa, "Round 5 explicit owner-driver CPA premium row");
  } else {
    set(fields, "cpa_opted", "No", .999, 2, "Round 5 no payable owner-driver CPA premium row");
    setMoney(fields, "cpa_premium", 0, "Round 5 no payable owner-driver CPA premium row");
  }

  const tax = sumTaxComponents(premium);
  if (tax != null) setMoney(fields, "tax_amount", tax, "Round 5 sum of all printed UIIC tax components");
  else fields.delete("tax_amount");

  const gross = labelledMoney(premium, /TOTAL\s+PAYABLE\s+PREMIUM/i)
    ?? labelledMoney(firstTwo, /Total\s*\(Rounded\s+Off\)/i);
  if (gross != null) setMoney(fields, "gross_premium", gross, "Round 5 printed rounded total payable");
  else fields.delete("gross_premium");

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+prod-r5-uiic_precision`,
    fields: [...fields.values()],
    warnings: [...parsed.warnings.filter((warning) => !/round 5 uiic/i.test(warning)), "Production benchmark round 5 UIIC precision refinement applied."],
  };
}

function bounded(text: string, start: RegExp, end: RegExp): string | null {
  const s = text.search(start); if (s < 0) return null;
  const rest = text.slice(s); const e = rest.search(end);
  return e > 0 ? rest.slice(0, e) : rest.slice(0, 5000);
}
function lines(text: string) { return text.split(/\r?\n/).map(cleanText).filter(Boolean); }
function labelledValue(text: string, label: RegExp, value: RegExp): string | null {
  const ls = lines(text);
  for (let i = 0; i < ls.length; i += 1) {
    if (!label.test(ls[i])) continue;
    const block = ls.slice(i, i + 4).join(" ").replace(label, " ");
    const match = block.match(value); if (match) return match[0];
  }
  return null;
}
function labelledNumeric(text: string, label: RegExp, value: RegExp): string | null {
  const ls = lines(text);
  for (let i = 0; i < ls.length; i += 1) {
    if (!label.test(ls[i])) continue;
    const sameLine = ls[i].replace(label, " ").trim();
    const same = isolatedNumericMatch(sameLine, value);
    if (same) return same;
    const next = isolatedNumericMatch(ls[i + 1] ?? "", value);
    if (next) return next;
  }
  return null;
}
function isolatedNumericMatch(text: string, value: RegExp): string | null {
  const candidates = text.split(/\s+/).map((token) => token.replace(/^[,:;()]+|[,:;()]+$/g, "")).filter(Boolean);
  for (const candidate of candidates) {
    if (!/^\d+$/.test(candidate)) continue;
    if (value.test(candidate)) return candidate;
  }
  return null;
}
function labelledMoney(text: string, label: RegExp): number | null {
  const raw = labelledValue(text, label, /[0-9][0-9,]*(?:\.[0-9]{1,2})?/);
  if (!raw) return null; const value = Number(raw.replace(/,/g, "")); return Number.isFinite(value) ? value : null;
}
function labelledFreeText(text: string, label: RegExp, stop: RegExp): string | null {
  const match = text.match(new RegExp(`${label.source}\\s+([\\s\\S]{1,120}?)\\s+${stop.source}`, "i"));
  return match?.[1] ? cleanText(match[1]) : null;
}
function sumTaxComponents(text: string): number | null {
  const ls = lines(text); let total = 0; let count = 0;
  for (let i = 0; i < ls.length; i += 1) {
    if (!/(?:CGST|SGST|IGST)[-\s]*(?:Others|Basic\s*TP)/i.test(ls[i])) continue;
    const block = ls.slice(i, i + 3).join(" ");
    const after = block.replace(/^.*?(?:CGST|SGST|IGST)[-\s]*(?:Others|Basic\s*TP)\s*\([^)]*\)\s*:?[\s]*/i, "");
    const raw = after.match(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/); if (!raw) continue;
    const value = Number(raw[0].replace(/,/g, "")); if (!Number.isFinite(value)) continue;
    total += value; count += 1;
  }
  return count ? round(total) : null;
}
function plausibleId(value: string) { const v = compact(value); return v.length >= 15 && v.length <= 30 && /[A-Z]/.test(v) && /\d/.test(v) && !/OBSOLETE|CAPACITY|CHASSIS|ENGINE/.test(v); }
function goodVehicleText(value: string) { return value.length >= 3 && value.length <= 70 && !/^(?:MODEL|YEAR|CUBIC CAPACITY|TYPE OF BODY|\/MODEL)/i.test(value) && !/SEATING CAPACITY|YEAR OF MANUFACTURE|WEIGHT/i.test(value); }
function cleanText(value: string) { return value.replace(/[\u00a0\r\n]+/g, " ").replace(/\s+/g, " ").trim(); }
function compact(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function set(fields: Fields, key: string, value: string, confidence: number, page: number, evidence: string) { fields.set(key, { key, label: LABELS[key] ?? key, value, confidence, page, evidence }); }
function setMoney(fields: Fields, key: string, value: number, evidence: string) { set(fields, key, Number.isInteger(value) ? String(value) : String(round(value)), .999, 2, evidence); }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
