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

  const parsedPrintedNet = numericField(parsed.fields, "total_premium");
  const structuredPrintedNet = findStructuredPrintedNet(tables);
  const structuredTaxDerivedNet = findStructuredNetFromTaxTotals(tables);
  const parsedTaxDerivedNet = findParsedNetFromTaxTotals(parsed.fields);
  const printedNet = parsedPrintedNet && parsedPrintedNet > 0
    ? { value: parsedPrintedNet, page: structuredPrintedNet?.page ?? structuredTaxDerivedNet?.page ?? null, evidence: "Printed net from OCR text parser" }
    : structuredPrintedNet
      ?? structuredTaxDerivedNet
      ?? parsedTaxDerivedNet;

  if (!printedNet || printedNet.value <= 0) {
    return removeUnsafeFinancialFields(parsed, [
      "Review required. IFFCO printed net premium could not be independently verified; OD/TP/CPA were withheld rather than guessed.",
    ]);
  }

  const basicTp = findRowAmount(tables, /Basic\s+TP\s+Premium/i, { max: printedNet.value });
  const legalDriver = findRowAmount(tables, /Legal\s+Liability\s+to\s+Driver/i, { max: 5000, ignoreImt: true });
  const cpa = findOwnerDriverPremium(tables);

  if (!basicTp || !cpa) {
    return removeUnsafeFinancialFields(parsed, [
      "Review required. IFFCO structured table validation could not prove TP/CPA from the premium schedule; OD/TP/CPA were not auto-applied.",
    ]);
  }

  const tp = round2(basicTp.value + (legalDriver?.value ?? 0));
  const od = round2(printedNet.value - tp - cpa.value);
  const reconciles = od >= 0 && close(round2(od + tp + cpa.value), printedNet.value);

  if (!reconciles || tp > printedNet.value || cpa.value > printedNet.value) {
    return removeUnsafeFinancialFields(parsed, [
      "Review required. IFFCO structured premium rows did not reconcile to the printed net premium; OD/TP/CPA were withheld rather than guessed.",
    ]);
  }

  const fields = parsed.fields.filter((field) => !FINANCIAL_KEYS.has(field.key));
  if (!numericField(fields, "total_premium")) {
    setField(fields, "total_premium", "Printed net premium", money(printedNet.value), .99, printedNet.page, printedNet.evidence);
  }

  const evidence = [
    `Basic TP ${money(basicTp.value)} (${basicTp.evidence})`,
    legalDriver ? `Legal Liability ${money(legalDriver.value)} (${legalDriver.evidence})` : null,
    `CPA ${money(cpa.value)} (${cpa.evidence})`,
    `Printed net ${money(printedNet.value)} (${printedNet.evidence})`,
  ].filter(Boolean).join(" | ");

  setField(fields, "od_premium", "OD premium", money(od), .99, basicTp.page, `${evidence} | OD = printed net - TP - CPA`);
  setField(fields, "tp_premium", "Third party premium", money(tp), .99, basicTp.page, `${evidence} | TP = Basic TP + Legal Liability to Driver`);
  setField(fields, "cpa_premium", "CPA amount", money(cpa.value), .99, cpa.page, cpa.evidence);
  setField(fields, "cpa_opted", "CPA opted", cpa.value > 0 ? "Yes" : "No", .99, cpa.page, cpa.evidence);

  const warnings = parsed.warnings.filter((warning) =>
    !/IFFCO.*(?:OD|TP|CPA|premium components|Owner-Driver CPA row|liability rows|printed net premium)/i.test(warning),
  );

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+layout-table-v5`,
    fields,
    warnings,
  };
}

function removeUnsafeFinancialFields(parsed: ParsedPolicyResult, extraWarnings: string[]): ParsedPolicyResult {
  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+layout-table-v5`,
    fields: parsed.fields.filter((field) => !FINANCIAL_KEYS.has(field.key)),
    warnings: unique([...parsed.warnings, ...extraWarnings]),
  };
}

