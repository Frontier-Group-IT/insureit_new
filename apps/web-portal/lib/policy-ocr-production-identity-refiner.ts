import type { ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const SUPPORTED_ROUND = /\+prod-r1-(?:digit_misd|iffco_misd|magma_pcp_package|national_twp_package)$/;

export function refineProductionPolicyIdentity(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  if (!SUPPORTED_ROUND.test(parsed.parserVersion)) return parsed;

  const fields = [...parsed.fields];
  const has = (key: string) => fields.some((field) => field.key === key && field.value.trim());
  const boundedPages = pages.slice(0, 3);

  if (!has("policy_number")) {
    const policy = findCurrentPolicyNumber(boundedPages);
    if (policy) fields.push({
      key: "policy_number",
      label: "Policy number",
      value: policy.value,
      confidence: .97,
      page: policy.page,
      evidence: policy.evidence,
    });
  }

  if (!has("policy_start_date") || !has("policy_end_date")) {
    const validity = findCurrentValidity(boundedPages);
    if (validity) {
      if (!has("policy_start_date")) fields.push({
        key: "policy_start_date",
        label: "Policy start date",
        value: validity.start,
        confidence: .96,
        page: validity.page,
        evidence: validity.evidence,
      });
      if (!has("policy_end_date")) fields.push({
        key: "policy_end_date",
        label: "Policy end date",
        value: validity.end,
        confidence: .96,
        page: validity.page,
        evidence: validity.evidence,
      });
    }
  }

  return { ...parsed, parserVersion: `${parsed.parserVersion}+identity-v1`, fields };
}

function findCurrentPolicyNumber(pages: string[]) {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!/\bPolicy\s*(?:No\.?|Number)\b/i.test(line)) continue;
      if (/Previous|Prev\.?|Active\s+TP|Existing\s+TP|Earlier|Old\s+Policy/i.test(line)) continue;
      const block = [line, lines[i + 1] ?? ""].join(" ");
      const afterLabel = block.replace(/^.*?\bPolicy\s*(?:No\.?|Number)\b\s*[:#-]?\s*/i, "").trim();
      const candidates = afterLabel.match(/[A-Z0-9][A-Z0-9\/-]{7,34}/gi) ?? [];
      for (const raw of candidates) {
        const value = raw.replace(/[.,;:]+$/, "");
        if (!validPolicyNumber(value)) continue;
        return { value, page: pageIndex + 1, evidence: "Current Policy No. label" };
      }
    }
  }
  return null;
}

function findCurrentValidity(pages: string[]) {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!/(?:Period\s+of\s+(?:Insurance|Cover)|Policy\s+Effective|Policy\s+Period|Insurance\s+Period|Validity)/i.test(line)) continue;
      if (/Previous|Prev\.?|Active\s+TP|Existing\s+TP|Earlier/i.test(line)) continue;
      const block = lines.slice(i, i + 4).join(" ");
      const dates = extractDates(block);
      const first = dates[0];
      const second = dates[1];
      if (!first || !second) continue;
      const start = toIso(first);
      const end = toIso(second);
      if (!start || !end || start >= end) continue;
      const startYear = Number(start.slice(0, 4));
      const endYear = Number(end.slice(0, 4));
      if (endYear - startYear < 0 || endYear - startYear > 5) continue;
      return { start, end, page: pageIndex + 1, evidence: "Current policy validity block" };
    }
  }
  return null;
}

function extractDates(text: string) {
  const matches = text.match(/(?:\d{1,2}\s*[\/-]\s*\d{1,2}\s*[\/-]\s*\d{4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*\d{4})/gi);
  return matches ?? [];
}

function toIso(raw: string) {
  const compact = raw.replace(/\s+/g, " ").trim();
  const numeric = compact.match(/^(\d{1,2})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{4})$/);
  if (numeric) return validIso(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));

  const named = compact.match(/^(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{4})$/);
  if (!named) return null;
  const monthKey = named[2].slice(0, 3).toLowerCase();
  const month = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(monthKey) + 1;
  if (!month) return null;
  return validIso(Number(named[3]), month, Number(named[1]));
}

function validIso(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function validPolicyNumber(value: string) {
  const compact = value.replace(/[^A-Z0-9]/gi, "");
  if (compact.length < 8 || compact.length > 32) return false;
  if (!/\d/.test(compact)) return false;
  if (/^(?:19|20)\d{6,}$/.test(compact)) return false;
  return !/^(?:GST|SAC|HSN|IMT|IRDA)/i.test(compact);
}
