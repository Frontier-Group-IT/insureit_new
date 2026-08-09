import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

export type StructuredPolicyTable = {
  page: number;
  rows: string[][];
};

type MoneyHit = {
  value: number;
  page: number;
  evidence: string;
};

const FINANCIAL_KEYS = new Set(["od_premium", "tp_premium", "cpa_premium", "cpa_opted"]);
const TOLERANCE = 0.05;

export function refineIffcoStructuredFinancials(
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (!tables.length) {
    return removeUnsafeFinancialFields(parsed, [
      "Review required. IFFCO structured premium-table evidence was unavailable; OD/TP/CPA were withheld rather than guessed from flattened OCR text.",
    ]);
  }

  const printedNet = numericField(parsed.fields, "total_premium");
  if (printedNet === null || printedNet <= 0) {
    return removeUnsafeFinancialFields(parsed, [
      "Review required. IFFCO printed net premium could not be independently verified; OD/TP/CPA were withheld rather than guessed.",
    ]);
  }

  const basicTp = findRowAmount(tables, /Basic\s+TP\s+Premium/i, { max: printedNet });
  const legalDriver = findRowAmount(tables, /Legal\s+Liability\s+to\s+Driver/i, { max: 5000, ignoreImt: true });
  const cpa = findOwnerDriverPremium(tables);

  if (!basicTp || !cpa) {
    return removeUnsafeFinancialFields(parsed, [
      "Review required. IFFCO structured table validation could not prove TP/CPA from the premium schedule; OD/TP/CPA were not auto-applied.",
    ]);
  }

  const tp = round2(basicTp.value + (legalDriver?.value ?? 0));
  const od = round2(printedNet - tp - cpa.value);
  const reconciles = od >= 0 && close(round2(od + tp + cpa.value), printedNet);

  if (!reconciles || tp > printedNet || cpa.value > printedNet) {
    return removeUnsafeFinancialFields(parsed, [
      "Review required. IFFCO structured premium rows did not reconcile to the printed net premium; OD/TP/CPA were withheld rather than guessed.",
    ]);
  }

  const fields = parsed.fields.filter((field) => !FINANCIAL_KEYS.has(field.key));
  const evidence = [
    `Basic TP ${money(basicTp.value)} (${basicTp.evidence})`,
    legalDriver ? `Legal Liability ${money(legalDriver.value)} (${legalDriver.evidence})` : null,
    `CPA ${money(cpa.value)} (${cpa.evidence})`,
    `Printed net ${money(printedNet)}`,
  ].filter(Boolean).join(" | ");

  setField(fields, "od_premium", "OD premium", money(od), .99, basicTp.page, `${evidence} | OD = printed net - TP - CPA`);
  setField(fields, "tp_premium", "Third party premium", money(tp), .99, basicTp.page, `${evidence} | TP = Basic TP + Legal Liability to Driver`);
  setField(fields, "cpa_premium", "CPA amount", money(cpa.value), .99, cpa.page, cpa.evidence);
  setField(fields, "cpa_opted", "CPA opted", cpa.value > 0 ? "Yes" : "No", .99, cpa.page, cpa.evidence);

  const warnings = parsed.warnings.filter((warning) =>
    !/IFFCO.*(?:OD|TP|CPA|premium components|Owner-Driver CPA row|liability rows)/i.test(warning),
  );

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+layout-table-v2`,
    fields,
    warnings,
  };
}

function removeUnsafeFinancialFields(parsed: ParsedPolicyResult, extraWarnings: string[]): ParsedPolicyResult {
  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+layout-table-v2`,
    fields: parsed.fields.filter((field) => !FINANCIAL_KEYS.has(field.key)),
    warnings: unique([...parsed.warnings, ...extraWarnings]),
  };
}

function findOwnerDriverPremium(tables: StructuredPolicyTable[]): MoneyHit | null {
  for (const table of tables) {
    for (const row of table.rows) {
      const joined = normalize(row.join(" | "));
      if (!/P\.?A\.?\s+Owner[-\s]*Driver/i.test(joined)) continue;

      const cleaned = joined
        .replace(/\(\s*IMT\s*\d+\s*\)/gi, " ")
        .replace(/\bIMT\s*\d+\b/gi, " ");
      const values = moneyValues(cleaned).filter((value) => value >= 0 && value <= 1500000 && !isYear(value));
      const coverageIndex = values.findIndex((value) => value >= 100000);
      const candidates = (coverageIndex >= 0 ? values.slice(coverageIndex + 1) : values)
        .filter((value) => value >= 0 && value <= 5000);
      const positive = candidates.find((value) => value > 0);
      const value = positive ?? (candidates.includes(0) ? 0 : null);
      if (value === null) continue;
      return { value, page: table.page, evidence: safeEvidence(joined) };
    }
  }
  return null;
}

function findRowAmount(
  tables: StructuredPolicyTable[],
  label: RegExp,
  options: { max: number; ignoreImt?: boolean },
): MoneyHit | null {
  for (const table of tables) {
    for (const row of table.rows) {
      const joined = normalize(row.join(" | "));
      if (!label.test(joined)) continue;
      label.lastIndex = 0;

      const cleaned = options.ignoreImt
        ? joined.replace(/\(\s*IMT\s*\d+\s*\)/gi, " ").replace(/\bIMT\s*\d+\b/gi, " ")
        : joined;
      const values = moneyValues(cleaned)
        .filter((value) => value >= 0 && value <= options.max && !isYear(value) && value !== 997134);
      if (!values.length) continue;

      // Premium schedules normally place the payable premium in the right-most numeric cell.
      const value = values[values.length - 1];
      return { value, page: table.page, evidence: safeEvidence(joined) };
    }
  }
  return null;
}

function numericField(fields: ParsedPolicyField[], key: string) {
  const raw = fields.find((field) => field.key === key)?.value;
  if (!raw) return null;
  const value = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? value : null;
}

function setField(
  fields: ParsedPolicyField[],
  key: string,
  label: string,
  value: string,
  confidence: number,
  page: number | null,
  evidence: string,
) {
  fields.push({ key, label, value, confidence, page, evidence });
}

function moneyValues(text: string) {
  return [...text.matchAll(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/g)]
    .map((match) => Number(match[0].replace(/,/g, "")))
    .filter(Number.isFinite);
}

function safeEvidence(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

function normalize(text: string) {
  return text.replace(/\r/g, "\n").replace(/[\t\f\v]+/g, " ").replace(/[ ]{2,}/g, " ").trim();
}

function money(value: number) {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function close(a: number, b: number) {
  return Math.abs(a - b) <= TOLERANCE;
}

function isYear(value: number) {
  return Number.isInteger(value) && value >= 1900 && value <= 2100;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
