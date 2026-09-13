import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Fields = Map<string, ParsedPolicyField>;
type Hit = { value: string; page: number; evidence: string };
type PairHit = { chassis: string; engine: string; page: number; evidence: string };

const ENHANCED_TITLE = /COMMERCIAL\s+VEHICLE\s+PACKAGE\s+POLICY[\s\S]{0,24}?ENHANCED\s+COVERS/i;
const NEW_INDIA = /THE\s+NEW\s+INDIA\s+ASSURANCE|NEW\s+INDIA\s+ASSURANCE\s+COMPANY/i;
const COMBINED_ID_LABEL = /Chassis\s*(?:no\.?|number)?\s*\/\s*Engine\s*(?:no\.?|number)?/i;
const RAW_STOP_LABEL = /(?:Year\s+of\s+manufacture|Type\s+of\s+Commercial\s+Vehicles|Sub\s*Type|Chassis\s*(?:no\.?|number)|Engine\s*(?:no\.?|number)|Type\s+of\s+fuel|Cubic\s+capacity|Type\s+of\s+body|Gross\s+Vehicle\s+Weight|Make\s*\/\s*Model|Registration\s*(?:no\.?|number)|Seating\s+capacity|Variant|Name\s+of\s+registration\s+authority|INSURED\s+DECLARED\s+VALUE)/i;

/**
 * Live residual pass for New India Enhanced Covers after the primary layout
 * refiner. It only fills missing Manufacturing Year, Chassis and Engine fields.
 * Structured tables remain first priority. Bounded raw OCR text is used only
 * when the production Document AI layout does not retain those table cells.
 */
