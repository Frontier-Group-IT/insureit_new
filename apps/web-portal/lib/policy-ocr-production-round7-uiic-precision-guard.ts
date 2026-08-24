import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

type Fields = Map<string, ParsedPolicyField>;

const LABELS: Record<string, string> = {
  vehicle_chassis_number: "Chassis number",
};

/**
 * Round 7 is a precision-only guard for the revealed UIIC GCV Package family.
 * It does not attempt broad recovery. It removes impossible residual values and
 * reclassifies a VIN-shaped chassis token that earlier rounds placed in Engine.
 */
export function refineProductionRound7UiicPrecision(parsed: ParsedPolicyResult): ParsedPolicyResult {
  if (!parsed.parserVersion.includes("+prod-r6-uiic_residual")) return parsed;
  if (parsed.parserId !== "united_india_motor_v1") return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const product = fields.get("policy_product")?.value?.trim() ?? "";
  const vehicleClass = fields.get("vehicle_class")?.value?.trim() ?? "";
  if (!/^Package$/i.test(product) || !/^GCV$/i.test(vehicleClass)) return parsed;

  const engine = compact(fields.get("vehicle_engine_number")?.value ?? "");
  const chassis = compact(fields.get("vehicle_chassis_number")?.value ?? "");
  if (!chassis && looksLikeVin(engine)) {
    set(fields, "vehicle_chassis_number", engine, .999, fields.get("vehicle_engine_number")?.page ?? 1,
      "Round 7 VIN-shaped token reclassified from Engine to Chassis");
    fields.delete("vehicle_engine_number");
  }

  const net = money(fields, "total_premium");
  const gross = money(fields, "gross_premium");
  const tax = money(fields, "tax_amount");

  if (net != null && gross != null && gross < net) fields.delete("gross_premium");
  if (net != null && tax != null && (tax < 100 || tax > net * 0.30)) fields.delete("tax_amount");

  const idv = money(fields, "idv");
  const od = money(fields, "od_premium");
  if (idv != null && idv > 0 && od === 0) fields.delete("od_premium");

  const capacity = money(fields, "vehicle_capacity");
  if (capacity != null && capacity >= 1900 && capacity <= 2100) fields.delete("vehicle_capacity");

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+prod-r7-uiic_precision_guard`,
    fields: [...fields.values()],
    warnings: [
      ...parsed.warnings.filter((warning) => !/round 7 uiic/i.test(warning)),
      "Production benchmark round 7 UIIC precision guard applied.",
    ],
  };
}

function looksLikeVin(value: string) {
  return value.length === 17
    && /^[A-Z0-9]+$/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && !/[IOQ]/.test(value);
}
function compact(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function money(fields: Fields, key: string): number | null {
  const raw = fields.get(key)?.value?.replace(/,/g, "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
function set(fields: Fields, key: string, value: string, confidence: number, page: number, evidence: string) {
  fields.set(key, { key, label: LABELS[key] ?? key, value, confidence, page, evidence });
}
