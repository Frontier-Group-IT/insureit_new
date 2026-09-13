import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

const NEW_INDIA = /THE\s+NEW\s+INDIA\s+ASSURANCE|NEW\s+INDIA\s+ASSURANCE\s+COMPANY/i;
const ENHANCED = /COMMERCIAL\s+VEHICLE\s+PACKAGE\s+POLICY[\s\S]{0,40}?ENHANCED\s+COVERS/i;
const COMBINED_LABEL = /Chassis\s*(?:no\.?|number)?\s*\/\s*Engine\s*(?:no\.?|number)?/i;
const YEAR_LABEL = /Year\s+of\s+manufacture/i;

export function refineNewIndiaSeparatedVehicleEvidence(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (parsed.parserId !== "new_india_motor_v1") return parsed;
  const firstTwo = pages.slice(0, 2).join("\n");
  if (!NEW_INDIA.test(firstTwo) || !ENHANCED.test(firstTwo)) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const vehicle = boundedVehicleText(pages[0] ?? firstTwo);

  const structuredYear = findStructuredYear(tables);
  if (structuredYear) {
    set(fields, "vehicle_manufacturing_year", "Manufacturing year", structuredYear.value, structuredYear.evidence);
  } else {
    const years = vehicleYears(vehicle);
    if (years.length > 1) {
      fields.delete("vehicle_manufacturing_year");
    } else if (years.length === 1 && !has(fields, "vehicle_manufacturing_year")) {
      set(fields, "vehicle_manufacturing_year", "Manufacturing year", years[0], "Vehicle Details unique year evidence");
    }
  }

  const structuredPair = findStructuredPair(tables);
  const pair = structuredPair ?? findSeparatedPair(vehicle);
  if (pair) {
    set(fields, "vehicle_chassis_number", "Chassis number", pair.chassis, pair.evidence);
    set(fields, "vehicle_engine_number", "Engine number", pair.engine, pair.evidence);
  }

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+new-india-separated-vehicle-evidence-v5`,
    fields: [...fields.values()],
  };
}

function boundedVehicleText(page: string) {
  const start = page.search(/VEHICLE\s+DETAILS/i);
  const source = start >= 0 ? page.slice(start) : page;
  const end = source.search(/INSURED\s+DECLARED\s+VALUE|SCHEDULE\s+OF\s+PREMIUM/i);
  return end > 0 ? source.slice(0, end) : source.slice(0, 7000);
}

function vehicleYears(vehicle: string) {
  if (!YEAR_LABEL.test(vehicle)) return [];
  return [...new Set([...vehicle.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => match[0]))];
}

function findStructuredYear(tables: StructuredPolicyTable[]): { value: string; evidence: string } | null {
  const hits: Array<{ value: string; evidence: string }> = [];
  for (const table of tables.filter((entry) => entry.page === 1)) {
    for (const rawRow of table.rows) {
      const row = rawRow.map(cleanCell);
      for (let c = 0; c < row.length; c += 1) {
        const cell = row[c];
        if (!YEAR_LABEL.test(cell)) continue;
        const inline = cell.match(/Year\s+of\s+manufacture\s*[:\-]?\s*((?:19|20)\d{2})/i)?.[1];
        const adjacent = row.slice(c + 1).map((value) => value.match(/\b((?:19|20)\d{2})\b/)?.[1]).find(Boolean);
        const value = inline ?? adjacent;
        if (value) hits.push({ value, evidence: `Structured Vehicle Details row: ${row.join(" | ")}` });
      }
    }
  }
  const unique = [...new Set(hits.map((hit) => hit.value))];
  if (unique.length !== 1) return null;
  return hits.find((hit) => hit.value === unique[0]) ?? null;
}

function findStructuredPair(tables: StructuredPolicyTable[]): { chassis: string; engine: string; evidence: string } | null {
  const pairs: Array<{ chassis: string; engine: string; evidence: string }> = [];
  for (const table of tables.filter((entry) => entry.page === 1)) {
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r].map(cleanCell);
      for (let c = 0; c < row.length; c += 1) {
        const cell = row[c];
        if (!COMBINED_LABEL.test(cell)) continue;

        const inline = cell.replace(COMBINED_LABEL, "").replace(/^\s*[:\-]?\s*/, "");
        const candidates = [inline, ...row.slice(c + 1)];
        for (const candidate of candidates) {
          const parsed = parseLabeledPair(candidate);
          if (parsed) pairs.push({ ...parsed, evidence: `Structured Vehicle Details row: ${row.join(" | ")}` });
        }

        for (let next = r + 1; next <= Math.min(r + 2, table.rows.length - 1); next += 1) {
          const nextRow = table.rows[next].map(cleanCell);
          const candidatesBelow = [nextRow[c] ?? "", ...nextRow.slice(c + 1)];
          for (const candidate of candidatesBelow) {
            const parsed = parseLabeledPair(candidate);
            if (parsed) pairs.push({ ...parsed, evidence: `Structured Vehicle Details rows: ${row.join(" | ")} || ${nextRow.join(" | ")}` });
          }
        }
      }
    }
  }

  const unique = dedupePairs(pairs);
  return unique.length === 1 ? unique[0] : null;
}

function findSeparatedPair(vehicle: string): { chassis: string; engine: string; evidence: string } | null {
  const label = vehicle.match(COMBINED_LABEL);
  if (!label || label.index == null) return null;
  const start = label.index + label[0].length;
  const after = vehicle.slice(start, start + 420);
  const stop = after.search(/Type\s+of\s+fuel|Cubic\s+capacity|Type\s+of\s+body|Gross\s+Vehicle\s+Weight|Make\s*\/\s*Model|Registration\s*(?:no\.?|number)/i);
  const block = stop >= 0 ? after.slice(0, stop) : after;

  const direct = parseLabeledPair(block);
  if (direct) return { ...direct, evidence: "Combined Chassis/Engine block with VIN-shape disambiguation" };

  const candidates = extractMixedIds(block);
  const chassisCandidates = candidates.filter(looksLikeChassis);
  if (chassisCandidates.length !== 1) return null;
  const chassis = chassisCandidates[0];
  const engineCandidates = candidates.filter((value) => value !== chassis && !looksLikeChassis(value));
  if (engineCandidates.length !== 1) return null;
  return { chassis, engine: engineCandidates[0], evidence: "Combined Chassis/Engine block with unique VIN-shaped chassis and one engine-shaped identifier" };
}

function parseLabeledPair(raw: string): { chassis: string; engine: string } | null {
  const normalized = raw.replace(/\u00a0/g, " ").trim();
  const slash = normalized.indexOf("/");
  if (slash >= 0) {
    const left = compactId(normalized.slice(0, slash));
    const right = compactId(normalized.slice(slash + 1));
    if (validId(left) && validId(right) && left !== right) {
      if (looksLikeChassis(left) && !looksLikeChassis(right)) return { chassis: left, engine: right };
      if (looksLikeChassis(right) && !looksLikeChassis(left)) return { chassis: right, engine: left };
    }
  }

  const tokens = normalized
    .split(/\r?\n|\s{2,}|\|/)
    .map(compactId)
    .filter(validId);
  const chassis = [...new Set(tokens.filter(looksLikeChassis))];
  const engine = [...new Set(tokens.filter((value) => !looksLikeChassis(value)))];
  return chassis.length === 1 && engine.length === 1 ? { chassis: chassis[0], engine: engine[0] } : null;
}

function extractMixedIds(block: string) {
  const lines = block.replace(/\u00a0/g, " ").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const ids: string[] = [];
  for (const line of lines) {
    const slashPair = parseLabeledPair(line);
    if (slashPair) {
      ids.push(slashPair.chassis, slashPair.engine);
      continue;
    }
    const compactLine = compactId(line);
    if (validId(compactLine)) {
      ids.push(compactLine);
      continue;
    }
    const tokens = line.match(/[A-Z0-9][A-Z0-9-]{5,29}/gi) ?? [];
    for (const token of tokens) {
      const candidate = compactId(token);
      if (validId(candidate)) ids.push(candidate);
    }
  }
  return [...new Set(ids)].filter((value) => !/^(?:CHASSIS|ENGINE|NUMBER|NO|TYPE|FUEL)$/.test(value));
}

function dedupePairs(pairs: Array<{ chassis: string; engine: string; evidence: string }>) {
  const seen = new Set<string>();
  return pairs.filter((pair) => {
    const key = `${pair.chassis}|${pair.engine}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanCell(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
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
