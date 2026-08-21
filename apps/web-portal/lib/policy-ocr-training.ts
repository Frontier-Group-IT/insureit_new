type OcrSuccess = {
  ok: true;
  fields: Array<{
    key: string;
    label: string;
    value: string;
    confidence: number | null;
    page: number | null;
    evidence: string;
  }>;
  warnings: string[];
};

export const TRAINING_FIELD_KEYS = [
  "vehicle_registration_status",
  "vehicle_registration_number",
  "vehicle_class",
  "vehicle_make",
  "vehicle_model",
  "vehicle_fuel_type",
  "vehicle_manufacturing_year",
  "vehicle_capacity",
  "vehicle_chassis_number",
  "vehicle_engine_number",
  "vehicle_rto_name",
  "vehicle_rto_state",
  "insurer_name",
  "policy_product",
  "policy_number",
  "policy_start_date",
  "policy_end_date",
  "idv",
  "od_premium",
  "tp_premium",
  "cpa_opted",
  "cpa_premium",
  "total_premium",
  "tax_amount",
  "gross_premium",
] as const;

export type TrainingFieldKey = (typeof TRAINING_FIELD_KEYS)[number];

export type TrainingProposalField = {
  value: string;
  confidence: number | null;
  page: number | null;
  evidence: string;
};

export type TrainingProposal = {
  fields: Partial<Record<TrainingFieldKey, TrainingProposalField>>;
  warnings: string[];
};

export type TrainingDatabaseReference = {
  vehicle_registration_status: string | null;
  vehicle_registration_number: string | null;
  vehicle_class: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_fuel_type: string | null;
  vehicle_manufacturing_year: number | null;
  vehicle_capacity: string | number | null;
  vehicle_chassis_number: string | null;
  vehicle_engine_number: string | null;
  vehicle_rto_name: string | null;
  vehicle_rto_state: string | null;
  insurer_name: string | null;
  policy_product: string | null;
  policy_number: string | null;
  valid_from: string | null;
  valid_upto: string | null;
  idv: number | null;
  od_premium: number | null;
  tp_premium: number | null;
  cpa_opted: boolean | null;
  cpa_premium: number | null;
  printed_net_premium: number | null;
  printed_gst: number | null;
  printed_gross_premium: number | null;
};

export type TrainingComparisonKey = keyof TrainingDatabaseReference;
export type TrainingComparisonStatus = "match" | "mismatch" | "ocr_missing" | "reference_missing";

export type TrainingComparisonSummary = {
  exactMatch: boolean;
  comparableFields: number;
  matchedFields: number;
  mismatchedFields: number;
  missingOcrFields: number;
  missingReferenceFields: number;
  fields: Record<TrainingComparisonKey, TrainingComparisonStatus>;
};

const COMPARISON_PROPOSAL_KEYS: Record<TrainingComparisonKey, TrainingFieldKey> = {
  vehicle_registration_status: "vehicle_registration_status",
  vehicle_registration_number: "vehicle_registration_number",
  vehicle_class: "vehicle_class",
  vehicle_make: "vehicle_make",
  vehicle_model: "vehicle_model",
  vehicle_fuel_type: "vehicle_fuel_type",
  vehicle_manufacturing_year: "vehicle_manufacturing_year",
  vehicle_capacity: "vehicle_capacity",
  vehicle_chassis_number: "vehicle_chassis_number",
  vehicle_engine_number: "vehicle_engine_number",
  vehicle_rto_name: "vehicle_rto_name",
  vehicle_rto_state: "vehicle_rto_state",
  insurer_name: "insurer_name",
  policy_product: "policy_product",
  policy_number: "policy_number",
  valid_from: "policy_start_date",
  valid_upto: "policy_end_date",
  idv: "idv",
  od_premium: "od_premium",
  tp_premium: "tp_premium",
  cpa_opted: "cpa_opted",
  cpa_premium: "cpa_premium",
  printed_net_premium: "total_premium",
  printed_gst: "tax_amount",
  printed_gross_premium: "gross_premium",
};

