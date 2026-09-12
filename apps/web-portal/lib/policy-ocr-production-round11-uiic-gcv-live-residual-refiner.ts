import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Fields = Map<string, ParsedPolicyField>;

const FAMILY = /GCV\s+PUBLIC\s+CARRIER\s+OTHER\s+THAN\s+3\s+WHEELER\s+(?:[-–—]\s*)?PACKAGE(?:\s+POLICY)?/i;
const UNITED_INDIA = /UNITED\s+INDIA\s+INSURANCE\s+COMPANY/i;
const MONEY_TOLERANCE = 1;

const LABELS: Record<string, string> = {
  vehicle_make: "Vehicle make",
  vehicle_model: "Vehicle model",
  od_premium: "OD premium",
};

/**
 * Post-live residual recovery for the exact United India GCV Public Carrier
 * Other Than 3 Wheeler Package layout. Round 10 already repairs Engine,
 * Chassis, Fuel and Gross TP. This pass only fills the two residual fields
 * observed in live review: Vehicle Make/Model and OD premium.
 */
export function refineProductionRound11UiicGcvLiveResiduals(
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
  const premium = bounded(page2, /SCHEDULE\s+OF\s+PREMIUM/i, /TERMS\s*&\s*CONDITIONS|DISCLAIMER/i)
    ?? bounded(firstTwo, /SCHEDULE\s+OF\s+PREMIUM/i, /TERMS\s*&\s*CONDITIONS|DISCLAIMER/i)
    ?? firstTwo;

  repairMakeModel(fields, tables, vehicle);
  repairResidualOd(fields, premium);

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+prod-r11-uiic_gcv_live_residuals`,
    fields: [...fields.values()],
    warnings: [
      ...parsed.warnings.filter((warning) => !/round 11 uiic gcv/i.test(warning)),
      "Production round 11 UIIC GCV live residual refinement applied.",
    ],
  };
}

function repairMakeModel(fields: Fields, tables: StructuredPolicyTable[], vehicle: string) {
  const recovered = structuredMakeModel(tables) ?? textMakeModel(vehicle);
  if (!recovered) return;

  set(fields, "vehicle_make", recovered.make, .999, 2, recovered.structured
    ? "Round 11 UIIC structured Vehicle Make & Model column"
    : "Round 11 UIIC label-bounded Vehicle Make & Model");
  set(fields, "vehicle_model", recovered.model, .999, 2, recovered.structured
    ? "Round 11 UIIC structured Vehicle Make & Model column"
    : "Round 11 UIIC label-bounded Vehicle Make & Model");
}

function structuredMakeModel(tables: StructuredPolicyTable[]) {
  for (const table of tables) {
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r];
      for (let c = 0; c < row.length; c += 1) {
        const cell = clean(row[c] ?? "");
        if (!/Vehicle\s+Make\s*&\s*Model/i.test(cell)) continue;

        const same = parseMakeModel(cell.replace(/.*?Vehicle\s+Make\s*&\s*Model\s*[:#-]?/i, ""));
        if (same) return { ...same, structured: true as const };

        for (let next = r + 1; next <= Math.min(r + 2, table.rows.length - 1); next += 1) {
          const candidate = clean(table.rows[next]?.[c] ?? "");
          if (!candidate) continue;
          if (/Type\s+Of\s+Body|Registration\s+Date|Engine\s+Number|Year\s+Of\s+Manufacture|INSURED\s+DECLARED\s+VALUE/i.test(candidate)) break;
          const parsed = parseMakeModel(candidate);
          if (parsed) return { ...parsed, structured: true as const };
        }
      }
    }
  }
  return null;
}

function textMakeModel(vehicle: string) {
  const compactText = clean(vehicle.replace(/\r?\n/g, " "));
  const match = compactText.match(/Vehicle\s+Make\s*&\s*Model\s*[:#-]?\s*([\s\S]{3,180}?)(?=\s+Type\s+Of\s+Body|\s+Registration\s+Date|\s+Cubic\s+Capacity|\s+Engine\s+Number|\s+Year\s+Of\s+Manufacture|\s+INSURED\s+DECLARED\s+VALUE|$)/i);
  const parsed = parseMakeModel(match?.[1] ?? "");
  return parsed ? { ...parsed, structured: false as const } : null;
}

function parseMakeModel(value: string): { make: string; model: string } | null {
  const normalized = clean(value)
    .replace(/\bnull\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const slash = normalized.indexOf("/");
  if (slash < 2) return null;

  const make = normalized.slice(0, slash).trim();
  const model = normalized.slice(slash + 1).trim();
  if (!goodVehicleText(make) || !goodVehicleText(model)) return null;
  return { make, model };
}

function repairResidualOd(fields: Fields, premium: string) {
  const currentOd = moneyField(fields, "od_premium");
  if (currentOd != null && currentOd > 0) return;

  const tp = moneyField(fields, "tp_premium");
  const net = moneyField(fields, "printed_net_premium")
    ?? moneyField(fields, "total_premium")
    ?? strictMoneyAfterLabel(premium, /Premium\s*\(A\s*\+\s*B\)/i)
    ?? strictMoneyAfterLabel(premium, /Gross\s+OD\s*&\s*TP\s*:?\s*\(?A\)?\s*\+\s*\(?B\)?/i);
  if (tp == null || tp <= 0 || net == null || net <= 0) return;

  const cpaField = moneyField(fields, "cpa_premium");
  const cpaOpted = fields.get("cpa_opted")?.value?.trim() ?? "";
  const cpa = cpaField ?? (/^No$/i.test(cpaOpted) ? 0 : null);
  if (cpa == null || cpa < 0) return;

  // This exact UIIC schedule explicitly defines Gross OD(A), Gross TP(B), and
  // Premium(A+B). Require those semantics in the current policy before any
  // arithmetic recovery is allowed.
  const hasGrossTp = /Gross\s+TP\s*\(B\)/i.test(premium);
  const hasNetIdentity = /Premium\s*\(A\s*\+\s*B\)|Gross\s+OD\s*&\s*TP/i.test(premium);
  if (!hasGrossTp || !hasNetIdentity) return;

  const derived = round2(net - tp - cpa);
  if (!(derived > 0) || derived >= net) return;

  const directGrossOd = strictMoneyAfterLabel(premium, /Gross\s+OD\s*\(A\)/i);
  if (directGrossOd != null && !close(directGrossOd, derived)) return;

  setMoney(
    fields,
    "od_premium",
    directGrossOd ?? derived,
    directGrossOd != null
      ? "Round 11 UIIC Gross OD(A) confirmed by Premium(A+B) reconciliation"
      : "Round 11 UIIC OD recovered as Premium(A+B) minus Gross TP(B) minus CPA",
  );
}

function strictMoneyAfterLabel(text: string, label: RegExp): number | null {
  const lines = rawLines(text);
  for (let i = 0; i < lines.length; i += 1) {
    if (!label.test(lines[i])) continue;
    const same = firstMoney(lines[i].replace(label, " "));
    if (same != null) return same;
    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j += 1) {
      if (/Gross\s+(?:OD|TP)|Premium\s*\(A\s*\+\s*B\)|CGST|SGST|IGST|TOTAL\s+PAYABLE|SAC\s+Code/i.test(lines[j])) break;
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

function goodVehicleText(value: string) {
  return value.length >= 3 && value.length <= 100
    && !/^(?:MODEL|MAKE|YEAR|TYPE OF BODY|CUBIC CAPACITY|WEIGHT|NO)$/i.test(value)
    && !/SEATING CAPACITY|YEAR OF MANUFACTURE|GROSS VEHICLE WEIGHT|REGISTRATION DATE|ENGINE NUMBER|CHASSIS NUMBER/i.test(value);
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