export function refineNewIndiaEnhancedCoversLiveResiduals(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (parsed.parserId !== "new_india_motor_v1") return parsed;
  const firstTwo = pages.slice(0, 2).join("\n");
  if (!NEW_INDIA.test(firstTwo) || !ENHANCED_TITLE.test(firstTwo)) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const vehicleText = boundedVehicleText(pages[0] ?? firstTwo);

  if (!has(fields, "vehicle_manufacturing_year")) {
    const structuredYear = findStructuredValue(
      tables,
      /Year\s+of\s+manufacture/i,
      (value) => /^(?:19|20)\d{2}$/.test(clean(value)),
    );
    const year = structuredYear ?? findRawYear(vehicleText);
    if (year) {
      set(fields, "vehicle_manufacturing_year", "Manufacturing year", clean(year.value), year.page, year.evidence);
    }
  }

  // Prefer the combined semantic pair first. Otherwise a slash-delimited pair
  // can be compacted into one false identifier by a generic single-ID rule.
  const pair = findStructuredPair(tables) ?? findRawPair(vehicleText);
  if (pair) {
    if (!has(fields, "vehicle_chassis_number")) {
      set(fields, "vehicle_chassis_number", "Chassis number", pair.chassis, pair.page, pair.evidence);
    }
    if (!has(fields, "vehicle_engine_number")) {
      set(fields, "vehicle_engine_number", "Engine number", pair.engine, pair.page, pair.evidence);
    }
  }

  if (!has(fields, "vehicle_chassis_number")) {
    const chassis = findStructuredValue(tables, /^Chassis\s*(?:no\.?|number)\b/i, isSingleId)
      ?? findRawSingleId(vehicleText, /Chassis\s*(?:no\.?|number)\b/i);
    if (chassis) {
      set(fields, "vehicle_chassis_number", "Chassis number", compactId(chassis.value), chassis.page, chassis.evidence);
    }
  }

  if (!has(fields, "vehicle_engine_number")) {
    const engine = findStructuredValue(tables, /^Engine\s*(?:no\.?|number)\b/i, isSingleId)
      ?? findRawSingleId(vehicleText, /Engine\s*(?:no\.?|number)\b/i);
    if (engine) {
      set(fields, "vehicle_engine_number", "Engine number", compactId(engine.value), engine.page, engine.evidence);
    }
  }

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+new-india-enhanced-covers-live-residual-v2`,
    fields: [...fields.values()],
  };
}

function findStructuredValue(
  tables: StructuredPolicyTable[],
  label: RegExp,
  accept: (value: string) => boolean,
): Hit | null {
  for (const table of tables) {
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r].map(clean);
      for (let c = 0; c < row.length; c += 1) {
        const match = row[c].match(label);
        if (!match) continue;

        const after = clean(row[c].slice((match.index ?? 0) + match[0].length).replace(/^\s*[:\-]\s*/, ""));
        if (accept(after)) return hit(after, table.page, row.join(" | "));

        for (let adjacent = c + 1; adjacent < row.length; adjacent += 1) {
          const value = clean(row[adjacent]);
          if (isVehicleLabel(value)) break;
          if (accept(value)) return hit(value, table.page, row.join(" | "));
        }

        for (let next = r + 1; next <= Math.min(r + 3, table.rows.length - 1); next += 1) {
          const value = clean(table.rows[next]?.[c] ?? "");
          if (isVehicleLabel(value)) break;
          if (accept(value)) return hit(value, table.page, `${row[c]} | ${value}`);
        }
      }
    }
  }
  return null;
}

function findStructuredPair(tables: StructuredPolicyTable[]): PairHit | null {
  for (const table of tables) {
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r].map(clean);
      for (let c = 0; c < row.length; c += 1) {
        if (!COMBINED_ID_LABEL.test(row[c])) continue;

        const candidates = [
          ...row.slice(c + 1),
          ...table.rows.slice(r + 1, r + 4).map((nextRow) => clean(nextRow?.[c] ?? "")),
        ];
        for (const candidate of candidates) {
          const parsed = parsePair(candidate);
          if (parsed) {
            return { ...parsed, page: table.page, evidence: safe(`${row.join(" | ")} | ${candidate}`) };
          }
        }
      }
    }
  }
  return null;
}

function findRawYear(vehicleText: string): Hit | null {
  const segment = rawValueAfterLabel(vehicleText, /Year\s+of\s+manufacture/i, 120);
  if (!segment) return null;
  const year = segment.value.match(/\b(?:19|20)\d{2}\b/)?.[0];
  if (!year) return null;
  return hit(year, 1, `Raw OCR Year of manufacture | ${segment.value}`);
}

function findRawPair(vehicleText: string): PairHit | null {
  const segment = rawValueAfterLabel(vehicleText, COMBINED_ID_LABEL, 260);
  if (!segment) return null;
  const parsed = parsePair(segment.value);
  if (!parsed) return null;
  return {
    ...parsed,
    page: 1,
    evidence: safe(`Raw OCR Chassis no./Engine no. | ${segment.value}`),
  };
}

function findRawSingleId(vehicleText: string, label: RegExp): Hit | null {
  const segment = rawValueAfterLabel(vehicleText, label, 160);
  if (!segment || segment.value.includes("/")) return null;
  const candidate = compactId(segment.value);
  if (!validId(candidate)) return null;
  return hit(candidate, 1, `Raw OCR identifier | ${segment.value}`);
}

function rawValueAfterLabel(text: string, label: RegExp, maxChars: number): { value: string } | null {
  const match = text.match(label);
  if (!match || match.index == null) return null;
  const start = match.index + match[0].length;
  let after = text.slice(start, start + maxChars).replace(/^\s*[:\-]\s*/, "");
  const stop = after.match(RAW_STOP_LABEL);
  if (stop?.index != null && stop.index > 0) after = after.slice(0, stop.index);
  const value = cleanPreservingSlash(after);
  return value ? { value } : null;
}

function boundedVehicleText(text: string) {
  const start = text.search(/VEHICLE\s+DETAILS/i);
  const source = start >= 0 ? text.slice(start) : text;
  const end = source.search(/INSURED\s+DECLARED\s+VALUE|SCHEDULE\s+OF\s+PREMIUM/i);
  return end > 0 ? source.slice(0, end) : source.slice(0, 7000);
}

function parsePair(value: string): { chassis: string; engine: string } | null {
  const slash = value.indexOf("/");
  if (slash < 0) return null;
  const chassis = compactId(value.slice(0, slash));
  const engine = compactId(value.slice(slash + 1));
  if (!validId(chassis) || !validId(engine) || chassis === engine) return null;
  return { chassis, engine };
}

function hit(value: string, page: number, evidence: string): Hit {
  return { value, page, evidence: safe(evidence) };
}
function has(fields: Fields, key: string) {
  return Boolean(fields.get(key)?.value?.trim());
}
function isSingleId(value: string) {
  if (value.includes("/")) return false;
  return validId(compactId(value));
}
function validId(value: string) {
  return value.length >= 6 && value.length <= 30 && /[A-Z]/.test(value) && /\d/.test(value);
}
function isVehicleLabel(value: string) {
  return /Year|Chassis|Engine|fuel|body|Gross Vehicle|Make\s*\/\s*Model|Registration|Seating|Variant/i.test(value);
}
function compactId(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function clean(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}
function cleanPreservingSlash(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[\t\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}
function safe(value: string) {
  return clean(value).slice(0, 600);
}
function set(fields: Fields, key: string, label: string, value: string, page: number, evidence: string) {
  fields.set(key, { key, label, value, confidence: .999, page, evidence: safe(evidence) });
}
