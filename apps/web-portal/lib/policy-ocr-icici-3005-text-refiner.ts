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
    || !/Product\s+Code\s*:\s*3005\b/i.test(pages[0] ?? "")
    || !/Bundled\s*[-–—]?\s*Two\s+Wheeler\s+Policy/i.test(firstTwo)) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const warnings = [...parsed.warnings];
  const risk = (pages[0] ?? "").split(/Insured\s*&\s*Vehicle\s+Details/i)[1]?.split(/The\s+commencement\s+of\s+coverage|Previous\s+Policy\s+Details/i)[0] ?? "";
  const riskLines = risk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const scheduleLines = (pages[1] ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const pair = riskLines.map((line) => line.match(/^Vehicle\s+Make\s*\/\s*Model\s*:?\s+([A-Z][A-Z0-9 .-]{1,36}?)\s*\/\s*([A-Z0-9][A-Z0-9 .-]{1,36})\s*$/i)).find(Boolean);
  const make = pair?.[1]?.trim() ?? null;
  const model = pair?.[2]?.trim() ?? null;
  // Product 3005 often prints identity labels with their values in a column
  // rather than using the "Name of the Insured :" convention.
  const name = explicitIdentityValue(riskLines, /^Name\s+of\s+(?:the\s+)?Insured\b\s*:?\s*(.*)$/i, false);
  const phone = explicitIdentityValue(riskLines, /^(?:Mobile(?:\s+(?:No\.?|Number))?|Contact\s+(?:No\.?|Number)|Phone(?:\s+(?:No\.?|Number))?)\b\s*:?\s*(.*)$/i, true);
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

  // Never replace a pre-existing verified identity with an unsupported guess.
  if (name) correct("insured_name", name, "Insured name", 1, "ICICI explicitly labelled insured name");
  if (phone) correct("insured_phone", phone, "Insured phone", 1, "ICICI explicitly labelled complete mobile number; manual selection required");
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

/** Only return an explicitly labelled identity, never nearby unrelated values. */
function explicitIdentityValue(lines: string[], label: RegExp, isPhone: boolean): string | null {
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(label);
    if (!match) continue;
    const raw = match[1]?.trim() || (lines[index + 1] && !/^(?:Name|Period|Vehicle|RTO|Engine|Chassis|Mobile|Phone|Contact|Current|Previous|The commencement)\b/i.test(lines[index + 1]) ? lines[index + 1] : "");
    if (!raw) continue;
    if (isPhone) {
      if (/[xX*•]/.test(raw)) continue;
      const digits = raw.replace(/\D/g, "");
      const mobile = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
      if (/^[6-9]\d{9}$/.test(mobile)) return mobile;
    } else {
      const name = raw.replace(/\s+/g, " ").trim();
      if (name.length >= 3 && name.length <= 120
        && /[A-Za-z]{2}/.test(name)
        && !/\b(?:policy|vehicle|period|registration|premium|insurance|motor)\b/i.test(name)
        && !/\d{5,}/.test(name)) return name;
    }
  }
  return null;
}
