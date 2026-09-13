import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Fields = Map<string, ParsedPolicyField>;
type TextHit = { value: string; page: number; evidence: string };
type MoneyHit = { value: number; page: number; evidence: string };

const VERSION_SUFFIX = "new-india-enhanced-covers-v1";
const ENHANCED_TITLE = /COMMERCIAL\s+VEHICLE\s+PACKAGE\s+POLICY[\s\S]{0,24}?ENHANCED\s+COVERS/i;
const NEW_INDIA = /THE\s+NEW\s+INDIA\s+ASSURANCE|NEW\s+INDIA\s+ASSURANCE\s+COMPANY/i;
const MONEY_RE = /\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b|\b\d{2,9}(?:\.\d{1,2})?\b/g;

/** Narrow production refinement for New India Commercial Vehicle Package Policy - Enhanced Covers. */
export function refineNewIndiaEnhancedCoversPolicy(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (parsed.parserId !== "new_india_motor_v1") return parsed;
  const firstTwo = pages.slice(0, 2).join("\n");
  if (!NEW_INDIA.test(firstTwo) || !ENHANCED_TITLE.test(firstTwo)) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const warnings = parsed.warnings.filter((warning) => !/New India Enhanced Covers/i.test(warning));

  refineVehicleFields(pages, tables, fields);
  refinePremiumSemantics(pages, tables, fields, warnings);

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+${VERSION_SUFFIX}`,
    fields: [...fields.values()],
    warnings,
  };
}

function refineVehicleFields(pages: string[], tables: StructuredPolicyTable[], fields: Fields) {
  const pageOne = pages[0] ?? "";
  const vehicleBlock = bounded(pageOne, /VEHICLE\s+DETAILS/i, /INSURED\s+DECLARED\s+VALUE/i) ?? pageOne;

  const makeModel = findMakeModel(tables) ?? findMakeModelText(vehicleBlock);
  if (makeModel) {
    set(fields, "vehicle_make", "Vehicle make", makeModel.make, .995, makeModel.page, makeModel.evidence);
    set(fields, "vehicle_model", "Vehicle model", makeModel.model, .995, makeModel.page, makeModel.evidence);
  }

  const year = findText(pages, /Year\s+of\s+manufacture\s*[:\-]?\s*((?:19|20)\d{2})/i);
  if (year) set(fields, "vehicle_manufacturing_year", "Manufacturing year", year.value, .995, year.page, year.evidence);

  const fuel = findText(pages, /Type\s+of\s+fuel\s*[:\-]?\s*(PETROL|DIESEL|CNG|LPG|ELECTRIC|HYBRID|BATTERY)/i);
  if (fuel) set(fields, "vehicle_fuel_type", "Fuel type", titleCase(fuel.value), .995, fuel.page, fuel.evidence);

  const gvw = findText(pages, /Gross\s+Vehicle\s+Weight\s*\(GVW\)\s*[:\-]?\s*([0-9][0-9,]{2,8})/i)
    ?? findText(pages, /\bGVW\s*[:\-]?\s*([0-9][0-9,]{2,8})/i);
  if (gvw) set(fields, "vehicle_capacity", "Vehicle capacity", gvw.value.replace(/,/g, ""), .995, gvw.page, gvw.evidence);

  const authority = findText(pages, /Name\s+of\s+registration\s+authority\s*[:\-]?\s*([^\n|]{2,60})/i);
  if (authority) {
    const state = cleanAuthority(authority.value);
    if (state) set(fields, "vehicle_rto_state", "RTO state", state, .97, authority.page, authority.evidence);
  }

  const ids = findChassisEngine(tables) ?? findChassisEngineText(vehicleBlock);
  if (ids) {
    set(fields, "vehicle_chassis_number", "Chassis number", ids.chassis, .995, ids.page, ids.evidence);
    set(fields, "vehicle_engine_number", "Engine number", ids.engine, .995, ids.page, ids.evidence);
  }

  const classEvidence = findText(pages, /Type\s+of\s+Commercial\s+Vehicles\s*[:\-]?\s*([^\n|]{2,80})/i);
  const subtypeEvidence = findText(pages, /Sub\s*Type\s*[:\-]?\s*([^\n|]{2,90})/i);
  const combinedClass = `${classEvidence?.value ?? ""} ${subtypeEvidence?.value ?? ""}`;
  if (/GOODS\s+CARRYING|PUBLIC\s+CARRIER/i.test(combinedClass)) {
    set(fields, "vehicle_class", "Vehicle class", "GCV", .99, classEvidence?.page ?? subtypeEvidence?.page ?? 1,
      clean(`${classEvidence?.evidence ?? ""} ${subtypeEvidence?.evidence ?? ""}`));
  }

  const registration = findText(pages, /Registration\s+no\.?\s*[:\-]?\s*([^\n|]{2,40})/i);
  if (registration && !looksCompleteRegistration(registration.value)) {
    fields.delete("vehicle_registration_number");
    fields.delete("vehicle_registration_status");
  }
}

function refinePremiumSemantics(pages: string[], tables: StructuredPolicyTable[], fields: Fields, warnings: string[]) {
  const od = findLabeledMoney(tables, /Total\s+OD\s+Premium/i)
    ?? findLabeledMoneyText(pages, /Total\s+OD\s+Premium\s*\(Rs\.?\)?/i)
    ?? findLabeledMoney(tables, /Calculated\s+OD\s+Premium/i)
    ?? findLabeledMoneyText(pages, /Calculated\s+OD\s+Premium/i);
  const tp = findLabeledMoney(tables, /Total\s+TP\s+Premium/i)
    ?? findLabeledMoneyText(pages, /Total\s+TP\s+Premium\s*\(Rs\.?\)?/i)
    ?? findLabeledMoney(tables, /Calculated\s+TP\s+Premium/i)
    ?? findLabeledMoneyText(pages, /Calculated\s+TP\s+Premium/i);
  const net = findLabeledMoney(tables, /Net\s+Premium/i)
    ?? findLabeledMoneyText(pages, /Net\s+Premium\s*\(Rs\.?\)?/i);

  if (!tp) {
    fields.delete("tp_premium");
    warnings.push("New India Enhanced Covers: printed Total/Calculated TP Premium was not proven, so TP was withheld for review.");
    return;
  }

  if (!od || !net || !close(od.value + tp.value, net.value)) {
    fields.delete("tp_premium");
    warnings.push("New India Enhanced Covers: OD + printed Total TP did not reconcile to printed Net Premium, so TP was withheld for review.");
    return;
  }

  set(fields, "od_premium", "OD premium", money(od.value), .999, od.page, `${od.evidence} | Enhanced Covers printed OD total.`);
  set(fields, "tp_premium", "Third party premium", money(tp.value), .999, tp.page, `${tp.evidence} | Enhanced Covers printed TP total; owner-driver CPA is already included in this subtotal.`);
  set(fields, "total_premium", "Printed net premium", money(net.value), .999, net.page, net.evidence);

  const cpa = numeric(fields.get("cpa_premium"));
  if (cpa !== null && cpa > 0) {
    set(fields, "cpa_opted", "CPA opted", "Yes", .99, fields.get("cpa_premium")?.page ?? tp.page,
      fields.get("cpa_premium")?.evidence ?? "Owner-driver CPA retained separately from printed TP subtotal.");
  }
}

function findMakeModel(tables: StructuredPolicyTable[]) {
  for (const table of tables) {
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r].map(clean);
      for (let c = 0; c < row.length; c += 1) {
        const cell = row[c];
        if (!/Make\s*\/\s*Model/i.test(cell)) continue;
        const inline = parseMakeModel(cell.replace(/.*?Make\s*\/\s*Model\s*[:\-]?/i, ""));
        if (inline) return { ...inline, page: table.page, evidence: safe(row.join(" | ")) };
        for (let next = r + 1; next <= Math.min(r + 2, table.rows.length - 1); next += 1) {
          const candidate = clean(table.rows[next]?.[c] ?? "");
          const parsed = parseMakeModel(candidate);
          if (parsed) return { ...parsed, page: table.page, evidence: safe(`${cell} | ${candidate}`) };
        }
        for (let adjacent = c + 1; adjacent < row.length; adjacent += 1) {
          const parsed = parseMakeModel(row[adjacent]);
          if (parsed) return { ...parsed, page: table.page, evidence: safe(row.join(" | ")) };
        }
      }
    }
  }
  return null;
}

function findMakeModelText(text: string) {
  const compact = clean(text.replace(/\r?\n/g, " "));
  const match = compact.match(/Make\s*\/\s*Model\s*[:\-]?\s*([A-Z0-9 .&()\-]{2,60}\s*\/\s*[A-Z0-9 .&()\-]{1,60}?)(?=\s+Registration\s+no|\s+Seating\s+capacity|\s+Variant|\s+Automobile|$)/i);
  const parsed = parseMakeModel(match?.[1] ?? "");
  return parsed ? { ...parsed, page: 1, evidence: safe(match?.[0] ?? "") } : null;
}

function parseMakeModel(value: string): { make: string; model: string } | null {
  const normalized = clean(value);
  const slash = normalized.indexOf("/");
  if (slash < 2) return null;
  const make = clean(normalized.slice(0, slash));
  const model = clean(normalized.slice(slash + 1));
  if (!goodVehicleText(make) || !goodVehicleText(model)) return null;
  return { make, model };
}

function findChassisEngine(tables: StructuredPolicyTable[]) {
  for (const table of tables) {
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r].map(clean);
      for (let c = 0; c < row.length; c += 1) {
        if (!/Chassis\s*(?:no\.?|number)?\s*\/\s*Engine\s*(?:no\.?|number)?/i.test(row[c])) continue;
        const inline = parseIdPair(row[c].replace(/.*?Chassis\s*(?:no\.?|number)?\s*\/\s*Engine\s*(?:no\.?|number)?\s*[:\-]?/i, ""));
        if (inline) return { ...inline, page: table.page, evidence: safe(row.join(" | ")) };
        for (let next = r + 1; next <= Math.min(r + 2, table.rows.length - 1); next += 1) {
          const candidate = clean(table.rows[next]?.[c] ?? "");
          const parsed = parseIdPair(candidate);
          if (parsed) return { ...parsed, page: table.page, evidence: safe(`${row[c]} | ${candidate}`) };
        }
        for (let adjacent = c + 1; adjacent < row.length; adjacent += 1) {
          const parsed = parseIdPair(row[adjacent]);
          if (parsed) return { ...parsed, page: table.page, evidence: safe(row.join(" | ")) };
        }
      }
    }
  }
  return null;
}

function findChassisEngineText(text: string) {
  const compact = clean(text.replace(/\r?\n/g, " "));
  const match = compact.match(/Chassis\s*(?:no\.?|number)?\s*\/\s*Engine\s*(?:no\.?|number)?\s*[:\-]?\s*([A-Z0-9\s-]{6,40}\s*\/\s*[A-Z0-9\s-]{6,45}?)(?=\s+Type\s+of\s+fuel|\s+Type\s+of\s+body|\s+Cubic|\s+Gross\s+Vehicle|$)/i);
  const parsed = parseIdPair(match?.[1] ?? "");
  return parsed ? { ...parsed, page: 1, evidence: safe(match?.[0] ?? "") } : null;
}

function parseIdPair(value: string): { chassis: string; engine: string } | null {
  const slash = value.indexOf("/");
  if (slash < 0) return null;
  const chassis = compactId(value.slice(0, slash));
  const engine = compactId(value.slice(slash + 1));
  if (!goodVehicleId(chassis, 8) || !goodVehicleId(engine, 6) || chassis === engine) return null;
  return { chassis, engine };
}

function findText(pages: string[], pattern: RegExp): TextHit | null {
  for (let i = 0; i < pages.length; i += 1) {
    const match = pages[i].match(pattern);
    if (match?.[1]) return { value: clean(match[1]), page: i + 1, evidence: safe(match[0]) };
  }
  return null;
}

function findLabeledMoney(tables: StructuredPolicyTable[], label: RegExp): MoneyHit | null {
  for (const table of tables) {
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r].map(clean);
      for (let c = 0; c < row.length; c += 1) {
        const cell = row[c];
        const match = cell.match(label);
        if (!match || match.index === undefined) continue;
        const after = cell.slice(match.index + match[0].length);
        const same = firstMoney(after);
        if (same !== null) return { value: same, page: table.page, evidence: safe(row.join(" | ")) };
        for (let nextCell = c + 1; nextCell < row.length; nextCell += 1) {
          const value = firstMoney(row[nextCell]);
          if (value !== null) return { value, page: table.page, evidence: safe(row.join(" | ")) };
        }
        for (let next = r + 1; next <= Math.min(r + 2, table.rows.length - 1); next += 1) {
          const value = firstMoney(table.rows[next]?.[c] ?? "");
          if (value !== null) return { value, page: table.page, evidence: safe(`${cell} | ${table.rows[next]?.[c] ?? ""}`) };
        }
      }
    }
  }
  return null;
}

function findLabeledMoneyText(pages: string[], label: RegExp): MoneyHit | null {
  for (let i = 0; i < pages.length; i += 1) {
    const lines = pages[i].split(/\r?\n/).map(clean).filter(Boolean);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const match = line.match(label);
      if (!match || match.index === undefined) continue;
      const after = line.slice(match.index + match[0].length);
      const same = firstMoney(after);
      if (same !== null) return { value: same, page: i + 1, evidence: safe(line) };
      for (let next = lineIndex + 1; next <= Math.min(lineIndex + 2, lines.length - 1); next += 1) {
        if (/Total\s+(?:OD|TP)|Calculated\s+(?:OD|TP)|Net\s+Premium|GST|Total\s+Payable/i.test(lines[next])) break;
        const value = firstMoney(lines[next]);
        if (value !== null) return { value, page: i + 1, evidence: safe(`${line} | ${lines[next]}`) };
      }
    }
  }
  return null;
}

function firstMoney(value: string): number | null {
  const matches = value.match(MONEY_RE) ?? [];
  for (const raw of matches) {
    const amount = Number(raw.replace(/,/g, ""));
    if (Number.isFinite(amount) && amount >= 0 && amount !== 997134 && !(Number.isInteger(amount) && amount >= 1900 && amount <= 2100)) return amount;
  }
  return null;
}

function numeric(field: ParsedPolicyField | undefined) {
  if (!field?.value) return null;
  const value = Number(field.value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? value : null;
}

function set(fields: Fields, key: string, label: string, value: string, confidence: number, page: number | null, evidence: string) {
  fields.set(key, { key, label, value, confidence, page, evidence: safe(evidence) });
}

function bounded(text: string, start: RegExp, end: RegExp) {
  const startIndex = text.search(start);
  if (startIndex < 0) return null;
  const rest = text.slice(startIndex);
  const endIndex = rest.search(end);
  return endIndex > 0 ? rest.slice(0, endIndex) : rest.slice(0, 5000);
}
function goodVehicleText(value: string) { return value.length >= 2 && value.length <= 80 && !/^(?:MAKE|MODEL|TYPE|NO|NA|N\/A)$/i.test(value); }
function compactId(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function goodVehicleId(value: string, minLength: number) { return value.length >= minLength && value.length <= 30 && /[A-Z]/.test(value) && /\d/.test(value); }
function looksCompleteRegistration(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/.test(compact) || /^\d{2}BH\d{4}[A-Z]{2}$/.test(compact);
}
function cleanAuthority(value: string) {
  const cleaned = clean(value).replace(/\s+(?:FASTag|Cover\s+Note).*$/i, "");
  if (!cleaned || cleaned.length > 40) return null;
  return titleCase(cleaned);
}
function titleCase(value: string) { return value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()); }
function clean(value: string) { return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(); }
function safe(value: string) { return clean(value).slice(0, 600); }
function close(a: number, b: number) { return Math.abs(a - b) <= 1; }
function money(value: number) { const rounded = Math.round((value + Number.EPSILON) * 100) / 100; return Number.isInteger(rounded) ? String(rounded) : String(rounded); }
