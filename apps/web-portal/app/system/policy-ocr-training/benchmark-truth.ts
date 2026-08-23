export type BenchmarkFieldKind = "text" | "identifier" | "number" | "boolean" | "date";

export type BenchmarkFieldDefinition = {
  key: string;
  label: string;
  group: "Policy" | "Vehicle" | "Premium";
  kind: BenchmarkFieldKind;
};

export const BENCHMARK_FIELDS: BenchmarkFieldDefinition[] = [
  { key: "insurer_name", label: "Insurer", group: "Policy", kind: "text" },
  { key: "policy_product", label: "Policy type", group: "Policy", kind: "text" },
  { key: "policy_number", label: "Policy number", group: "Policy", kind: "identifier" },
  { key: "policy_start_date", label: "Policy start date", group: "Policy", kind: "date" },
  { key: "policy_end_date", label: "Policy end date", group: "Policy", kind: "date" },
  { key: "vehicle_registration_status", label: "Registration status", group: "Vehicle", kind: "text" },
  { key: "vehicle_registration_number", label: "Registration number", group: "Vehicle", kind: "identifier" },
  { key: "vehicle_class", label: "Vehicle class", group: "Vehicle", kind: "text" },
  { key: "vehicle_make", label: "Make", group: "Vehicle", kind: "text" },
  { key: "vehicle_model", label: "Model / variant", group: "Vehicle", kind: "text" },
  { key: "vehicle_fuel_type", label: "Fuel type", group: "Vehicle", kind: "text" },
  { key: "vehicle_manufacturing_year", label: "Manufacturing year", group: "Vehicle", kind: "number" },
  { key: "vehicle_rto_name", label: "RTO", group: "Vehicle", kind: "text" },
  { key: "vehicle_rto_state", label: "RTO state", group: "Vehicle", kind: "text" },
  { key: "vehicle_capacity", label: "Vehicle capacity", group: "Vehicle", kind: "text" },
  { key: "vehicle_engine_number", label: "Engine number", group: "Vehicle", kind: "identifier" },
  { key: "vehicle_chassis_number", label: "Chassis number", group: "Vehicle", kind: "identifier" },
  { key: "idv", label: "IDV", group: "Premium", kind: "number" },
  { key: "od_premium", label: "OD premium", group: "Premium", kind: "number" },
  { key: "tp_premium", label: "TP premium", group: "Premium", kind: "number" },
  { key: "cpa_opted", label: "Owner-driver CPA opted", group: "Premium", kind: "boolean" },
  { key: "cpa_premium", label: "Owner-driver CPA premium", group: "Premium", kind: "number" },
  { key: "printed_net_premium", label: "Printed net premium", group: "Premium", kind: "number" },
  { key: "printed_gst", label: "Printed GST / tax", group: "Premium", kind: "number" },
  { key: "printed_gross_premium", label: "Printed gross premium", group: "Premium", kind: "number" },
];

export type BenchmarkTruthClassification =
  | "MATCH_ALL"
  | "ROUNDING_EQUIVALENT"
  | "REFERENCE_CONFLICT"
  | "OCR_MISSING"
  | "SEMANTIC_ERROR"
  | "INSUFFICIENT_EVIDENCE";

export type BenchmarkTruthResult = {
  baseline: string | null;
  reference: string | null;
  truth: string | null;
  classification: BenchmarkTruthClassification;
  correct: boolean;
  autoFilled: boolean;
};

export type BenchmarkTruthMetrics = {
  expected: number;
  autoFilled: number;
  correct: number;
  precision: number | null;
  coverage: number | null;
  perfect: boolean;
  referenceConflicts: number;
  ocrMissing: number;
  semanticErrors: number;
};

type Proposal = { fields?: Record<string, { value?: unknown } | unknown> } | null;

export function proposalFieldValue(proposal: Proposal, key: string): string | null {
  const entry = proposal?.fields?.[key];
  if (entry == null) return null;
  if (typeof entry === "object" && entry && "value" in entry) return cleanValue((entry as { value?: unknown }).value);
  return cleanValue(entry);
}

export function buildReferenceFields(label: Record<string, unknown>): Record<string, string> {
  const vehicle = isRecord(label.section_02_reference) ? label.section_02_reference : {};
  const raw: Record<string, unknown> = {
    insurer_name: label.insurer_name,
    policy_product: label.policy_product,
    policy_number: label.policy_number,
    policy_start_date: label.valid_from,
    policy_end_date: label.valid_upto,
    idv: label.idv,
    od_premium: label.od_premium,
    tp_premium: label.tp_premium,
    cpa_opted: label.cpa_opted,
    cpa_premium: label.cpa_premium,
    printed_net_premium: label.printed_net_premium,
    printed_gst: label.printed_gst,
    printed_gross_premium: label.printed_gross_premium,
    ...vehicle,
  };
  return Object.fromEntries(
    Object.entries(raw).flatMap(([key, value]) => {
      const cleaned = cleanValue(value);
      return cleaned == null ? [] : [[key, cleaned]];
    }),
  );
}

