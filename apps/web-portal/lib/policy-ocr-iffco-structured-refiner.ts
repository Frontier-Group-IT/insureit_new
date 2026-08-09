import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

export type StructuredPolicyTable = { page: number; rows: string[][] };
type MoneyHit = { value: number; page: number; evidence: string };

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

  const parsedNet = numericField(parsed.fields, "total_premium");
  const structuredNet = findStructuredPrintedNet(tables)
    ?? findStructuredNetFromTaxTotals(tables)
    ?? findParsedNetFromTaxTotals(parsed.fields);
  const printedNet = parsedNet && parsedNet > 0
    ? { value: parsedNet, page: structuredNet?.page ?? null, evidence: "Printed net from OCR text parser" }
    : structuredNet;

  if (!printedNet || printedNet.value <= 0) {
    return removeUnsafeFinancialFields(parsed, [
      "Review required. IFFCO printed net premium could not be independently verified; OD/TP/CPA were withheld rather than guessed.",
    ]);
  }

  const basicTp = findRowAmount(tables, /Basic\s+TP\s+Premium/i, printedNet.value, false);
  const legalDriver = findRowAmount(tables, /Legal\s+Liability\s+to\s+Driver/i, 5000, true);
  const cpa = findOwnerDriverPremium(tables);

  if (!basicTp || !cpa) {
    return removeUnsafeFinancialFields(parsed, [
      "Review required. IFFCO structured table validation could not prove TP/CPA from the premium schedule; OD/TP/CPA were not auto-applied.",
    ]);
  }

  const tp = round2(basicTp.value + (legalDriver?.value ?? 0));
  const od = round2(printedNet.value - tp - cpa.value);
  if (od < 0 || tp > printedNet.value || cpa.value > printedNet.value || !close(round2(od + tp + cpa.value), printedNet.value)) {
    return removeUnsafeFinancialFields(parsed, [
      "Review required. IFFCO structured premium rows did not reconcile to the printed net premium; OD/TP/CPA were withheld rather than guessed.",
    ]);
  }

  const fields = parsed.fields.filter((field) => !FINANCIAL_KEYS.has(field.key));
  if (!numericField(fields, "total_premium")) {
    setField(fields, "total_premium", "Printed net premium", money(printedNet.value), .99, printedNet.page, printedNet.evidence);
  }

  const combinedEvidence = [
    `Basic TP ${money(basicTp.value)} (${basicTp.evidence})`,
    legalDriver ? `Legal Liability ${money(legalDriver.value)} (${legalDriver.evidence})` : null,
    `CPA ${money(cpa.value)} (${cpa.evidence})`,
    `Printed net ${money(printedNet.value)} (${printedNet.evidence})`,
  ].filter(Boolean).join(" | ");

  setField(fields, "od_premium", "OD premium", money(od), .99, basicTp.page, `${combinedEvidence} | OD = printed net - TP - CPA`);
  setField(fields, "tp_premium", "Third party premium", money(tp), .99, basicTp.page, `${combinedEvidence} | TP = Basic TP + Legal Liability to Driver`);
  setField(fields, "cpa_premium", "CPA amount", money(cpa.value), .99, cpa.page, cpa.evidence);
  setField(fields, "cpa_opted", "CPA opted", cpa.value > 0 ? "Yes" : "No", .99, cpa.page, cpa.evidence);

  const warnings = parsed.warnings.filter((warning) =>
    !/IFFCO.*(?:OD|TP|CPA|premium components|Owner-Driver CPA row|liability rows|printed net premium)/i.test(warning),
  );

  return { ...parsed, parserVersion: `${parsed.parserVersion}+layout-table-v5.1`, fields, warnings };
}

