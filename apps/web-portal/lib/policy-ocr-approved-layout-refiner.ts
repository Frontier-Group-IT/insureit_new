import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Hit = { value: string; page: number; evidence: string };
type AmountHit = { value: number; page: number; evidence: string };

const SUPPORTED = new Set([
  "united_india_motor_v1",
  "hdfc_ergo_motor_v1",
  "new_india_motor_v1",
  "national_motor_v1",
  "royal_sundaram_motor_v1",
]);

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

export function refineApprovedMotorPolicyLayout(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (!tables.length) return parsed;

  const allText = normalize([...pages, ...tables.flatMap((table) => table.rows.flat())].join(" | "));
  const promoteNewIndia = parsed.parserId === "generic_motor_v1"
    && /\bNEW\s+INDIA\s+ASSURANCE\b/i.test(allText)
    && /\b(?:STANDALONE\s+OWN\s+DAMAGE|SAOD)\b/i.test(allText);
  if (!SUPPORTED.has(parsed.parserId) && !promoteNewIndia) return parsed;

  const parserId = promoteNewIndia ? "new_india_motor_v1" : parsed.parserId;
  const fields = new Map(parsed.fields.map((field) => [field.key, field]));

  if (promoteNewIndia) {
    set(fields, "insurer_name", "The New India Assurance Company Limited", .99, 1, "New India insurer heading");
    set(fields, "policy_product", "SAOD", .99, 1, "Standalone own-damage heading");
    set(fields, "tp_premium", "0", .99, 1, "Standalone own-damage policy");
    set(fields, "cpa_opted", "No", .99, 1, "Standalone own-damage policy");
    set(fields, "cpa_premium", "0", .99, 1, "Standalone own-damage policy");
    applyNewIndiaPeriodAndPolicyNumber(fields, pages, tables);
  }

  const registration = findValue(tables, /(?:Registration|Regn\.?)\s*(?:No\.?|Number)?/i, vehicleIdentifier);
  const pending = /\bNEW(?:[-\s/]|$)|REGISTRATION\s+(?:PENDING|APPLIED)/i.test(registration?.value ?? allText);
  if (pending) {
    set(fields, "vehicle_registration_status", "registration_pending", .99, registration?.page ?? 1, registration?.evidence ?? "NEW vehicle");
    fields.delete("vehicle_registration_number");
  } else if (registration) {
    set(fields, "vehicle_registration_status", "registered", .99, registration.page, registration.evidence);
    set(fields, "vehicle_registration_number", compactId(registration.value), .99, registration.page, registration.evidence);
  }

  applyText(fields, "vehicle_chassis_number", findValue(tables, /Chassis\s*(?:No\.?|Number)?/i, vehicleIdentifier), compactId);
  applyText(fields, "vehicle_engine_number", findValue(tables, /Engine\s*(?:No\.?|Number)?/i, vehicleIdentifier), compactId);
  applyText(fields, "vehicle_make", findValue(tables, /(?:Manufacturer|Make)(?!\s*\/\s*Model)/i, vehicleText), cleanMake);
  applyText(fields, "vehicle_model", findValue(tables, /(?:Model(?:\s*-\s*Variant)?|Variant)(?!\s*Year)/i, vehicleText), cleanModel);
  applyText(fields, "vehicle_fuel_type", findValue(tables, /Fuel(?:\s+Type)?/i, /^(?:PETROL|DIESEL|CNG|LPG|ELECTRIC|HYBRID)$/i), title);
  applyText(fields, "vehicle_manufacturing_year", findValue(tables, /(?:Year\s+of\s+Manufacture|Manufacturing\s+Year|Mfg\.?\s*Year|Year)/i, /^(?:19|20)\d{2}$/), identity);

  const combinedMakeModel = findValue(tables, /Make\s*\/\s*Model/i, vehicleText);
  if (combinedMakeModel) applyCombinedMakeModel(fields, combinedMakeModel);

  const vehicleClass = classifyVehicle(allText);
  if (vehicleClass) set(fields, "vehicle_class", vehicleClass, .97, 1, "Structured vehicle/policy heading");

  const capacity = findCapacity(tables, vehicleClass);
  if (capacity) set(fields, "vehicle_capacity", capacity.value, .98, capacity.page, capacity.evidence);

  const authority = findValue(tables, /(?:Registration\s+Authority|Registering\s+Authority|RTO(?:\s+Name)?)/i, vehicleText);
  const rto = deriveRto(authority?.value ?? registration?.value ?? "");
  if (rto.name) set(fields, "vehicle_rto_name", rto.name, .94, authority?.page ?? registration?.page ?? 1, authority?.evidence ?? registration?.evidence ?? "Registration prefix");
  if (rto.state) set(fields, "vehicle_rto_state", rto.state, .94, authority?.page ?? registration?.page ?? 1, authority?.evidence ?? registration?.evidence ?? "Registration prefix");

  sanitizeVehicleFields(fields);
  applyFinancials(tables, parserId, fields, allText);

  return {
    ...parsed,
    parserId,
    parserVersion: `${parsed.parserVersion}+approved-layout-v3`,
    fields: [...fields.values()],
  };
}