function findStructuredPrintedNet(tables: StructuredPolicyTable[]): MoneyHit | null {
  // Layout Parser commonly emits labels in a header row and values in the following body row.
  // Bind the Taxable Value / Premium Taxable Value column by index instead of scanning nearby numbers.
  for (const table of tables) {
    for (let rowIndex = 0; rowIndex < table.rows.length - 1; rowIndex += 1) {
      const header = table.rows[rowIndex];
      const columnIndex = header.findIndex((cell) =>
        /(?:Premium\s*\/\s*)?Taxable\s+Value(?:\s*\(\s*Rs\.?\s*\))?/i.test(normalize(cell)),
      );
      if (columnIndex < 0) continue;

      for (let valueRowIndex = rowIndex + 1; valueRowIndex <= Math.min(rowIndex + 3, table.rows.length - 1); valueRowIndex += 1) {
        const valueCell = table.rows[valueRowIndex][columnIndex] ?? "";
        const values = moneyValues(valueCell).filter(isPlausiblePrintedNetCandidate);
        if (!values.length) continue;
        const value = values[0];
        return {
          value,
          page: table.page,
          evidence: safeEvidence(`${header[columnIndex]} | ${valueCell}`),
        };
      }
    }
  }

  // Explicit one-row labels remain supported for alternate IFFCO layouts.
  for (const table of tables) {
    for (const row of table.rows) {
      const joined = normalize(row.join(" | "));
      if (!/(?:Premium\s*\/\s*Taxable\s+Value|Taxable\s+Premium)/i.test(joined)) continue;
      const candidates = moneyValues(joined).filter(isPlausiblePrintedNetCandidate);
      if (candidates.length === 1) {
        return { value: candidates[0], page: table.page, evidence: safeEvidence(joined) };
      }
    }
  }

  // Some older/synthetic fixtures put the bifurcation label and all amounts on one row.
  for (const table of tables) {
    for (const row of table.rows) {
      const joined = normalize(row.join(" | "));
      if (!/Premium\s+Bifurcation/i.test(joined)) continue;
      const values = moneyValues(joined).filter(isPlausiblePrintedNetCandidate);
      const reconciled = findAdditiveTotal(values);
      if (reconciled !== null) {
        return { value: reconciled, page: table.page, evidence: safeEvidence(joined) };
      }
    }
  }

  return null;
}