export function compareTruth(
  proposal: Proposal,
  reference: Record<string, string>,
  truth: Record<string, string>,
): { fields: Record<string, BenchmarkTruthResult>; metrics: BenchmarkTruthMetrics } {
  const results: Record<string, BenchmarkTruthResult> = {};
  let expected = 0;
  let autoFilled = 0;
  let correct = 0;
  let referenceConflicts = 0;
  let ocrMissing = 0;
  let semanticErrors = 0;

  for (const field of BENCHMARK_FIELDS) {
    const truthValue = cleanValue(truth[field.key]);
    if (truthValue == null) continue;
    expected += 1;

    const baseline = proposalFieldValue(proposal, field.key);
    const referenceValue = cleanValue(reference[field.key]);
    const baselinePresent = baseline != null;
    if (baselinePresent) autoFilled += 1;

    const baselineMatch = baselinePresent ? compareValues(field.kind, baseline, truthValue) : "different";
    const referenceMatch = referenceValue != null ? compareValues(field.kind, referenceValue, truthValue) : "different";

    let classification: BenchmarkTruthClassification;
    let fieldCorrect = false;
    if (!baselinePresent) {
      classification = "OCR_MISSING";
      ocrMissing += 1;
    } else if (baselineMatch === "exact") {
      if (referenceValue != null && referenceMatch === "different") {
        classification = "REFERENCE_CONFLICT";
        referenceConflicts += 1;
      } else {
        classification = "MATCH_ALL";
      }
      fieldCorrect = true;
    } else if (baselineMatch === "rounding") {
      classification = "ROUNDING_EQUIVALENT";
      fieldCorrect = true;
    } else {
      classification = "SEMANTIC_ERROR";
      semanticErrors += 1;
    }

    if (fieldCorrect) correct += 1;
    results[field.key] = {
      baseline,
      reference: referenceValue,
      truth: truthValue,
      classification,
      correct: fieldCorrect,
      autoFilled: baselinePresent,
    };
  }

  return {
    fields: results,
    metrics: {
      expected,
      autoFilled,
      correct,
      precision: autoFilled ? correct / autoFilled : null,
      coverage: expected ? autoFilled / expected : null,
      perfect: expected > 0 && correct === expected,
      referenceConflicts,
      ocrMissing,
      semanticErrors,
    },
  };
}

export function referenceAlignment(
  proposal: Proposal,
  reference: Record<string, string>,
): { compared: number; matched: number; missing: number; mismatched: number } {
  let compared = 0;
  let matched = 0;
  let missing = 0;
  let mismatched = 0;
  for (const field of BENCHMARK_FIELDS) {
    const ref = cleanValue(reference[field.key]);
    if (ref == null) continue;
    compared += 1;
    const baseline = proposalFieldValue(proposal, field.key);
    if (baseline == null) {
      missing += 1;
      continue;
    }
    if (compareValues(field.kind, baseline, ref) !== "different") matched += 1;
    else mismatched += 1;
  }
  return { compared, matched, missing, mismatched };
}

function compareValues(kind: BenchmarkFieldKind, left: string, right: string): "exact" | "rounding" | "different" {
  if (kind === "number") {
    const a = numeric(left);
    const b = numeric(right);
    if (a == null || b == null) return normalizeText(left) === normalizeText(right) ? "exact" : "different";
    if (Math.abs(a - b) <= 0.01) return "exact";
    if (Math.round(a) === Math.round(b)) return "rounding";
    return "different";
  }
  if (kind === "boolean") return normalizeBoolean(left) === normalizeBoolean(right) ? "exact" : "different";
  if (kind === "identifier") return normalizeIdentifier(left) === normalizeIdentifier(right) ? "exact" : "different";
  if (kind === "date") return normalizeDate(left) === normalizeDate(right) ? "exact" : "different";
  return normalizeText(left) === normalizeText(right) ? "exact" : "different";
}

function cleanValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  const text = String(value).trim();
  return text ? text : null;
}

function numeric(value: string): number | null {
  const cleaned = value.replace(/[,₹\s]/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBoolean(value: string): string {
  const normalized = normalizeText(value);
  if (["yes", "true", "1", "opted"].includes(normalized)) return "yes";
  if (["no", "false", "0", "not opted", "removed"].includes(normalized)) return "no";
  return normalized;
}

function normalizeIdentifier(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeDate(value: string): string {
  const text = value.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  if (iso) return iso;
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? normalizeText(text) : parsed.toISOString().slice(0, 10);
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