function applyNewIndiaPeriodAndPolicyNumber(
  fields: Map<string, ParsedPolicyField>,
  pages: string[],
  tables: StructuredPolicyTable[],
) {
  const text = normalize([...pages, ...tables.flatMap((table) => table.rows.flat())].join(" | "));
  const policy = text.match(/(?:Policy\s*(?:No\.?|Number)?\s*[:#-]?\s*)(\d{18,25})\b/i)
    ?? text.match(/\b(\d{18,25})\b/);
  if (policy) set(fields, "policy_number", policy[1], .98, 1, "New India policy number");

  const period = text.match(/(?:Own\s+Damage\s+Period|Period\s+of\s+(?:Insurance|Cover))[^0-9]{0,40}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})[^0-9]{1,40}(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
  if (period) {
    const from = isoDate(period[1]);
    const upto = isoDate(period[2]);
    if (from) set(fields, "policy_start_date", from, .98, 1, "New India own-damage period");
    if (upto) set(fields, "policy_end_date", upto, .98, 1, "New India own-damage period");
  }
}

function applyFinancials(
  tables: StructuredPolicyTable[],
  parserId: string,
  fields: Map<string, ParsedPolicyField>,
  allText: string,
) {
  let idv = findAmount(tables, /(?:Total\s+IDV|Vehicle\s+IDV|Insured\s+Declared\s+Value|Total\s+Value)/i, 0, 1_000_000_000, "largest");
  if (!idv && parserId === "new_india_motor_v1") idv = findNewIndiaComponentIdv(tables);

  const od = findAmount(tables, /(?:Gross|Total|Net|Calculated)?\s*(?:Own\s+Damage|\bOD\b)\s*(?:Premium)?/i, 0, 10_000_000, "first");
  const basicTp = findAmount(tables, /(?:Basic\s+(?:TP|Liability)|Third\s+Party\s+Basic|Basic\s+Premium)/i, 0, 10_000_000, "first");
  const grossLiability = findAmount(tables, /(?:Gross|Total|Net|Calculated)\s+(?:TP|Liability)(?:\s+Premium)?/i, 0, 10_000_000, "first");
  const ownerDriverCpa = findAmount(tables, /(?:Compulsory\s+(?:PA|Personal\s+Accident)\s+(?:for\s+)?Owner\s*[- ]?Driver|P\.?\s*A\.?\s+(?:Cover\s+)?(?:for\s+)?Owner\s*[- ]?Driver|Owner\s*[- ]?Driver\s+(?:CPA|PA)(?:\s+Premium)?)/i, 0, 10_000_000, "last");
  const ownerDriverCpaNo = findValue(
    tables,
    /(?:Compulsory\s+(?:PA|Personal\s+Accident)\s+(?:cover\s+)?(?:for\s+)?Owner\s*[- ]?Driver|P\.?\s*A\.?\s+(?:Cover\s+)?(?:for\s+)?Owner\s*[- ]?Driver|Owner\s*[- ]?Driver\s+(?:CPA|PA))/i,
    (value) => /(?:NOT\s+(?:PROVIDED|OPTED|COVERED)|\bNO\b|\bNIL\b|^0(?:\.0+)?$)/i.test(normalize(value)),
  );
  let net = findAmount(tables, /(?:Net\s+Premium|Premium\s*\(A\s*\+\s*B\)|Total\s+Premium(?!\s+Payable)|Premium\s+Amount)/i, 0, 10_000_000, "first");
  let gross = findAmount(tables, /(?:Total\s+(?:Payable|Policy)\s+Premium|Gross\s+Premium|Total\s+Amount(?:\s+Payable)?)/i, 0, 10_000_000, "largest");
  let tax = findAmount(tables, /(?:Total\s+GST|GST\s+Amount|\bIGST\b)/i, 0, 10_000_000, "largest");

  if (!tax) {
    const cgst = findAmount(tables, /\bCGST\b/i, 0, 10_000_000, "last");
    const sgst = findAmount(tables, /\bSGST\b/i, 0, 10_000_000, "last");
    if (cgst && sgst) tax = { value: round2(cgst.value + sgst.value), page: cgst.page, evidence: `${cgst.evidence} | ${sgst.evidence}` };
  }

  const existingTotal = numeric(fields.get("total_premium"));
  const liabilityOnly = /(?:hdfc_ergo|royal_sundaram)/.test(parserId)
    || /\b(?:LIABILITY\s+ONLY|THIRD\s+PARTY)\b/i.test(allText);

  if (liabilityOnly && basicTp && !gross && existingTotal !== null && existingTotal > basicTp.value) {
    const gap = round2(existingTotal - basicTp.value);
    if (tax && close(gap, round2(tax.value * 2))) {
      gross = { value: existingTotal, page: fields.get("total_premium")?.page ?? 1, evidence: "Printed total treated as gross after split-GST reconciliation" };
      net = { value: basicTp.value, page: basicTp.page, evidence: "Liability-only net equals basic TP when no liability additions are present" };
      tax = { value: gap, page: tax.page, evidence: "Combined split GST derived from gross minus liability-only net" };
    }
  }

  if (gross && tax && gross.value >= tax.value) {
    const derivedNet = round2(gross.value - tax.value);
    if (!net || close(net.value, gross.value)) {
      net = { value: derivedNet, page: gross.page, evidence: "Derived from printed gross minus printed GST" };
    }
  }

  if (!tax && net && gross && gross.value >= net.value) {
    tax = { value: round2(gross.value - net.value), page: gross.page, evidence: "Derived from printed gross minus printed net" };
  }
  if (!gross && net && tax) {
    gross = { value: round2(net.value + tax.value), page: net.page, evidence: "Derived from printed net plus printed GST" };
  }

  if (liabilityOnly && idv && idv.value !== 0) {
    idv = { value: 0, page: idv.page, evidence: "Liability-only policy has no own-damage IDV" };
  } else if (liabilityOnly && !idv) {
    idv = { value: 0, page: 1, evidence: "Liability-only policy has no own-damage IDV" };
  }

  const netValue = net?.value ?? numeric(fields.get("total_premium"));
  const odValue = od?.value ?? (liabilityOnly ? 0 : numeric(fields.get("od_premium")));
  const tpValue = basicTp?.value ?? numeric(fields.get("tp_premium")) ?? (parserId === "new_india_motor_v1" && /STANDALONE\s+OWN\s+DAMAGE|\bSAOD\b/i.test(allText) ? 0 : null);
  let extraLiability: number | null = null;
  if (grossLiability && tpValue !== null && grossLiability.value >= tpValue) extraLiability = round2(grossLiability.value - tpValue);
  else if (netValue !== null && odValue !== null && tpValue !== null) extraLiability = round2(netValue - odValue - tpValue);

  if (idv) set(fields, "idv", money(idv.value), .99, idv.page, idv.evidence);
  if (net) set(fields, "total_premium", money(net.value), .99, net.page, net.evidence);
  if (tax) set(fields, "tax_amount", money(tax.value), .99, tax.page, tax.evidence);
  if (gross) set(fields, "gross_premium", money(gross.value), .99, gross.page, gross.evidence);

  if (netValue !== null && odValue !== null && tpValue !== null && extraLiability !== null && extraLiability >= 0 && close(odValue + tpValue + extraLiability, netValue)) {
    set(fields, "od_premium", money(odValue), .99, od?.page ?? net?.page ?? 1, od?.evidence ?? "Zero own-damage premium for liability-only policy");
    set(fields, "tp_premium", money(tpValue), .99, basicTp?.page ?? net?.page ?? 1, basicTp?.evidence ?? "Basic third-party premium");
    set(fields, "cpa_premium", money(extraLiability), .99, grossLiability?.page ?? net?.page ?? 1, "Liability additions = printed net - OD - basic TP");

    if (ownerDriverCpa) {
      set(fields, "cpa_opted", ownerDriverCpa.value > 0 ? "Yes" : "No", .99, ownerDriverCpa.page, ownerDriverCpa.evidence);
    } else if (ownerDriverCpaNo || extraLiability === 0 || parserId === "new_india_motor_v1") {
      set(fields, "cpa_opted", "No", .99, ownerDriverCpaNo?.page ?? grossLiability?.page ?? net?.page ?? 1, ownerDriverCpaNo?.evidence ?? "No owner-driver CPA evidence");
    } else {
      fields.delete("cpa_opted");
    }
  }
}

function findNewIndiaComponentIdv(tables: StructuredPolicyTable[]): AmountHit | null {
  const components: AmountHit[] = [];
  for (const table of tables) {
    for (const row of table.rows) {
      const joined = normalize(row.join(" | "));
      if (!/(?:Vehicle\s+IDV|Accessory|Accessories|Bi[-\s]?Fuel|CNG|LPG)/i.test(joined)) continue;
      const values = [...joined.matchAll(/\d[\d,]*(?:\.\d{1,2})?/g)]
        .map((match) => Number(match[0].replaceAll(",", "")))
        .filter((value) => Number.isFinite(value) && value >= 10_000 && value <= 1_000_000_000 && !(value >= 1900 && value <= 2100));
      if (values.length) components.push({ value: values[values.length - 1], page: table.page, evidence: joined.slice(0, 400) });
    }
  }
  if (components.length < 2) return null;
  const total = round2(components.reduce((sum, item) => sum + item.value, 0));
  return { value: total, page: components[0].page, evidence: "Summed New India IDV components from structured schedule" };
}

function findCapacity(tables: StructuredPolicyTable[], vehicleClass: string | null): Hit | null {
  const preferred = vehicleClass === "GCV" ? /(?:GVW|Gross\s+Vehicle\s+Weight)/i
    : vehicleClass === "TWP" || vehicleClass === "PCP" ? /(?:Cubic\s+Capacity|Engine\s+Capacity|\bCC\b)/i
      : /(?:Seating\s+Capacity|GVW|Cubic\s+Capacity|\bCC\b)/i;
  return findValue(tables, preferred, /^\d{2,6}(?:\.\d+)?$/);
}

function findValue(tables: StructuredPolicyTable[], label: RegExp, accepted: RegExp | ((value: string) => boolean)): Hit | null {
  for (const table of tables) {
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
      const row = table.rows[rowIndex].map(normalize);
      for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
        const cell = row[cellIndex];
        if (!test(label, cell)) continue;
        const inline = cleanCandidate(cell.replace(label, " "));
        if (inline && accepts(accepted, inline)) return hit(inline, table.page, row);
        for (const candidate of row.slice(cellIndex + 1)) {
          const clean = cleanCandidate(candidate);
          if (clean && accepts(accepted, clean)) return hit(clean, table.page, row);
        }
        for (let next = rowIndex + 1; next <= Math.min(rowIndex + 3, table.rows.length - 1); next += 1) {
          const clean = cleanCandidate(table.rows[next][cellIndex] ?? "");
          if (clean && accepts(accepted, clean)) return hit(clean, table.page, [cell, clean]);
        }
      }
    }
  }
  return null;
}

function findAmount(
  tables: StructuredPolicyTable[],
  label: RegExp,
  min: number,
  max: number,
  mode: "first" | "last" | "largest" = "first",
): AmountHit | null {
  const found = findValue(tables, label, /\d/);
  if (!found) return null;
  const values = [...found.value.matchAll(/\d[\d,]*(?:\.\d{1,2})?/g)]
    .map((match) => Number(match[0].replaceAll(",", "")))
    .filter((value) => Number.isFinite(value) && value >= min && value <= max && !(value >= 1900 && value <= 2100));
  if (!values.length) return null;
  const value = mode === "largest" ? Math.max(...values) : mode === "last" ? values[values.length - 1] : values[0];
  return { value, page: found.page, evidence: found.evidence };
}

function applyText(fields: Map<string, ParsedPolicyField>, key: string, found: Hit | null, transform: (value: string) => string) {
  if (found) set(fields, key, transform(found.value), .98, found.page, found.evidence);
}

function applyCombinedMakeModel(fields: Map<string, ParsedPolicyField>, found: Hit) {
  const value = normalize(found.value);
  const slash = value.split(/\s*[/|]\s*/, 2);
  if (slash.length === 2 && slash.every(vehicleText)) {
    set(fields, "vehicle_make", cleanMake(slash[0]), .97, found.page, found.evidence);
    set(fields, "vehicle_model", cleanModel(slash[1]), .97, found.page, found.evidence);
    return;
  }
  const known = value.match(/^(TATA(?:\s+MOTORS)?|BMW|KIA)\s+(.+)$/i);
  if (known && vehicleText(known[2])) {
    set(fields, "vehicle_make", cleanMake(known[1]), .96, found.page, found.evidence);
    set(fields, "vehicle_model", cleanModel(known[2]), .96, found.page, found.evidence);
  }
}

function classifyVehicle(text: string) {
  if (/GOODS\s+CARRYING|GOODS\s+CARRIAGE|PUBLIC\s+CARRIER|\bGCV\b/i.test(text)) return "GCV";
  if (/TWO\s*WHEELER|MOTOR\s*CYCLE|\bTWP\b/i.test(text)) return "TWP";
  if (/PRIVATE\s+CAR|\bPCP\b/i.test(text)) return "PCP";
  if (/PASSENGER\s+CARRYING|\bPCV\b/i.test(text)) return "PCV";
  return null;
}

function deriveRto(value: string) {
  const upper = normalize(value).toUpperCase();
  const code = upper.match(/\b(MP|DL|HR)[-\s]?0?(\d{1,2})\b/);
  const normalizedCode = code ? `${code[1]}${code[2]}` : null;
  const city = /JABALPUR/.test(upper) ? "MP20" : /MANDLA/.test(upper) ? "MP51" : /DELHI/.test(upper) ? "DL8" : /BALLABGARH/.test(upper) ? "HR29" : null;
  const name = normalizedCode ?? city;
  const state = name?.startsWith("MP") ? "Madhya Pradesh" : name?.startsWith("DL") ? "Delhi" : name?.startsWith("HR") ? "Haryana" : null;
  return { name, state };
}

function sanitizeVehicleFields(fields: Map<string, ParsedPolicyField>) {
  for (const key of ["vehicle_make", "vehicle_model", "vehicle_registration_number", "vehicle_engine_number", "vehicle_chassis_number"]) {
    const field = fields.get(key);
    if (!field) continue;
    const value = normalize(field.value);
    if (isVehicleHeaderGarbage(value)) fields.delete(key);
  }
}

function isVehicleHeaderGarbage(value: string) {
  return /^(?:VEHICLE|DESCRIPTION|MODEL|MAKE|MAKE\s*\/\s*MODEL|FUEL\s+TYPE|TYPE\s+OF\s+BODY|YEAR\s+MAKE\s+MODEL.*|MAKEMODEL)$/i.test(value)
    || /SECTION\s+I\s*-\s*LOSS\s+OF\s+OR\s+DAMAGE/i.test(value)
    || /GEOGRAPHICAL\s+AREA|भौगोलिक\s+क्षेत्र/i.test(value);
}

function set(fields: Map<string, ParsedPolicyField>, key: string, value: string, confidence: number, page: number | null, evidence: string) {
  const clean = normalize(value);
  if (!clean) return;
  fields.set(key, { key, label: LABELS[key] ?? key, value: clean, confidence, page, evidence: normalize(evidence).slice(0, 400) });
}

function hit(value: string, page: number, evidence: string[]): Hit { return { value, page, evidence: normalize(evidence.join(" | ")).slice(0, 400) }; }
function test(pattern: RegExp, value: string) { pattern.lastIndex = 0; const matched = pattern.test(value); pattern.lastIndex = 0; return matched; }
function accepts(matcher: RegExp | ((value: string) => boolean), value: string) { return matcher instanceof RegExp ? test(matcher, value) : matcher(value); }
function cleanCandidate(value: string) { return normalize(value).replace(/^[:|\-\s]+|[:|\-\s]+$/g, ""); }
function normalize(value: string) { return value.replace(/\s+/g, " ").trim(); }
function compactId(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function cleanMake(value: string) { return normalize(value).replace(/\b(?:MOTORS?|INDIA|LTD\.?)\b/gi, " ").replace(/\s+/g, " ").trim().replace(/^TATA$/i, "Tata").replace(/^BMW$/i, "BMW").replace(/^KIA$/i, "Kia"); }
function cleanModel(value: string) { return normalize(value).replace(/\bBS\s*VI\b/gi, "").replace(/\s+/g, " ").trim(); }
function title(value: string) { const lower = value.toLowerCase(); return lower.charAt(0).toUpperCase() + lower.slice(1); }
function identity(value: string) { return normalize(value); }
function vehicleIdentifier(value: string) { return /^(?:NEW(?:[-/\s].*)?|[A-Z0-9][A-Z0-9\s/-]{4,35})$/i.test(normalize(value)) && !isVehicleHeaderGarbage(normalize(value)); }
function vehicleText(value: string) { const clean = normalize(value); return clean.length >= 2 && clean.length <= 120 && !/^(?:NA|N\/A|NONE)$/i.test(clean) && !isVehicleHeaderGarbage(clean); }
function numeric(field: ParsedPolicyField | undefined) { if (!field) return null; const value = Number(field.value.replace(/[^0-9.-]/g, "")); return Number.isFinite(value) ? value : null; }
function close(value: number, expected: number) { return Math.abs(round2(value) - round2(expected)) <= 2; }
function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function money(value: number) { const rounded = round2(value); return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""); }

function isoDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
