import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Fields = Map<string, ParsedPolicyField>;
type VehicleIds = { engine: string | null; chassis: string | null };

const LABELS: Record<string, string> = {
  vehicle_chassis_number: "Chassis number",
  vehicle_engine_number: "Engine number",
  vehicle_fuel_type: "Fuel type",
  od_premium: "OD premium",
  tp_premium: "TP premium",
  cpa_premium: "CPA amount",
  cpa_opted: "CPA opted",
};

const FAMILY = /GCV\s+PUBLIC\s+CARRIER\s+OTHER\s+THAN\s+3\s+WHEELER\s+(?:[-–—]\s*)?PACKAGE(?:\s+POLICY)?/i;
const UNITED_INDIA = /UNITED\s+INDIA\s+INSURANCE\s+COMPANY/i;
const ID_TOKEN = /[A-Z0-9][A-Z0-9./-]{13,34}/gi;
const MONEY_TOLERANCE = 1;

/**
 * Narrow recovery for United India GCV Public Carrier Other Than 3 Wheeler
 * Package schedules. This keeps the existing united_india_motor_v1 parser and
 * only repairs fields that can be proven from the current-policy layout.
 */
export function refineProductionRound10UiicGcvPackage(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (parsed.parserId !== "united_india_motor_v1") return parsed;

  const firstTwo = pages.slice(0, 2).join("\n");
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 140).join(" ");
  if (!UNITED_INDIA.test(header) || !FAMILY.test(firstTwo)) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const page2 = pages[1] ?? "";
  const vehicle = bounded(page2, /VEHICLE\s+DETAILS/i, /INSURED\s+DECLARED\s+VALUE/i) ?? page2;
  const premium = bounded(firstTwo, /SCHEDULE\s+OF\s+PREMIUM/i, /TERMS\s*&\s*CONDITIONS|DISCLAIMER/i) ?? firstTwo;
  const warnings = parsed.warnings.filter((warning) => !/round 10 uiic gcv/i.test(warning));

  repairVehicleIds(fields, tables, vehicle);
  repairFuel(fields, tables, vehicle);
  repairFinancials(fields, tables, premium, warnings);

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+prod-r10-uiic_gcv_package`,
    fields: [...fields.values()],
    warnings: [...warnings, "Production round 10 UIIC GCV Package refinement applied."],
  };
}

function repairVehicleIds(fields: Fields, tables: StructuredPolicyTable[], vehicle: string) {
  const structured = structuredVehicleIds(tables);
  const textEngine = labelBoundVehicleId(vehicle, /Engine\s+(?:Number|No\.?)\b/i);
  const textChassis = labelBoundVehicleId(vehicle, /Chassis\s+(?:Number|No\.?)\b/i);

  const engine = structured.engine ?? textEngine;
  const chassis = structured.chassis ?? textChassis;

  if (engine && chassis && engine !== chassis) {
    set(fields, "vehicle_engine_number", engine, .999, 2, structured.engine ? "Round 10 UIIC structured Engine Number column" : "Round 10 UIIC label-bounded Engine Number");
    set(fields, "vehicle_chassis_number", chassis, .999, 2, structured.chassis ? "Round 10 UIIC structured Chassis Number column" : "Round 10 UIIC label-bounded Chassis Number");
    return;
  }

  // Never copy one identifier into the other merely because its sibling is
  // missing. Preserve only independently proven values.
  if (engine) set(fields, "vehicle_engine_number", engine, .995, 2, structured.engine ? "Round 10 UIIC structured Engine Number column" : "Round 10 UIIC label-bounded Engine Number");
  if (chassis) set(fields, "vehicle_chassis_number", chassis, .995, 2, structured.chassis ? "Round 10 UIIC structured Chassis Number column" : "Round 10 UIIC label-bounded Chassis Number");

  const currentEngine = compact(fields.get("vehicle_engine_number")?.value ?? "");
  const currentChassis = compact(fields.get("vehicle_chassis_number")?.value ?? "");
  if (currentEngine && currentChassis && currentEngine === currentChassis && !(engine && chassis)) {
    // Ambiguous duplicate identity is less safe than withholding the unproven
    // sibling. Keep the field that has direct evidence from this refinement.
    if (engine && !chassis) fields.delete("vehicle_chassis_number");
    if (chassis && !engine) fields.delete("vehicle_engine_number");
  }
}

function structuredVehicleIds(tables: StructuredPolicyTable[]): VehicleIds {
  let engine: string | null = null;
  let chassis: string | null = null;
  for (const table of tables) {
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r];
      for (let c = 0; c < row.length; c += 1) {
        const cell = clean(row[c] ?? "");
        if (!engine && /Engine\s+(?:Number|No\.?)\b/i.test(cell)) {
          engine = sameCellOrColumnId(table.rows, r, c, /Engine\s+(?:Number|No\.?)\b/i);
        }
        if (!chassis && /Chassis\s+(?:Number|No\.?)\b/i.test(cell)) {
          chassis = sameCellOrColumnId(table.rows, r, c, /Chassis\s+(?:Number|No\.?)\b/i);
        }
      }
    }
  }
  return { engine, chassis };
}

function sameCellOrColumnId(rows: string[][], rowIndex: number, columnIndex: number, label: RegExp): string | null {
  const sameCell = clean(rows[rowIndex]?.[columnIndex] ?? "").replace(label, " ");
  const direct = firstPlausibleId(sameCell);
  if (direct) return direct;

  // Layout Parser commonly emits labels in one row and values in the same
  // column of the following body row. Stay inside that column to avoid the
  // Engine/Chassis cross-association caused by flattened text proximity.
  for (let r = rowIndex + 1; r <= Math.min(rowIndex + 3, rows.length - 1); r += 1) {
    const candidateCell = clean(rows[r]?.[columnIndex] ?? "");
    if (!candidateCell) continue;
    if (/Engine\s+(?:Number|No\.?)|Chassis\s+(?:Number|No\.?)|Gross\s+vehicle\s+Weight|RTA\s+Name|Vehicle\s+Make/i.test(candidateCell)) break;
    const candidate = firstPlausibleId(candidateCell);
    if (candidate) return candidate;
  }
  return null;
}

function labelBoundVehicleId(text: string, label: RegExp): string | null {
  const lines = rawLines(text);
  for (let i = 0; i < lines.length; i += 1) {
    if (!label.test(lines[i])) continue;

    const same = lines[i].replace(label, " ");
    const sameHit = firstPlausibleId(same);
    if (sameHit) return sameHit;

    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j += 1) {
      const line = lines[j];
      if (/Engine\s+(?:Number|No\.?)|Chassis\s+(?:Number|No\.?)|Year\s+Of\s+Manufacture|Gross\s+vehicle\s+Weight|RTA\s+Name|Vehicle\s+Make|Type\s+Of\s+Body|Registration\s+Date|Cubic\s+Capacity/i.test(line)) break;
      const tokens = plausibleIds(line);
      if (tokens.length === 1) return tokens[0];
      if (tokens.length > 1) return null;
    }
  }
  return null;
}

function repairFuel(fields: Fields, tables: StructuredPolicyTable[], vehicle: string) {
  const fuel = structuredFuel(tables) ?? labelBoundFuel(vehicle);
  if (fuel) set(fields, "vehicle_fuel_type", fuel, .995, 2, "Round 10 UIIC explicit Body/Fuel field");
}

function structuredFuel(tables: StructuredPolicyTable[]): string | null {
  for (const table of tables) {
    for (let r = 0; r < table.rows.length; r += 1) {
      for (let c = 0; c < table.rows[r].length; c += 1) {
        const cell = clean(table.rows[r][c] ?? "");
        if (!/Type\s+Of\s+Body(?:\s*\/\s*Fuel\s+Type)?|Fuel\s+Type/i.test(cell)) continue;
        const same = normalizeFuel(cell.replace(/.*?(?:Fuel\s+Type|Type\s+Of\s+Body)\s*[:#-]?/i, ""));
        if (same) return same;
        for (let next = r + 1; next <= Math.min(r + 2, table.rows.length - 1); next += 1) {
          const value = normalizeFuel(table.rows[next]?.[c] ?? "");
          if (value) return value;
        }
      }
    }
  }
  return null;
}

function labelBoundFuel(text: string): string | null {
  const lines = rawLines(text);
  for (let i = 0; i < lines.length; i += 1) {
    if (!/Type\s+Of\s+Body(?:\s*\/\s*Fuel\s+Type)?|Fuel\s+Type/i.test(lines[i])) continue;
    const same = normalizeFuel(lines[i]);
    if (same) return same;
    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j += 1) {
      if (/Registration\s+Date|Cubic\s+Capacity|Engine\s+Number|Year\s+Of\s+Manufacture/i.test(lines[j])) break;
      const value = normalizeFuel(lines[j]);
      if (value) return value;
    }
  }
  return null;
}

function normalizeFuel(value: string): string | null {
  const hit = value.match(/\b(DIESEL|PETROL|CNG|LPG|ELECTRIC|EV)\b/i)?.[1]?.toUpperCase();
  if (!hit) return null;
  if (hit === "EV" || hit === "ELECTRIC") return "Electric";
  if (hit === "CNG") return "CNG";
  if (hit === "LPG") return "LPG";
  return hit[0] + hit.slice(1).toLowerCase();
}

function repairFinancials(fields: Fields, tables: StructuredPolicyTable[], premium: string, warnings: string[]) {
  const od = structuredMoney(tables, /Gross\s+OD\s*\(A\)/i) ?? strictMoneyAfterLabel(premium, /Gross\s+OD\s*\(A\)/i);
  const tp = structuredMoney(tables, /Gross\s+TP\s*\(B\)/i) ?? strictMoneyAfterLabel(premium, /Gross\s+TP\s*\(B\)/i);
  const net = moneyField(fields, "printed_net_premium") ?? moneyField(fields, "total_premium")
    ?? structuredMoney(tables, /Premium\s*\(A\s*\+\s*B\)/i)
    ?? strictMoneyAfterLabel(premium, /Premium\s*\(A\s*\+\s*B\)/i);

  if (od == null || tp == null || net == null) return;

  const explicitCpaZero = /(?:CPA|Compulsory\s+Personal\s+Accident)[^\n]{0,80}(?:removed|not\s+opted|0(?:\.00)?\b)|PA\s+Cover\s+CSI[^\n]{0,50}\b0(?:\.00)?\b/i.test(premium);
  const currentCpa = moneyField(fields, "cpa_premium");
  const cpa = currentCpa ?? (explicitCpaZero ? 0 : null);
  const directSum = round2(od + tp + (cpa ?? 0));

  // Gross OD(A) and Gross TP(B) are authoritative for this layout only when
  // they reconcile to the printed net. This prevents Basic OD/TP or tax-rate
  // values from being promoted by proximity.
  if (!close(directSum, net)) {
    fields.delete("od_premium");
    fields.delete("tp_premium");
    warnings.push("Review required. Round 10 UIIC GCV Gross OD/TP rows did not reconcile to the printed net premium; OD/TP were withheld.");
    return;
  }

  setMoney(fields, "od_premium", od, "Round 10 UIIC explicit Gross OD(A) reconciled to printed net");
  setMoney(fields, "tp_premium", tp, "Round 10 UIIC explicit Gross TP(B) reconciled to printed net");

  if (cpa === 0 && explicitCpaZero) {
    setMoney(fields, "cpa_premium", 0, "Round 10 UIIC explicit zero/removed owner-driver CPA evidence");
    set(fields, "cpa_opted", "No", .999, 2, "Round 10 UIIC explicit zero/removed owner-driver CPA evidence");
  }
}

function structuredMoney(tables: StructuredPolicyTable[], label: RegExp): number | null {
  for (const table of tables) {
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r];
      for (let c = 0; c < row.length; c += 1) {
        const cell = clean(row[c] ?? "");
        if (!label.test(cell)) continue;
        const same = firstMoney(cell.replace(label, " "));
        if (same != null) return same;
        for (let next = r + 1; next <= Math.min(r + 2, table.rows.length - 1); next += 1) {
          const value = firstMoney(table.rows[next]?.[c] ?? "");
          if (value != null) return value;
        }
        if (c + 1 < row.length) {
          const right = firstMoney(row[c + 1] ?? "");
          if (right != null) return right;
        }
      }
    }
  }
  return null;
}

function strictMoneyAfterLabel(text: string, label: RegExp): number | null {
  const lines = rawLines(text);
  for (let i = 0; i < lines.length; i += 1) {
    if (!label.test(lines[i])) continue;
    const same = firstMoney(lines[i].replace(label, " "));
    if (same != null) return same;
    for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j += 1) {
      if (/Gross\s+(?:OD|TP)|Premium\s*\(A\s*\+\s*B\)|CGST|SGST|IGST|TOTAL\s+PAYABLE/i.test(lines[j])) break;
      const value = firstMoney(lines[j]);
      if (value != null) return value;
    }
  }
  return null;
}

function firstMoney(value: string): number | null {
  const matches = value.match(/\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b|\b\d{2,8}(?:\.\d{1,2})?\b/g) ?? [];
  for (const raw of matches) {
    const amount = Number(raw.replace(/,/g, ""));
    if (Number.isFinite(amount)) return amount;
  }
  return null;
}

function plausibleIds(value: string): string[] {
  return (value.match(ID_TOKEN) ?? []).map(compact).filter(plausibleId);
}
function firstPlausibleId(value: string): string | null { return plausibleIds(value)[0] ?? null; }
function plausibleId(value: string) {
  return value.length >= 14 && value.length <= 35 && /[A-Z]/.test(value) && /\d/.test(value)
    && !/ENGINE|CHASSIS|VEHICLE|REGISTRATION|CAPACITY|OBSOLETE|MANUFACTURE/.test(value);
}
function bounded(text: string, start: RegExp, end: RegExp): string | null {
  const s = text.search(start);
  if (s < 0) return null;
  const rest = text.slice(s);
  const e = rest.search(end);
  return e > 0 ? rest.slice(0, e) : rest.slice(0, 5000);
}
function rawLines(text: string) { return text.split(/\r?\n/).map(clean).filter(Boolean); }
function clean(value: string) { return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(); }
function compact(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function moneyField(fields: Fields, key: string): number | null {
  const raw = fields.get(key)?.value?.replace(/,/g, "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
function set(fields: Fields, key: string, value: string, confidence: number, page: number, evidence: string) {
  fields.set(key, { key, label: LABELS[key] ?? key, value, confidence, page, evidence });
}
function setMoney(fields: Fields, key: string, value: number, evidence: string) {
  set(fields, key, Number.isInteger(value) ? String(value) : String(round2(value)), .999, 2, evidence);
}
function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function close(a: number, b: number) { return Math.abs(a - b) <= MONEY_TOLERANCE; }