const FIELD_KEY_SET = new Set<string>(TRAINING_FIELD_KEYS);
const SAFE_EVIDENCE_LABELS: Array<[RegExp, string]> = [
  [/\bregistration status\b/i, "Vehicle Registration Status"],
  [/\bregistration(?: number| no)?\b|\bregn\.? no\b/i, "Vehicle Registration Number"],
  [/\bvehicle class\b|\bclass of vehicle\b/i, "Vehicle Class"],
  [/\bmake\b/i, "Vehicle Make"],
  [/\bmodel\b/i, "Vehicle Model"],
  [/\bfuel\b/i, "Fuel Type"],
  [/\bmanufactur(?:ing|e) year\b|\byear of manufacture\b/i, "Manufacturing Year"],
  [/\bcapacity\b|\bcc\b|\bgvw\b|\bseating\b/i, "Vehicle Capacity"],
  [/\bchassis\b/i, "Chassis Number"],
  [/\bengine\b/i, "Engine Number"],
  [/\brto\b/i, "RTO"],
  [/\btotal od premium\b/i, "Total OD Premium"],
  [/\btotal tp premium\b/i, "Total TP Premium"],
  [/\bnet premium\b/i, "Net Premium"],
  [/\btotal payable\b|\bgross premium\b/i, "Gross / Total Payable"],
  [/\bcompulsory pa\b|\bowner driver\b|\bcpa\b/i, "Owner-driver CPA"],
  [/\bidv\b|\binsured declared value\b|\btotal value\b/i, "IDV / Sum Insured"],
  [/\bperiod of cover\b|\bpolicy period\b|\bvalid from\b/i, "Policy Period"],
  [/\bpolicy number\b|\bpolicy no\b/i, "Policy Number"],
  [/\binsurance company\b|\binsurer\b/i, "Insurer Header"],
  [/\bpackage\b|\bbundled\b|\bstandalone od\b|\bthird party\b/i, "Policy Product"],
  [/\bgst\b|\btax\b/i, "GST / Tax"],
];

export function buildTrainingProposal(result: OcrSuccess): TrainingProposal {
  const fields: TrainingProposal["fields"] = {};
  for (const field of result.fields) {
    if (!FIELD_KEY_SET.has(field.key)) continue;
    fields[field.key as TrainingFieldKey] = {
      value: field.value.slice(0, 240),
      confidence: normalizeConfidence(field.confidence),
      page: Number.isInteger(field.page) && Number(field.page) > 0 ? Number(field.page) : null,
      evidence: summarizeEvidence(field.evidence, field.label, field.page),
    };
  }

  return {
    fields,
    warnings: result.warnings.slice(0, 20).map(sanitizeWarning).filter(Boolean),
  };
}

export function compareTrainingProposalToReference(
  proposal: TrainingProposal,
  reference: TrainingDatabaseReference,
): TrainingComparisonSummary {
  const fields = {} as Record<TrainingComparisonKey, TrainingComparisonStatus>;
  let comparableFields = 0;
  let matchedFields = 0;
  let mismatchedFields = 0;
  let missingOcrFields = 0;
  let missingReferenceFields = 0;

  for (const key of Object.keys(COMPARISON_PROPOSAL_KEYS) as TrainingComparisonKey[]) {
    const referenceValue = reference[key];
    const proposalValue = proposal.fields[COMPARISON_PROPOSAL_KEYS[key]]?.value ?? null;
    const status = compareTrainingValue(key, referenceValue, proposalValue);
    fields[key] = status;
    if (status === "reference_missing") missingReferenceFields += 1;
    else {
      comparableFields += 1;
      if (status === "match") matchedFields += 1;
      else if (status === "mismatch") mismatchedFields += 1;
      else missingOcrFields += 1;
    }
  }

  return {
    exactMatch: comparableFields > 0 && mismatchedFields === 0 && missingOcrFields === 0,
    comparableFields,
    matchedFields,
    mismatchedFields,
    missingOcrFields,
    missingReferenceFields,
    fields,
  };
}

