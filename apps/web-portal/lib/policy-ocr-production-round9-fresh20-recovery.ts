import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

type Fields = Map<string, ParsedPolicyField>;

const LABELS: Record<string, string> = {
  vehicle_make: "Vehicle make",
  vehicle_model: "Vehicle model",
  vehicle_fuel_type: "Fuel type",
  vehicle_manufacturing_year: "Manufacturing year",
  vehicle_capacity: "Vehicle capacity",
  vehicle_chassis_number: "Chassis number",
  vehicle_engine_number: "Engine number",
  vehicle_rto_state: "RTO state",
  od_premium: "OD premium",
  tp_premium: "Third party premium",
  cpa_opted: "CPA opted",
  cpa_premium: "CPA amount",
  total_premium: "Printed net premium",
  tax_amount: "Printed GST",
  gross_premium: "Printed gross premium",
};

const MONEY = "([0-9][0-9,]*(?:\\.[0-9]{1,2})?)";

export function refineProductionRound9Fresh20Recovery(
  pages: string[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const page1 = cleanPage(pages[0] ?? "");
  const page2 = cleanPage(pages[1] ?? "");
  const header = page1.split("\n").slice(0, 180).join(" ");
  const digitCashVan = /GO\s+DIGIT\s+GENERAL\s+INSURANCE/i.test(header)
    && /YOUR\s+VEHICLE\s+DETAILS/i.test(page1)
    && /OWN\s+DAMAGE\s+PREMIUM\s*\[A\]/i.test(page1)
    && /LIABILITY\s+PREMIUM\s*\[B\]/i.test(page1)
    && /(?:CASH\s+VAN|Vehicle\s+Body\s+Type\s+Cash\s+Van)/i.test(page1);

  if (parsed.parserId !== "digit_commercial_motor_v1" || !digitCashVan) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  let changed = false;

  const vehicle = digitVehicleSchedule(page1);
  if (vehicle) {
    changed = put(fields, "vehicle_make", vehicle.make, 1, "Round 9 Digit cash-van Make row") || changed;
    changed = put(fields, "vehicle_model", vehicle.model, 1, "Round 9 Digit cash-van Model/Vehicle Variant row") || changed;
    changed = put(fields, "vehicle_fuel_type", vehicle.fuel, 1, "Round 9 Digit cash-van Fuel Type row") || changed;
    changed = put(fields, "vehicle_manufacturing_year", vehicle.year, 1, "Round 9 Digit cash-van Year of Regn./Manufacturing column") || changed;
    changed = put(fields, "vehicle_capacity", vehicle.capacity, 1, "Round 9 Digit cash-van Gross Vehicle Weight row") || changed;
    changed = put(fields, "vehicle_engine_number", vehicle.engine, 1, "Round 9 Digit cash-van Engine No. row") || changed;
    changed = put(fields, "vehicle_chassis_number", vehicle.chassis, 1, "Round 9 Digit cash-van Chassis No. row") || changed;
    changed = put(fields, "vehicle_rto_state", vehicle.state, 1, "Round 9 Digit cash-van printed RTO Location state") || changed;
  }

  const cpaKnownNo = /PA\s+cover\s+for\s+Owner[-\s]*Driver[^\n]{0,80}(?:--|NIL|N\/?A)/i.test(page1);
  if (cpaKnownNo) {
    changed = put(fields, "cpa_opted", "No", 1, "Round 9 Digit printed owner-driver PA opt-out") || changed;
    changed = put(fields, "cpa_premium", "0", 1, "Round 9 Digit printed owner-driver PA opt-out") || changed;
  }

  const premiums = digitPremiumTotals(page2, cpaKnownNo ? 0 : null);
  if (premiums) {
    changed = putMoney(fields, "od_premium", premiums.od, 2, "Round 9 Digit printed Total OD") || changed;
    changed = putMoney(fields, "tp_premium", premiums.tp, 2, "Round 9 Digit printed Total Act") || changed;
    changed = putMoney(fields, "total_premium", premiums.net, 2, "Round 9 Digit printed Net Premium [A+B]") || changed;
    changed = putMoney(fields, "tax_amount", premiums.tax, 2, "Round 9 Digit printed GST row") || changed;
    changed = putMoney(fields, "gross_premium", premiums.gross, 2, "Round 9 Digit printed Total Premium") || changed;
  }

  if (!changed) return parsed;
  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+prod-r9-digit_cash_van`,
    fields: [...fields.values()],
    warnings: [
      ...parsed.warnings.filter((warning) => !/Missing or uncertain(?: Digit)? fields|round 9 digit cash-van/i.test(warning)),
      "Production benchmark round 9 Digit cash-van schedule recovery applied.",
    ],
  };
}

function digitVehicleSchedule(page: string) {
  const lines = page.split("\n").map(clean).filter(Boolean);
  const makeLine = lines.find((line) => /^Make\s+/i.test(line) && /Trailer\s+Reg\.?\s*No\.?/i.test(line));
  const modelLine = lines.find((line) => /^Model\s*\/\s*Vehicle\s+Variant\b/i.test(line) && /Year\s+of\s+Regn/i.test(line));
  const subtypeLine = lines.find((line) => /^\(Sub-Type\)/i.test(line) && /Manufacturing/i.test(line));
  const idLine = lines.find((line) => /Engine\s+No\.?/i.test(line) && /Chassis\s+No\.?/i.test(line));
  const fuelLine = lines.find((line) => /^Fuel\s+Type\b/i.test(line) && /Gross\s+Vehicle\s+Weight/i.test(line));
  if (!makeLine || !modelLine || !idLine || !fuelLine) return null;

  const make = clean(makeLine.match(/^Make\s+(.+?)\s+Trailer\s+Reg\.?\s*No\.?/i)?.[1] ?? "");
  const modelBase = clean(modelLine.match(/^Model\s*\/\s*Vehicle\s+Variant\s+(.+?)\s+Year\s+of\s+Regn/i)?.[1] ?? "");
  const subtype = clean(subtypeLine?.match(/^\(Sub-Type\)\s*(.*?)\s+Manufacturing/i)?.[1] ?? "");
  const model = clean([modelBase, subtype].filter(Boolean).join(" "));
  const year = modelLine.match(/Year\s+of\s+Regn\.?\s*\/\s*((?:19|20)\d{2})/i)?.[1] ?? "";
  const engine = compact(idLine.match(/Engine\s+No\.?\s*([A-Z0-9-]{6,24})/i)?.[1] ?? "");
  const chassis = compact(idLine.match(/Chassis\s+No\.?\s*([A-Z0-9-]{6,24})/i)?.[1] ?? "");
  const fuel = canonicalFuel(fuelLine.match(/^Fuel\s+Type\s+(.+?)\s+Gross\s+Vehicle\s+Weight/i)?.[1] ?? "");
  const capacity = compactCapacity(fuelLine.match(/Gross\s+Vehicle\s+Weight\s+([0-9,]+\s*(?:KG|KGS)?)/i)?.[1] ?? "");
  const state = canonicalState(makeLine.match(/RTO\s+Location\s+[^,\n]{2,60},\s*([A-Za-z ]{2,40})/i)?.[1] ?? "");

  if (!validVehicleText(make) || !validVehicleText(model) || !year || !fuel || !capacity || !validId(engine, 22) || !validId(chassis, 24) || !state) return null;
  return { make, model, fuel, year, capacity, engine, chassis, state };
}

function digitPremiumTotals(page: string, cpa: number | null) {
  if (cpa === null || !/Net\s+Premium/i.test(page) || !/(?:IGST|CGST|SGST|UTGST)/i.test(page)) return null;
  const flat = clean(page);
  const pair = flat.match(new RegExp(`Total\\s+OD\\b[^0-9]{0,30}${MONEY}\\s+Total\\s+(?:Act|Liability|TP)\\b[^0-9]{0,60}${MONEY}`, "i"));
  const netMatch = flat.match(new RegExp(`Net\\s+Premium\\b[^0-9]{0,45}${MONEY}`, "i"));
  const grossMatch = flat.match(new RegExp(`Total\\s+Premium\\b[^0-9]{0,35}${MONEY}`, "i"));
  const gstLine = page.split("\n").map(clean).find((line) => /(?:IGST|CGST|SGST|UTGST)\s*@/i.test(line));
  const gstValues = gstLine ? moneyValues(gstLine) : [];
  const od = parseMoney(pair?.[1]);
  const tp = parseMoney(pair?.[2]);
  const net = parseMoney(netMatch?.[1]);
  const gross = parseMoney(grossMatch?.[1]);
  const tax = gstValues.at(-1) ?? null;
  if ([od, tp, net, gross, tax].some((value) => value === null)) return null;
  if (Math.abs(round2(od! + tp! + cpa) - net!) > .02) return null;
  if (Math.abs(round2(net! + tax!) - gross!) > .02) return null;
  return { od: od!, tp: tp!, net: net!, tax: tax!, gross: gross! };
}

function validVehicleText(value: string) {
  return value.length >= 2 && value.length <= 90 && /[A-Z]/i.test(value) && !/^(?:MAKE|MODEL|VARIANT|NA|N\/A)$/i.test(value);
}

function validId(value: string, max: number) {
  return value.length >= 6 && value.length <= max && /[A-Z]/i.test(value) && /\d/.test(value);
}

function canonicalFuel(value: string) {
  const upper = clean(value).toUpperCase();
  if (/\bCNG\b/.test(upper)) return "CNG";
  if (/\bLPG\b/.test(upper)) return "LPG";
  if (/\bDIESEL\b/.test(upper)) return "DIESEL";
  if (/\bPETROL\b/.test(upper)) return "PETROL";
  if (/ELECTRIC|BATTERY/.test(upper)) return "ELECTRIC";
  return "";
}

function canonicalState(value: string) {
  return clean(value).toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function compactCapacity(value: string) {
  const match = clean(value).toUpperCase().match(/^([0-9,]+)\s*(?:KG|KGS)?$/);
  return match ? `${match[1].replace(/,/g, "")}KG` : "";
}

function putMoney(fields: Fields, key: string, value: number, page: number, evidence: string) {
  return put(fields, key, money(value), page, evidence);
}

function put(fields: Fields, key: string, value: string, page: number, evidence: string) {
  if (!value) return false;
  const previous = fields.get(key)?.value;
  fields.set(key, { key, label: LABELS[key] ?? key, value, confidence: .999, page, evidence });
  return previous !== value;
}

function moneyValues(value: string) {
  return [...value.matchAll(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/g)]
    .map((match) => parseMoney(match[0]))
    .filter((item): item is number => item !== null);
}

function parseMoney(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function compact(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanPage(value: string) {
  return value.replace(/\u00ad/g, "").replace(/[–—]/g, "-").replace(/\r/g, "").split("\n").map(clean).filter(Boolean).join("\n");
}

function clean(value: string) {
  return value.replace(/[\t ]+/g, " ").trim();
}