function findStructuredNetFromTaxTotals(tables: StructuredPolicyTable[]): MoneyHit | null {
  // Column-aware GST detail tables from the real Google Layout Parser response.
  for (const table of tables) {
    for (let rowIndex = 0; rowIndex < table.rows.length - 1; rowIndex += 1) {
      const header = table.rows[rowIndex].map((cell) => normalize(cell));
      const taxableIndex = header.findIndex((cell) => /(?:Premium\s*\/\s*)?Taxable\s+Value/i.test(cell));
      const gstIndex = header.findIndex((cell) => /(?:GST\s+Amount|Total\s+GST)/i.test(cell));
      const grossIndex = header.findIndex((cell) => /Gross\s+Premium(?:\s+Payable)?/i.test(cell));
      if (taxableIndex < 0 || grossIndex < 0) continue;

      for (let valueRowIndex = rowIndex + 1; valueRowIndex <= Math.min(rowIndex + 3, table.rows.length - 1); valueRowIndex += 1) {
        const row = table.rows[valueRowIndex];
        const taxable = firstMoney(row[taxableIndex]);
        const gross = firstMoney(row[grossIndex]);
        const gst = gstIndex >= 0 ? firstMoney(row[gstIndex]) : null;
        if (!taxable || !gross || taxable >= gross || !isPlausiblePrintedNetCandidate(taxable)) continue;
        if (gst !== null && gst > 0 && isPlausibleGstRelationship(taxable, gst, gross)) {
          return {
            value: taxable,
            page: table.page,
            evidence: safeEvidence(`${header[taxableIndex]} ${row[taxableIndex]} | ${header[grossIndex]} ${row[grossIndex]} | ${header[gstIndex]} ${row[gstIndex]}`),
          };
        }
        const derivedTax = round2(gross - taxable);
        if (derivedTax > 0 && isPlausibleGstRelationship(taxable, derivedTax, gross)) {
          return {
            value: taxable,
            page: table.page,
            evidence: safeEvidence(`${header[taxableIndex]} ${row[taxableIndex]} | ${header[grossIndex]} ${row[grossIndex]}`),
          };
        }
      }
    }
  }

  // Label-per-row layouts remain supported.
  for (const table of tables) {
    let gross: MoneyHit | null = null;
    let tax: MoneyHit | null = null;
    let cgst: MoneyHit | null = null;
    let sgst: MoneyHit | null = null;
    let igst: MoneyHit | null = null;

    for (const row of table.rows) {
      const joined = normalize(row.join(" | "));
      const values = moneyValues(joined).filter((value) => value >= 0 && value <= 10000000 && value !== 997134 && !isYear(value));
      if (!values.length) continue;
      const value = values[values.length - 1];

      if (/(?:Gross\s+Premium|Total\s+Premium|Premium\s+Payable|Grand\s+Total)/i.test(joined) && !/(?:Net|Taxable)/i.test(joined)) {
        gross = { value, page: table.page, evidence: safeEvidence(joined) };
      } else if (/(?:Total\s+GST|GST\s+Amount|Tax\s+Amount)/i.test(joined) && !/(?:CGST|SGST|IGST)/i.test(joined)) {
        tax = { value, page: table.page, evidence: safeEvidence(joined) };
      } else if (/\bCGST\b/i.test(joined)) {
        cgst = { value, page: table.page, evidence: safeEvidence(joined) };
      } else if (/\bSGST\b/i.test(joined)) {
        sgst = { value, page: table.page, evidence: safeEvidence(joined) };
      } else if (/\bIGST\b/i.test(joined)) {
        igst = { value, page: table.page, evidence: safeEvidence(joined) };
      }
    }

    const componentTax = (cgst?.value ?? 0) + (sgst?.value ?? 0);
    const taxValue = tax?.value ?? igst?.value ?? (componentTax > 0 ? componentTax : null);
    if (!gross || taxValue === null || taxValue <= 0 || gross.value <= taxValue) continue;

    const net = round2(gross.value - taxValue);
    if (!isPlausiblePrintedNetCandidate(net)) continue;
    if (!isPlausibleGstRelationship(net, taxValue, gross.value)) continue;

    return {
      value: net,
      page: gross.page,
      evidence: `Structured gross ${money(gross.value)} less tax ${money(taxValue)}`,
    };
  }
  return null;
}

function findParsedNetFromTaxTotals(fields: ParsedPolicyField[]): MoneyHit | null {
  const gross = numericField(fields, "gross_premium");
  const tax = numericField(fields, "tax_amount");
  if (!gross || !tax || gross <= tax) return null;
  const net = round2(gross - tax);
  if (!isPlausiblePrintedNetCandidate(net) || !isPlausibleGstRelationship(net, tax, gross)) return null;
  const page = fields.find((field) => field.key === "gross_premium")?.page ?? null;
  return { value: net, page: page ?? 1, evidence: `Printed gross ${money(gross)} less GST ${money(tax)}` };
}

function isPlausibleGstRelationship(net: number, tax: number, gross: number) {
  if (!close(round2(net + tax), gross)) return false;
  const rate = net > 0 ? tax / net : 0;
  return rate >= 0.05 && rate <= 0.30;
}

function findAdditiveTotal(values: number[]) {
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      for (let k = 0; k < values.length; k += 1) {
        if (k === i || k === j) continue;
        const total = values[k];
        if (total <= values[i] || total <= values[j]) continue;
        if (close(round2(values[i] + values[j]), total)) return total;
      }
    }
  }
  return null;
}

function isPlausiblePrintedNetCandidate(value: number) {
  return Number.isFinite(value)
    && value >= 100
    && value <= 10000000
    && value !== 997134
    && !isYear(value);
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

      const value = values[values.length - 1];
      return { value, page: table.page, evidence: safeEvidence(joined) };
    }
  }
  return null;
}

function firstMoney(text: string | undefined) {
  if (!text) return null;
  const values = moneyValues(text).filter((value) => value !== 997134 && !isYear(value));
  return values.length ? values[0] : null;
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
