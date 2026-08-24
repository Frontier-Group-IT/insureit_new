import type { ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

/**
 * Final Round 5 guard: only repair an obviously invalid UIIC current-policy
 * number produced by permissive OCR label scanning. Never replace a plausible
 * existing policy number.
 */
export function guardProductionRound5UiicPolicyNumber(
  pages: string[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (!parsed.parserVersion.includes("+prod-r5-uiic_precision")) return parsed;

  const current = parsed.fields.find((field) => field.key === "policy_number")?.value?.trim() ?? "";
  if (plausiblePolicyNumber(current)) return parsed;

  const recovered = findStrictPolicyNumber(pages.slice(0, 2));
  const fields = parsed.fields.filter((field) => field.key !== "policy_number");
  if (recovered) {
    fields.push({
      key: "policy_number",
      label: "Policy number",
      value: recovered.value,
      confidence: .999,
      page: recovered.page,
      evidence: "Round 5 strict current UIIC policy-number label",
    });
  }
  return { ...parsed, fields };
}

function findStrictPolicyNumber(pages: string[]) {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      if (!/^\s*Policy\s+(?:Number|No\.?)\b/i.test(lines[i])) continue;
      if (/Previous|Prev\.?/i.test(lines[i])) continue;
      const sameLine = lines[i].replace(/^\s*Policy\s+(?:Number|No\.?)\s*[:#-]?\s*/i, "").trim();
      const candidates = [sameLine, lines[i + 1] ?? ""];
      for (const candidate of candidates) {
        const tokens = candidate.match(/[A-Z0-9][A-Z0-9\/-]{7,34}/gi) ?? [];
        for (const token of tokens) {
          const value = token.replace(/[.,;:]+$/, "");
          if (plausiblePolicyNumber(value)) return { value, page: pageIndex + 1 };
        }
      }
    }
  }
  return null;
}

function plausiblePolicyNumber(value: string) {
  const compact = value.replace(/[^A-Z0-9]/gi, "");
  return compact.length >= 8 && compact.length <= 32 && /\d/.test(compact) && /[A-Z]/i.test(compact);
}
