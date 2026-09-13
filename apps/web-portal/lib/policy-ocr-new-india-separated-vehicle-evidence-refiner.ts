import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const NEW_INDIA = /THE\s+NEW\s+INDIA\s+ASSURANCE|NEW\s+INDIA\s+ASSURANCE\s+COMPANY/i;
const ENHANCED = /COMMERCIAL\s+VEHICLE\s+PACKAGE\s+POLICY[\s\S]{0,40}?ENHANCED\s+COVERS/i;
const COMBINED_LABEL = /Chassis\s*(?:no\.?|number)?\s*\/\s*Engine\s*(?:no\.?|number)?/i;

export function refineNewIndiaSeparatedVehicleEvidence(
  pages: string[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (parsed.parserId !== "new_india_motor_v1") return parsed;
  const firstTwo = pages.slice(0, 2).join("\n");
  if (!NEW_INDIA.test(firstTwo) || !ENHANCED.test(firstTwo)) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const vehicle = boundedVehicleText(pages[0] ?? firstTwo);

  if (!has(fields, "vehicle_manufacturing_year")) {
    const year = uniqueVehicleYear(vehicle);
    if (year) set(fields, "vehicle_manufacturing_year", "Manufacturing year", year, "Vehicle Details unique year evidence");
  }

  if (!has(fields, "vehicle_chassis_number") || !has(fields, "vehicle_engine_number")) {
    const pair = findSeparatedPair(vehicle);
    if (pair) {
      if (!has(fields, "vehicle_chassis_number")) set(fields, "vehicle_chassis_number", "Chassis number", pair.chassis, pair.evidence);
      if (!has(fields, "vehicle_engine_number")) set(fields, "vehicle_engine_number", "Engine number", pair.engine, pair.evidence);
    }
  }

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+new-india-separated-vehicle-evidence-v4`,
    fields: [...fields.values()],
  };
}

function boundedVehicleText(page: string) {
  const start = page.search(/VEHICLE\s+DETAILS/i);
  const source = start >= 0 ? page.slice(start) : page;
  const end = source.search(/INSURED\s+DECLARED\s+VALUE|SCHEDULE\s+OF\s+PREMIUM/i);
  return end > 0 ? source.slice(0, end) : source.slice(0, 7000);
}

function uniqueVehicleYear(vehicle: string) {
  if (!/Year\s+of\s+manufacture/i.test(vehicle)) return null;
  const years = [...vehicle.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => match[0]);
  const unique = [...new Set(years)];
  return unique.length === 1 ? unique[0] : null;
}

function findSeparatedPair(vehicle: string): { chassis: string; engine: string; evidence: string } | null {
  const label = vehicle.match(COMBINED_LABEL);
  if (!label || label.index == null) return null;
  const start = label.index + label[0].length;
  const after = vehicle.slice(start, start + 420);
  const stop = after.search(/Type\s+of\s+fuel|Cubic\s+capacity|Type\s+of\s+body|Gross\s+Vehicle\s+Weight|Make\s*\/\s*Model|Registration\s*(?:no\.?|number)/i);
  const block = stop >= 0 ? after.slice(0, stop) : after;
  const candidates = extractMixedIds(block);
  if (candidates.length < 2) return null;

  const chassisCandidates = candidates.filter(looksLikeChassis);
  if (chassisCandidates.length !== 1) return null;
  const chassis = chassisCandidates[0];
  const engineCandidates = candidates.filter((value) => value !== chassis && !looksLikeChassis(value));
  if (engineCandidates.length !== 1) return null;
  return { chassis, engine: engineCandidates[0], evidence: "Combined Chassis/Engine block with unique VIN-shaped chassis and one engine-shaped identifier" };
}

function extractMixedIds(block: string) {
  const normalized = block
    .replace(/[\u00a0\t\r\n]+/g, " ")
    .replace(/\s*\/\s*/g, " ")
    .trim();
  const raw = normalized.match(/[A-Z0-9][A-Z0-9\s-]{5,34}/gi) ?? [];
  const ids = raw
    .map(compactId)
    .filter(validId)
    .filter((value) => !/^(?:CHASSIS|ENGINE|NUMBER|NO|TYPE|FUEL)$/.test(value));
  return [...new Set(ids)];
}

function looksLikeChassis(value: string) {
  return value.length === 17 && /^[A-Z0-9]{17}$/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
}
function validId(value: string) {
  return value.length >= 10 && value.length <= 24 && /[A-Z]/.test(value) && /\d/.test(value);
}
function compactId(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function has(fields: Map<string, ParsedPolicyField>, key: string) {
  return Boolean(fields.get(key)?.value?.trim());
}
function set(fields: Map<string, ParsedPolicyField>, key: string, label: string, value: string, evidence: string) {
  fields.set(key, { key, label, value, confidence: .995, page: 1, evidence });
}
