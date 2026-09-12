import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Fields = Map<string, ParsedPolicyField>;
type MakeModelHit = { make: string; model: string; page: number; evidence: string };

const FAMILY = /GCV\s+PUBLIC\s+CARRIER\s+OTHER\s+THAN\s+3\s+WHEELER\s+(?:[-–—]\s*)?PACKAGE(?:\s+POLICY)?/i;
const UNITED_INDIA = /UNITED\s+INDIA\s+INSURANCE\s+COMPANY/i;
const MAKE_MODEL_LABEL = /Vehicle\s+Make\s*&\s*Model/i;
const NEIGHBOR_LABEL = /(?:RTA\s+Name|Type\s+Of\s+Body|Fuel\s+Type|Registration\s+Date|Cubic\s+Capacity|Seating\s+Capacity|Engine\s+Number|Year\s+Of\s+Manufacture|Gross\s+Vehicle\s+Weight|Chassis\s+Number)/i;

/**
 * Round 12 is intentionally limited to the remaining live miss on the United
 * India GCV Public Carrier Other Than 3 Wheeler Package schedule: Make/Model.
 * It runs after Round 11 and does not touch any financial or identifier field.
 */
export function refineProductionRound12UiicGcvMakeModel(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (parsed.parserId !== "united_india_motor_v1") return parsed;

  const firstTwo = pages.slice(0, 2).join("\n");
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 140).join(" ");
  if (!UNITED_INDIA.test(header) || !FAMILY.test(firstTwo)) return parsed;

  const existingMake = fieldValue(parsed.fields, "vehicle_make");
  const existingModel = fieldValue(parsed.fields, "vehicle_model");
  if (goodPart(existingMake, "make") && goodPart(existingModel, "model")) return parsed;

  const page2 = pages[1] ?? "";
  const vehicle = bounded(page2, /VEHICLE\s+DETAILS/i, /INSURED\s+DECLARED\s+VALUE/i) ?? page2;
  const hit = findStructuredMakeModel(tables) ?? findFlattenedMakeModel(vehicle);
  if (!hit) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  set(fields, "vehicle_make", "Vehicle make", hit.make, hit.page, hit.evidence);
  set(fields, "vehicle_model", "Vehicle model", hit.model, hit.page, hit.evidence);

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+prod-r12-uiic_gcv_make_model`,
    fields: [...fields.values()],
    warnings: [
      ...parsed.warnings.filter((warning) => !/round 12 uiic gcv/i.test(warning)),
      "Production round 12 UIIC GCV Make/Model refinement applied.",
    ],
  };
}

function findStructuredMakeModel(tables: StructuredPolicyTable[]): MakeModelHit | null {
  for (const table of tables) {
    if (table.page > 2) continue;
    const labelPositions: Array<{ row: number; col: number }> = [];
    let vehicleTableEvidence = false;

    for (let r = 0; r < table.rows.length; r += 1) {
      for (let c = 0; c < table.rows[r].length; c += 1) {
        const cell = clean(table.rows[r][c] ?? "");
        if (MAKE_MODEL_LABEL.test(cell)) labelPositions.push({ row: r, col: c });
        if (/Chassis\s+Number|Engine\s+Number|RTA\s+Name|Gross\s+Vehicle\s+Weight/i.test(cell)) vehicleTableEvidence = true;
      }
    }
    if (!labelPositions.length || !vehicleTableEvidence) continue;

    for (const pos of labelPositions) {
      // 1) Same cell after the label.
      const same = table.rows[pos.row]?.[pos.col] ?? "";
      const sameHit = candidateFromText(same.replace(MAKE_MODEL_LABEL, " "));
      if (sameHit) return { ...sameHit, page: table.page, evidence: "Round 12 UIIC structured Make/Model same-cell association" };

      // 2) Exact same column in the next rows. This is the normal Google table shape.
      for (let r = pos.row + 1; r <= Math.min(pos.row + 3, table.rows.length - 1); r += 1) {
        const cell = table.rows[r]?.[pos.col] ?? "";
        const hit = candidateFromText(cell);
        if (hit) return { ...hit, page: table.page, evidence: "Round 12 UIIC structured Make/Model column association" };
      }

      // 3) Google can merge/split cells and shift the value by one column. Search
      // the same/next rows only, preferring cells nearest the Make/Model header.
      for (let r = pos.row; r <= Math.min(pos.row + 3, table.rows.length - 1); r += 1) {
        const candidates = table.rows[r]
          .map((cell, col) => ({ cell, col, distance: Math.abs(col - pos.col) }))
          .sort((a, b) => a.distance - b.distance);
        for (const candidate of candidates) {
          if (candidate.distance > 2) continue;
          const hit = candidateFromText(candidate.cell);
          if (hit) return { ...hit, page: table.page, evidence: "Round 12 UIIC structured Make/Model shifted-cell association" };
        }
      }
    }

    // 4) Last structured fallback: only inside a table that contains the exact
    // label and independent vehicle-detail anchors. This catches header rows
    // whose merged-cell geometry no longer preserves column indexes.
    for (const row of table.rows) {
      for (const cell of row) {
        const hit = candidateFromText(cell);
        if (hit) return { ...hit, page: table.page, evidence: "Round 12 UIIC structured Make/Model table-local recovery" };
      }
    }
  }
  return null;
}

function findFlattenedMakeModel(vehicle: string): MakeModelHit | null {
  const lines = vehicle.split(/\r?\n/).map(clean).filter(Boolean);
  const labelIndex = lines.findIndex((line) => MAKE_MODEL_LABEL.test(line));
  if (labelIndex >= 0) {
    const same = candidateFromText(lines[labelIndex].replace(MAKE_MODEL_LABEL, " "));
    if (same) return { ...same, page: 2, evidence: "Round 12 UIIC label-bounded Make/Model same-line recovery" };

    // Flattened table OCR often emits several headings first and their values
    // afterwards. Search a bounded window rather than assuming the next token.
    for (let i = labelIndex + 1; i <= Math.min(labelIndex + 12, lines.length - 1); i += 1) {
      if (/INSURED\s+DECLARED\s+VALUE|SCHEDULE\s+OF\s+PREMIUM/i.test(lines[i])) break;
      const hit = candidateFromText(lines[i]);
      if (hit) return { ...hit, page: 2, evidence: "Round 12 UIIC bounded flattened Make/Model recovery" };
    }
  }

  // Some OCR exports concatenate the whole vehicle table into one line. Search
  // only the VEHICLE DETAILS block and require a strong make/model shape.
  const joined = clean(vehicle.replace(/\r?\n/g, " "));
  const matches = joined.match(/[A-Z][A-Z0-9 .&()_-]{2,80}\s*\/\s*[A-Z0-9][A-Z0-9 .&()_/-]{2,90}/gi) ?? [];
  for (const match of matches) {
    const hit = candidateFromText(match);
    if (hit) return { ...hit, page: 2, evidence: "Round 12 UIIC bounded vehicle-block Make/Model recovery" };
  }
  return null;
}

function candidateFromText(value: string): { make: string; model: string } | null {
  let normalized = clean(value)
    .replace(MAKE_MODEL_LABEL, " ")
    .replace(/\bnull\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || NEIGHBOR_LABEL.test(normalized)) return null;

  const slash = normalized.indexOf("/");
  if (slash < 2) return null;
  let make = normalized.slice(0, slash).trim();
  let model = normalized.slice(slash + 1).trim();

  make = trimNeighborNoise(make);
  model = trimNeighborNoise(model);
  if (!goodPart(make, "make") || !goodPart(model, "model")) return null;
  if (/\b(?:DIESEL|PETROL|CNG|LPG|ELECTRIC|EV)\b/i.test(model)) return null;
  if (!/[0-9]/.test(model) && !/[A-Z]{2,}/i.test(model)) return null;
  return { make, model };
}

function trimNeighborNoise(value: string) {
  return clean(value)
    .replace(/^.*?\b(?:RTA\s+Name|Gross\s+Vehicle\s+Weight|Chassis\s+Number)\b\s*/i, "")
    .replace(/\s+\b(?:Type\s+Of\s+Body|Fuel\s+Type|Registration\s+Date|Cubic\s+Capacity|Seating\s+Capacity|Engine\s+Number|Year\s+Of\s+Manufacture)\b.*$/i, "")
    .trim();
}

function goodPart(value: string, kind: "make" | "model") {
  if (!value || value.length < 2 || value.length > 100) return false;
  if (!/[A-Z]/i.test(value)) return false;
  if (/^(?:MODEL|MAKE|NO|NA|N\/A|-|TYPE OF BODY|FUEL TYPE|VEHICLE DETAILS)$/i.test(value)) return false;
  if (/RTA\s+NAME|ENGINE\s+NUMBER|CHASSIS\s+NUMBER|REGISTRATION\s+DATE|YEAR\s+OF\s+MANUFACTURE|GROSS\s+VEHICLE\s+WEIGHT/i.test(value)) return false;
  if (kind === "make" && /^(?:DIESEL|PETROL|CNG|LPG|ELECTRIC|EV)$/i.test(value)) return false;
  return true;
}

function fieldValue(fields: ParsedPolicyField[], key: string) {
  return fields.find((field) => field.key === key)?.value?.trim() ?? "";
}

function bounded(text: string, start: RegExp, end: RegExp): string | null {
  const startIndex = text.search(start);
  if (startIndex < 0) return null;
  const rest = text.slice(startIndex);
  const endIndex = rest.search(end);
  return endIndex > 0 ? rest.slice(0, endIndex) : rest.slice(0, 5000);
}

function clean(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function set(fields: Fields, key: string, label: string, value: string, page: number, evidence: string) {
  fields.set(key, { key, label, value, confidence: .999, page, evidence });
}
