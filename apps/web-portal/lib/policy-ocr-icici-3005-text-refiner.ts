import type { ParsedPolicyField, ParsedPolicyResult } from "./policy-ocr-parsers";

/**
 * Text-only safeguard for ICICI Lombard product 3005 (bundled two-wheeler).
 * Uses explicit label/value pairs from the policy, never layout-parser tables.
 * Keep this distinct from the existing 3003 goods-carrier refiner.
 */
export function refineIciciBundledTwoWheelerText(
  pages: string[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const firstTwo = pages.slice(0, 2).join("\n");
  if (!/ICICI\s+LOMBARD/i.test(firstTwo)
    || !/Product\s+Code\s*:\s*3005\b/i.test(firstTwo)
    || !/Bundled\s*[-–—]?\s*Two\s+Wheeler\s+Policy/i.test(firstTwo)) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const warnings = [...parsed.warnings];
  const risk = (pages[0] ?? "").split(/Insured\s*&\s*Vehicle\s+Details/i)[1]?.split(/The\s+commencement\s+of\s+coverage|Previous\s+Policy\s+Details/i)[0] ?? "";
  const riskLines = risk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const scheduleLines = (pages[1] ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const pair = riskLines.map((line) => line.match(/^Vehicle\s+Make\s*\/\s*Model\s*:?\s+([A-Z][A-Z0-9 .-]{1,36}?)\s*\/\s*([A-Z0-9][A-Z0-9 .-]{1,36})\s*$/i)).find(Boolean);
  const make = pair?.[1]?.trim() ?? null;
  const model = pair?.[2]?.trim() ?? null;
  const engine = exactLabeledId(riskLines, /^Engine\s+No\.?\s*:?\s+([A-Z0-9-]{8,24})$/i);
  const cpaLine = scheduleLines.map((line) =>
    line.match(/^PA\s+Cover\s+for\s+Owner\s*[- ]?\s*Driver\s+([\d,]+\.\d{2})\s*$/i)
  ).find(Boolean);
  const cpa = cpaLine ? Number(cpaLine[1].replace(/,/g, "")) : null;

  function correct(key: string, value: string | null, label: string, page: number, evidence: string) {
    // If there is no explicit source evidence, do not retain a plausible-looking
    // but wrong generic extraction for this product.
    fields.delete(key);
    if (!value) {
      warnings.push(`Review required. ICICI bundled two-wheeler ${label} could not be verified from labelled text.`);
      return;
    }
    const field: ParsedPolicyField = { key, label, value, confidence: 0.99, page, evidence };
    fields.set(key, field);
  }

  correct("vehicle_make", make, "Vehicle make", 1, "ICICI Vehicle Make / Model (risk assumption letter)");
  correct("vehicle_model", model, "Vehicle model", 1, "ICICI Vehicle Make / Model (risk assumption letter)");
  correct("vehicle_engine_number", engine, "Engine number", 1, "ICICI Engine No. (risk assumption letter)");
  correct("cpa_premium",
    cpa != null && Number.isFinite(cpa) && cpa > 0 && cpa <= 5000 ? String(cpa) : null,
    "CPA amount", 2, "ICICI PA Cover for Owner Driver (premium schedule)");
  if (cpa != null && cpa > 0 && cpa <= 5000) {
    correct("cpa_opted", "Yes", "CPA opted", 2, "ICICI labelled PA Cover for Owner Driver");
  } else {
    fields.delete("cpa_opted");
  }

  return { ...parsed, parserVersion: parsed.parserVersion + "+icici-3005-text-v1", fields: [...fields.values()], warnings };
}

function exactLabeledId(lines: string[], label: RegExp): string | null {
  for (const line of lines) {
    const match = line.match(label);
    if (match?.[1] && /[A-Z]/i.test(match[1]) && /\d/.test(match[1])) return match[1].toUpperCase();
  }
  return null;
}