export function compareTrainingValue(
  key: TrainingComparisonKey,
  referenceValue: string | number | boolean | null,
  proposalValue: string | null,
): TrainingComparisonStatus {
  if (referenceValue === null || referenceValue === "") return "reference_missing";
  if (proposalValue === null || !proposalValue.trim()) return "ocr_missing";

  if (typeof referenceValue === "number") {
    const parsed = Number(proposalValue.replaceAll(",", "").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) && Math.abs(referenceValue - parsed) <= 2 ? "match" : "mismatch";
  }
  if (typeof referenceValue === "boolean") {
    const normalized = proposalValue.trim().toLowerCase();
    const parsed = ["yes", "true", "1", "opted"].includes(normalized)
      ? true
      : ["no", "false", "0", "not opted"].includes(normalized)
        ? false
        : null;
    return parsed === referenceValue ? "match" : "mismatch";
  }

  if (key === "valid_from" || key === "valid_upto") {
    return normalizeComparisonDate(referenceValue) === normalizeComparisonDate(proposalValue) ? "match" : "mismatch";
  }
  if (key === "policy_number") {
    return normalizePolicyNumber(referenceValue) === normalizePolicyNumber(proposalValue) ? "match" : "mismatch";
  }
  if (key === "policy_product") {
    return normalizePolicyProduct(referenceValue) === normalizePolicyProduct(proposalValue) ? "match" : "mismatch";
  }
  if (key === "vehicle_registration_number") {
    return normalizeRegistrationIdentifier(referenceValue) === normalizeRegistrationIdentifier(proposalValue) ? "match" : "mismatch";
  }
  if (key === "vehicle_chassis_number" || key === "vehicle_engine_number") {
    return normalizeVehicleIdentifier(referenceValue) === normalizeVehicleIdentifier(proposalValue) ? "match" : "mismatch";
  }
  if (key === "vehicle_registration_status") {
    return normalizeRegistrationStatus(referenceValue) === normalizeRegistrationStatus(proposalValue) ? "match" : "mismatch";
  }
  if (key === "vehicle_class") {
    return normalizeVehicleClass(referenceValue) === normalizeVehicleClass(proposalValue) ? "match" : "mismatch";
  }
  if (key === "vehicle_capacity") {
    const referenceCapacity = parseCapacity(referenceValue);
    const proposalCapacity = parseCapacity(proposalValue);
    return referenceCapacity !== null && proposalCapacity !== null
      ? Math.abs(referenceCapacity - proposalCapacity) <= 2 ? "match" : "mismatch"
      : normalizeComparisonText(referenceValue) === normalizeComparisonText(proposalValue) ? "match" : "mismatch";
  }
  if (key === "vehicle_rto_name") {
    return normalizeRto(referenceValue) === normalizeRto(proposalValue) ? "match" : "mismatch";
  }
  if (key === "vehicle_rto_state") {
    return normalizeRtoState(referenceValue) === normalizeRtoState(proposalValue) ? "match" : "mismatch";
  }
  return normalizeComparisonText(referenceValue) === normalizeComparisonText(proposalValue) ? "match" : "mismatch";
}

export function parseReviewerDate(value: string | null | undefined) {
  const match = value?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() !== Number(month) - 1
    || date.getUTCDate() !== Number(day)
  ) return null;
  return `${year}-${month}-${day}`;
}