function removeUnsafeFinancialFields(parsed: ParsedPolicyResult, extraWarnings: string[]): ParsedPolicyResult {
  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+layout-table-v5.1`,
    fields: parsed.fields.filter((field) => !FINANCIAL_KEYS.has(field.key)),
    warnings: unique([...parsed.warnings, ...extraWarnings]),
  };
}

function findStructuredPrintedNet(tables: StructuredPolicyTable[]): MoneyHit | null {
  // Real Layout Parser shape: the labels are in a header row and the numeric values are in following body rows.
  for (const table of tables) {
    for (let i = 0; i < table.rows.length - 1; i += 1) {
      const header = table.rows[i];
      const column = header.findIndex((cell) => /(?:Premium\s*\/\s*)?Taxable\s+Value/i.test(normalize(cell)));
      if (column < 0) continue;
      for (let j = i + 1; j <= Math.min(i + 3, table.rows.length - 1); j += 1) {
        const cell = table.rows[j][column] ?? "";
        const value = moneyValues(cell).find(isPlausiblePrintedNetCandidate);
        if (value !== undefined) {
          return { value, page: table.page, evidence: safeEvidence(`${header[column]} | ${cell}`) };
        }
      }
    }
  }

  // Older/synthetic layout: heading and all bifurcation values are in one row.
  for (const table of tables) {
    for (const row of table.rows) {
      const joined = normalize(row.join(" | "));
      if (!/Premium\s+Bifurcation/i.test(joined)) continue;
      const total = findAdditiveTotal(moneyValues(joined).filter(isPlausiblePrintedNetCandidate));
      if (total !== null) return { value: total, page: table.page, evidence: safeEvidence(joined) };
    }
  }

  return null;
}

function findStructuredNetFromTaxTotals(tables: StructuredPolicyTable[]): MoneyHit | null {
  // Column-aware GST tables from the actual Google JSON.
  for (const table of tables) {
    for (let i = 0; i < table.rows.length - 1; i += 1) {
      const header = table.rows[i].map(normalize);
      const taxableIndex = header.findIndex((cell) => /(?:Premium\s*\/\s*)?Taxable\s+Value/i.test(cell));
      const gstIndex = header.findIndex((cell) => /(?:GST\s+Amount|Total\s+GST)/i.test(cell));
      const grossIndex = header.findIndex((cell) => /Gross\s+Premium(?:\s+Payable)?|Net\s+Premium\s*\(Rs\.?\)/i.test(cell));
      if (taxableIndex < 0 || grossIndex < 0) continue;

      for (let j = i + 1; j <= Math.min(i + 3, table.rows.length - 1); j += 1) {
        const row = table.rows[j];
        const taxable = firstMoney(row[taxableIndex]);
        const gross = firstMoney(row[grossIndex]);
        const gst = gstIndex >= 0 ? firstMoney(row[gstIndex]) : null;
        if (taxable === null || gross === null || taxable >= gross || !isPlausiblePrintedNetCandidate(taxable)) continue;
        const tax = gst !== null && gst > 0 ? gst : round2(gross - taxable);
        if (!isPlausibleGstRelationship(taxable, tax, gross)) continue;
        return {
          value: taxable,
          page: table.page,
          evidence: safeEvidence(`${header[taxableIndex]} ${row[taxableIndex]} | ${header[grossIndex]} ${row[grossIndex]} | GST ${money(tax)}`),
        };
      }
    }
  }

  // Label-per-row fallback used by older fixtures.
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
      if (/(?:Gross\s+Premium|Total\s+Premium|Premium\s+Payable|Grand\s+Total)/i.test(joined) && !/(?:Net|Taxable)/i.test(joined)) gross = { value, page: table.page, evidence: safeEvidence(joined) };
      else if (/(?:Total\s+GST|GST\s+Amount|Tax\s+Amount)/i.test(joined) && !/(?:CGST|SGST|IGST)/i.test(joined)) tax = { value, page: table.page, evidence: safeEvidence(joined) };
      else if (/\bCGST\b/i.test(joined)) cgst = { value, page: table.page, evidence: safeEvidence(joined) };
      else if (/\bSGST\b/i.test(joined)) sgst = { value, page: table.page, evidence: safeEvidence(joined) };
      else if (/\bIGST\b/i.test(joined)) igst = { value, page: table.page, evidence: safeEvidence(joined) };
    }
    const componentTax = (cgst?.value ?? 0) + (sgst?.value ?? 0);
    const taxValue = tax?.value ?? igst?.value ?? (componentTax > 0 ? componentTax : null);
    if (!gross || taxValue === null || taxValue <= 0 || gross.value <= taxValue) continue;
    const net = round2(gross.value - taxValue);
    if (isPlausiblePrintedNetCandidate(net) && isPlausibleGstRelationship(net, taxValue, gross.value)) {
      return { value: net, page: gross.page, evidence: `Structured gross ${money(gross.value)} less tax ${money(taxValue)}` };
    }
  }
  return null;
}

function findParsedNetFromTaxTotals(fields: ParsedPolicyField[]): MoneyHit | null {
  const gross = numericField(fields, "gross_premium");
  const tax = numericField(fields, "tax_amount");
  if (!gross || !tax || gross <= tax) return null;
  const net = round2(gross - tax);
  if (!isPlausiblePrintedNetCandidate(net) || !isPlausibleGstRelationship(net, tax, gross)) return null;
  return { value: net, page: fields.find((field) => field.key === "gross_premium")?.page ?? 1, evidence: `Printed gross ${money(gross)} less GST ${money(tax)}` };
}

function findOwnerDriverPremium(tables: StructuredPolicyTable[]): MoneyHit | null {
  for (const table of tables) {
    for (const row of table.rows) {
      const joined = normalize(row.join(" | "));
      if (!/P\.?A\.?\s+Owner[-\s]*Driver/i.test(joined)) continue;
      const cleaned = joined.replace(/\(\s*IMT\s*\d+\s*\)/gi, " ").replace(/\bIMT\s*\d+\b/gi, " ");
      const values = moneyValues(cleaned).filter((value) => value >= 0 && value <= 1500000 && !isYear(value));
      const coverageIndex = values.findIndex((value) => value >= 100000);
      const candidates = (coverageIndex >= 0 ? values.slice(coverageIndex + 1) : values).filter((value) => value >= 0 && value <= 5000);
      const value = candidates.find((candidate) => candidate > 0) ?? (candidates.includes(0) ? 0 : null);
      if (value !== null) return { value, page: table.page, evidence: safeEvidence(joined) };
    }
  }
  return null;
}

function findRowAmount(tables: StructuredPolicyTable[], label: RegExp, max: number, ignoreImt: boolean): MoneyHit | null {
  for (const table of tables) {
    for (const row of table.rows) {
      const joined = normalize(row.join(" | "));
      if (!label.test(joined)) continue;
      label.lastIndex = 0;
      const cleaned = ignoreImt ? joined.replace(/\(\s*IMT\s*\d+\s*\)/gi, " ").replace(/\bIMT\s*\d+\b/gi, " ") : joined;
      const values = moneyValues(cleaned).filter((value) => value >= 0 && value <= max && value !== 997134 && !isYear(value));
      if (!values.length) continue;
      // Google may merge Basic TP and Basic Trailers TP into one cell/row: "7267.00 0.00".
      // Prefer the first positive payable amount; do not let the trailing trailer-zero replace Basic TP.
      const value = values.find((candidate) => candidate > 0) ?? values[0];
      return { value, page: table.page, evidence: safeEvidence(joined) };
    }
  }
  return null;
}

function findAdditiveTotal(values: number[]) {
  for (let i = 0; i < values.length; i += 1) for (let j = i + 1; j < values.length; j += 1) for (let k = 0; k < values.length; k += 1) {
    if (k === i || k === j) continue;
    if (values[k] > values[i] && values[k] > values[j] && close(round2(values[i] + values[j]), values[k])) return values[k];
  }
  return null;
}

function firstMoney(text: string | undefined) {
  if (!text) return null;
  const value = moneyValues(text).find((candidate) => candidate !== 997134 && !isYear(candidate));
  return value ?? null;
}

function isPlausiblePrintedNetCandidate(value: number) {
  return Number.isFinite(value) && value >= 100 && value <= 10000000 && value !== 997134 && !isYear(value);
}

function isPlausibleGstRelationship(net: number, tax: number, gross: number) {
  if (!close(round2(net + tax), gross)) return false;
  const rate = tax / net;
  return rate >= 0.05 && rate <= 0.30;
}

function numericField(fields: ParsedPolicyField[], key: string) {
  const raw = fields.find((field) => field.key === key)?.value;
  if (!raw) return null;
  const value = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? value : null;
}

function setField(fields: ParsedPolicyField[], key: string, label: string, value: string, confidence: number, page: number | null, evidence: string) {
  fields.push({ key, label, value, confidence, page, evidence });
}

function moneyValues(text: string) {
  return [...text.matchAll(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/g)].map((match) => Number(match[0].replace(/,/g, ""))).filter(Number.isFinite);
}
function normalize(text: string) { return text.replace(/\r/g, "\n").replace(/[\t\f\v]+/g, " ").replace(/[ ]{2,}/g, " ").trim(); }
function safeEvidence(text: string) { return text.replace(/\s+/g, " ").trim().slice(0, 220); }
function money(value: number) { const v = round2(value); return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""); }
function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function close(a: number, b: number) { return Math.abs(a - b) <= TOLERANCE; }
function isYear(value: number) { return Number.isInteger(value) && value >= 1900 && value <= 2100; }
function unique(values: string[]) { return [...new Set(values)]; }
