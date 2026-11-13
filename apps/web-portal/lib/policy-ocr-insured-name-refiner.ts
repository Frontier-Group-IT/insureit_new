import type { ParsedPolicyResult } from "./policy-ocr-parsers";

const SUPPORTED = new Set([
  "iffco_tokio_commercial_motor_v2",
  "universal_sompo_motor_v1",
]);

// Strictly anchored to the current policy's insured/holder label. Do not
// infer a person's identity from owner-driver, beneficiary, or vehicle text.
const LABEL = /^(?:name\s+of\s+(?:the\s+)?insured|insured(?:'s)?\s+name|insured\s+name\s*(?:and|&)\s*address|name\s*(?:and|&)\s*address\s+of\s+(?:the\s+)?insured|policy\s*holder\s*name|proposer\s+name)\s*[:\-]?\s*/i;
const STOP = /\b(?:address|mobile|phone|contact|email|policy\s+(?:no\.?|number|period)|insured\s+motor\s+vehicle|vehicle\s+(?:no\.?|number|details)|gstin|pan\s*(?:no\.?)?|date\s+of\s+birth|occupation|gender|relationship)\b/i;
const PLACEHOLDER = /^(?:na|n\/a|nil|none|not\s+available|not\s+provided|customer|insured|policy\s+holder|proposer|name|unknown)$/i;

function candidateName(raw: string): string | null {
  const name = raw
    .split(/[|;\t]/, 1)[0]
    .replace(/\s{2,}(?=(?:address|mobile|phone|policy|email|gstin|pan)\b).*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:.,\-]+|[\s:.,\-]+$/g, "")
    .trim();
  if (name.length < 4 || name.length > 90 || PLACEHOLDER.test(name) || STOP.test(name)) return null;
  if (/\d|[@<>={}]/.test(name) || !/^[\p{L}][\p{L} .,'&()\-/]*$/u.test(name)) return null;
  const words = name.replace(/^(?:(?:mr|mrs|ms|m\/s|dr)\.?\s+)/i, "").split(/\s+/);
  if (!words.length || words.some((word) => word.length > 30)) return null;
  return name;
}

function findInsuredName(pages: string[]) {
  for (const [pageIndex, page] of pages.slice(0, 3).entries()) {
    const lines = page.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const label = line.match(LABEL);
      if (!label) continue;
      const remainder = line.slice(label[0].length).trim();
      // Never interpret a paragraph, vehicle heading, or address as a name.
      const inline = candidateName(remainder);
      if (inline) return { value: inline, page: pageIndex + 1, evidence: label[0].trim() };
      if (!remainder && index + 1 < lines.length) {
        const next = candidateName(lines[index + 1]);
        if (next && !LABEL.test(lines[index + 1])) return { value: next, page: pageIndex + 1, evidence: label[0].trim() };
      }
    }
  }
  return null;
}

/** Adds a grounded insured_name only when the insurer policy prints an explicit label. */
export function refinePolicyIntakeInsuredName(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  if (!SUPPORTED.has(parsed.parserId) || parsed.fields.some((field) => field.key === "insured_name" && field.value.trim())) return parsed;
  const match = findInsuredName(pages);
  if (!match) return parsed;
  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+insured-name-v1`,
    fields: [...parsed.fields, {
      key: "insured_name", label: "Name of insured", value: match.value,
      confidence: 0.94, page: match.page, evidence: match.evidence,
    }],
  };
}
