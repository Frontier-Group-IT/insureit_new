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

const FIELD_KEY_SET = new Set<string>(TRAINING_FIELD_KEYS);
const SAFE_EVIDENCE_LABELS: Array<[RegExp, string]> = [
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
    schema_version: "policy_ocr_training_candidate_v1",
    parser_id: args.parserId,
    parser_version: args.parserVersion,
    ground_truth: {
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