export function formatReviewerDate(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

export function sanitizeEvidenceNote(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[redacted]")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Z]{2,}\b/gi, "[redacted]")
    .replace(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, "[redacted]")
    .replace(/\b[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}\b/gi, "[redacted]")
    .replace(/\b[A-Z0-9]{16,}\b/gi, "[redacted]")
    .slice(0, 1000)
    .trim();
}

export function createSanitizedTrainingCandidate(args: {
  labelId: string;
  parserId: string | null;
  parserVersion: string | null;
  values: {
    vehicle_registration_status: string | null;
    vehicle_registration_number: string | null;
    vehicle_class: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_fuel_type: string | null;
    vehicle_manufacturing_year: number | null;
    vehicle_capacity: string | number | null;
    vehicle_chassis_number: string | null;
    vehicle_engine_number: string | null;
    vehicle_rto_name: string | null;
    vehicle_rto_state: string | null;
    insurer_name: string | null;
    policy_product: string | null;
    valid_from: string | null;
    valid_upto: string | null;
    idv: number | null;
    od_premium: number | null;
    tp_premium: number | null;
    cpa_opted: boolean | null;
    cpa_premium: number | null;
    printed_net_premium: number | null;
    printed_gst: number | null;
    printed_gross_premium: number | null;
  };
  proposal: TrainingProposal | null;
}) {
  const syntheticId = args.labelId.replaceAll("-", "").slice(0, 12).toUpperCase().padEnd(12, "0");
  return {
    schema_version: "policy_ocr_training_candidate_v2",
    parser_id: args.parserId,
    parser_version: args.parserVersion,
    ground_truth: {
      section_02: {
        vehicle_registration_status: args.values.vehicle_registration_status,
        vehicle_registration_number: args.values.vehicle_registration_number ? `SYNREG${syntheticId}` : null,
        vehicle_class: args.values.vehicle_class,
        vehicle_make: args.values.vehicle_make,
        vehicle_model: args.values.vehicle_model,
        vehicle_fuel_type: args.values.vehicle_fuel_type,
        vehicle_manufacturing_year: args.values.vehicle_manufacturing_year,
        vehicle_capacity: args.values.vehicle_capacity,
        vehicle_chassis_number: args.values.vehicle_chassis_number ? `SYNCHASSIS${syntheticId}` : null,
        vehicle_engine_number: args.values.vehicle_engine_number ? `SYNENGINE${syntheticId}` : null,
        vehicle_rto_name: args.values.vehicle_rto_name,
        vehicle_rto_state: args.values.vehicle_rto_state,
      },
      section_03: {
        insurer_name: args.values.insurer_name,
        policy_product: args.values.policy_product,
        policy_number: `SYN-${syntheticId}`,
        valid_from: args.values.valid_from,
        valid_upto: args.values.valid_upto,
        idv: args.values.idv,
        od_premium: args.values.od_premium,
        tp_premium: args.values.tp_premium,
        cpa_opted: args.values.cpa_opted,
        cpa_premium: args.values.cpa_premium,
        printed_net_premium: args.values.printed_net_premium,
        printed_gst: args.values.printed_gst,
        printed_gross_premium: args.values.printed_gross_premium,
      },
    },
    evidence_labels: Object.fromEntries(
      Object.entries(args.proposal?.fields ?? {}).map(([key, field]) => [key, field?.evidence ?? "Parser evidence"]),
    ),
  };
}

function summarizeEvidence(evidence: string, label: string, page: number | null) {
  const source = `${label} ${evidence}`;
  const matched = SAFE_EVIDENCE_LABELS.find(([pattern]) => pattern.test(source));
  const safeLabel = matched?.[1] ?? (label.replace(/[^\w /&()-]/g, "").slice(0, 80) || "Parser evidence");
  return page && page > 0 ? `${safeLabel} · Page ${page}` : safeLabel;
}

function sanitizeWarning(value: string) {
  return sanitizeEvidenceNote(value).replace(/\s+/g, " ").slice(0, 240);
}

function normalizeConfidence(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function normalizeComparisonDate(value: string) {
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const display = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return display ? `${display[3]}-${display[2]}-${display[1]}` : value.trim();
}

function normalizePolicyNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizePolicyProduct(value: string) {
  const normalized = normalizeComparisonText(value);
  if (/\bsaod\b|standalone own damage/.test(normalized)) return "saod";
  if (/\bbundled\b/.test(normalized)) return "bundled";
  if (/\bpackage\b|comprehensive/.test(normalized)) return "package";
  if (/third party|\btp\b|liability only/.test(normalized)) return "third_party";
  return normalized;
}

function normalizeComparisonText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVehicleIdentifier(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeRegistrationIdentifier(value: string) {
  return normalizeVehicleIdentifier(value).replace(/^([A-Z]{2})0([1-9])/, "$1$2");
}

function normalizeRegistrationStatus(value: string) {
  const normalized = normalizeComparisonText(value);
  return /pending|unregistered|new vehicle/.test(normalized) ? "registration_pending" : "registered";
}

function normalizeVehicleClass(value: string) {
  const normalized = normalizeComparisonText(value);
  if (/\bgcv\b|goods carrying|goods carrier/.test(normalized)) return "gcv";
  if (/\bpcv\b|passenger carrying|passenger vehicle/.test(normalized)) return "pcv";
  if (/\bpcp\b|private car/.test(normalized)) return "pcp";
  if (/\btwp\b|two wheeler/.test(normalized)) return "twp";
  if (/\bcpm\b|contractors? plant|mobile plant/.test(normalized)) return "cpm";
  return normalized;
}

function parseCapacity(value: string) {
  const number = value.replaceAll(",", "").match(/\d+(?:\.\d+)?/);
  return number ? Number(number[0]) : null;
}

function normalizeRto(value: string) {
  const normalized = normalizeComparisonText(value);
  if (/\bjabalpur\b|\bmp\s*20\b/.test(normalized)) return "mp20";
  if (/\bmandla\b|\bmp\s*51\b/.test(normalized)) return "mp51";
  if (/\bdelhi\b|\bdl\s*0?8\b/.test(normalized)) return "dl8";
  if (/\bballabgarh\b|\bhr\s*29\b/.test(normalized)) return "hr29";
  return normalized.replace(/\s+/g, "");
}

function normalizeRtoState(value: string) {
  const normalized = normalizeComparisonText(value);
  if (/madhya pradesh|\bmp\b/.test(normalized)) return "madhya_pradesh";
  if (/delhi/.test(normalized)) return "delhi";
  if (/haryana/.test(normalized)) return "haryana";
  return normalized;
}
