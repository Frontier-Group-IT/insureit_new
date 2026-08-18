import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Hit = { value: number; page: number; evidence: string };
type DateHit = { from: string; upto: string; page: number; evidence: string };

const MONEY_RE = /[0-9][0-9,]*(?:\.[0-9]{1,2})?/g;
const DATE_RE = /(?:^|[^0-9])([0-9]{1,2}\s*[\/-]\s*(?:[0-9]{1,2}|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*[\/-]\s*[0-9]{2,4})(?=$|[^0-9])/gi;

export function refineNewIndiaStructuredPolicy(tables: StructuredPolicyTable[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  if (!tables.length) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const period = findPeriod(tables);
  const idv = findIdv(tables);
  const structuredOd = findLabeledAmount(tables, /(?:Total|Calculated)\s+OD\s+Premium/i, { min: 100, max: 10000000 });
  const structuredLiability = findLabeledAmount(tables, /(?:Total|Calculated)\s+TP\s+Premium/i, { min: 100, max: 10000000 });
  const structuredCpa = findOwnerDriverCpa(tables);
  const structuredNet = findLabeledAmount(tables, /Net\s+Premium/i, { min: 100, max: 10000000 });
  const structuredTax = findLabeledAmount(tables, /(?:^|\b)GST(?:\s*\(Rs\.?\))?/i, { min: 0, max: 10000000 });
  const structuredGross = findLabeledAmount(tables, /Total\s+Payable/i, { min: 100, max: 10000000 });

  if (period) {
    setField(fields, "policy_start_date", "Valid from", period.from, .99, period.page, period.evidence);
    setField(fields, "policy_end_date", "Valid upto", period.upto, .99, period.page, period.evidence);
  }
  if (idv) setField(fields, "idv", "IDV / Sum insured", money(idv.value), .99, idv.page, idv.evidence);
  if (structuredNet) setField(fields, "total_premium", "Printed net premium", money(structuredNet.value), .99, structuredNet.page, structuredNet.evidence);
  if (structuredTax) setField(fields, "tax_amount", "Printed GST", money(structuredTax.value), .99, structuredTax.page, structuredTax.evidence);
  if (structuredGross) setField(fields, "gross_premium", "Printed gross premium", money(structuredGross.value), .99, structuredGross.page, structuredGross.evidence);

  const cpaValue = structuredCpa?.value ?? numeric(fields.get("cpa_premium")) ?? 0;
  const netValue = structuredNet?.value ?? numeric(fields.get("total_premium"));
  let odValue = structuredOd?.value ?? null;
  let liabilityValue = structuredLiability?.value ?? null;

  if (netValue !== null) {
    if (odValue === null && liabilityValue !== null) odValue = round2(netValue - liabilityValue);
    if (liabilityValue === null && odValue !== null) liabilityValue = round2(netValue - odValue);
  }

  if (odValue !== null && liabilityValue !== null && netValue !== null) {
    const portalTp = round2(liabilityValue - cpaValue);
    const reconciles = odValue >= 0 && portalTp >= 0 && close(round2(odValue + portalTp + cpaValue), netValue);
    if (reconciles) {
      setField(fields, "od_premium", "OD premium", money(odValue), .99, structuredOd?.page ?? structuredNet?.page ?? 1, evidence(structuredOd, structuredNet, "Structured New India OD reconciled to printed net"));
      setField(fields, "tp_premium", "Third party premium", money(portalTp), .99, structuredLiability?.page ?? structuredNet?.page ?? 1, `${evidence(structuredLiability, structuredNet, "Structured New India TP reconciled to printed net")} | Portal TP = printed TP ${money(liabilityValue)} minus CPA ${money(cpaValue)}.`);
      setField(fields, "cpa_premium", "CPA amount", money(cpaValue), .99, structuredCpa?.page ?? 1, structuredCpa?.evidence ?? "CPA retained from OCR text and validated by structured premium reconciliation");
      setField(fields, "cpa_opted", "CPA opted", cpaValue > 0 ? "Yes" : "No", .99, structuredCpa?.page ?? 1, structuredCpa?.evidence ?? "CPA validated by structured premium reconciliation");
    }
  }

  const missing = ["idv", "od_premium", "tp_premium", "policy_start_date", "policy_end_date"].filter((key) => !fields.get(key)?.value?.trim());
  const warnings = parsed.warnings.filter((warning) => !/Review required\. Missing or uncertain New India fields:/i.test(warning));
  if (missing.length) warnings.push(`Review required. Missing or uncertain New India fields: ${missing.join(", ")}.`);

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+new-india-layout-v1.1`,
    fields: [...fields.values()],
    warnings,
  };
}

function findPeriod(tables: StructuredPolicyTable[]): DateHit | null {
  for (const table of tables) {
    for (let i = 0; i < table.rows.length; i += 1) {
      const row = normalize(table.rows[i].join(" | "));
      if (!/Period\s+of\s+cover|Own\s+Damage\s+Period|Motor\s+Liability\s+Period/i.test(row)) continue;
      const neighborhood = [row, ...table.rows.slice(i + 1, i + 5).map((next) => normalize(next.join(" | ")))].join(" | ");
      const dates = extractDates(neighborhood);
      if (dates.length >= 2) return { from: dates[0], upto: dates[1], page: table.page, evidence: safe(neighborhood) };
    }
  }
  return null;
}

function extractDates(text: string) {
  DATE_RE.lastIndex = 0;
  return [...text.matchAll(DATE_RE)]
    .map((match) => isoDate(match[1]))
    .filter((value): value is string => Boolean(value));
}

function findIdv(tables: StructuredPolicyTable[]): Hit | null {
  for (const table of tables) {
    for (let i = 0; i < table.rows.length; i += 1) {
      const row = table.rows[i].map(normalize);
      const totalValueColumn = row.findIndex((cell) => /Total\s+(?:IDV|Value)/i.test(cell));
      if (totalValueColumn >= 0) {
        const sameCellValues = moneyValues(row[totalValueColumn]).filter(isPlausibleIdv);
        if (sameCellValues.length) return { value: Math.max(...sameCellValues), page: table.page, evidence: safe(row.join(" | ")) };
        for (let j = i + 1; j <= Math.min(i + 4, table.rows.length - 1); j += 1) {
          const value = moneyValues(table.rows[j][totalValueColumn] ?? "").find(isPlausibleIdv);
          if (value !== undefined) return { value, page: table.page, evidence: safe(`${row[totalValueColumn]} | ${table.rows[j][totalValueColumn] ?? ""}`) };
        }
      }

      const joined = row.join(" | ");
      if (!/INSURED\s+DECLARED\s+VALUE/i.test(joined)) continue;
      const neighborhood = table.rows.slice(i, i + 10).flat().join(" | ");
      const values = moneyValues(neighborhood).filter(isPlausibleIdv);
      if (values.length) return { value: Math.max(...values), page: table.page, evidence: safe(neighborhood) };
    }
  }
  return null;
}

function findOwnerDriverCpa(tables: StructuredPolicyTable[]): Hit | null {
  const hit = findLabeledAmount(tables, /Compulsory\s+PA\s+Premium\s+for\s+Owner\s*Driver|PA\s+Cover\s+For\s+Owner\s*Driver/i, { min: 20, max: 5000 }, true);
  return hit;
}

function findLabeledAmount(
  tables: StructuredPolicyTable[],
  label: RegExp,
  limits: { min: number; max: number },
  excludeCoverage = false,
): Hit | null {
  for (const table of tables) {
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
      const row = table.rows[rowIndex].map(normalize);
      for (let cellIndex = 0; cellIndex < row.length; cellIndex += 1) {
        const cell = row[cellIndex];
        if (!label.test(cell)) { label.lastIndex = 0; continue; }
        label.lastIndex = 0;

        const afterLabel = cell.replace(label, " ");
        let candidates = validAmounts(afterLabel, limits, excludeCoverage);
        if (!candidates.length) {
          candidates = row.slice(cellIndex + 1).flatMap((value) => validAmounts(value, limits, excludeCoverage));
        }
        if (candidates.length) return { value: candidates[0], page: table.page, evidence: safe(row.join(" | ")) };

        for (let next = rowIndex + 1; next <= Math.min(rowIndex + 4, table.rows.length - 1); next += 1) {
          const aligned = table.rows[next][cellIndex] ?? "";
          const alignedCandidates = validAmounts(aligned, limits, excludeCoverage);
          if (alignedCandidates.length) return { value: alignedCandidates[0], page: table.page, evidence: safe(`${cell} | ${aligned}`) };
        }
      }

      const joined = row.join(" | ");
      if (!label.test(joined)) { label.lastIndex = 0; continue; }
      label.lastIndex = 0;
      const match = joined.match(label);
      if (!match || match.index === undefined) continue;
      const after = joined.slice(match.index + match[0].length);
      const candidates = validAmounts(after, limits, excludeCoverage);
      if (candidates.length) return { value: candidates[0], page: table.page, evidence: safe(joined) };
    }
  }
  return null;
}

function validAmounts(text: string, limits: { min: number; max: number }, excludeCoverage: boolean) {
  return moneyValues(text).filter((value) => value >= limits.min && value <= limits.max && value !== 997134 && !isYear(value) && (!excludeCoverage || value < 100000));
}

function moneyValues(text: string) {
  return [...text.matchAll(MONEY_RE)].map((match) => Number(match[0].replace(/,/g, ""))).filter(Number.isFinite);
}

function isPlausibleIdv(value: number) {
  return value >= 10000 && value <= 1000000000 && value !== 997134 && !isYear(value);
}

function numeric(field: ParsedPolicyField | undefined) {
  if (!field?.value) return null;
  const value = Number(field.value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? value : null;
}

function setField(fields: Map<string, ParsedPolicyField>, key: string, label: string, value: string, confidence: number, page: number | null, evidenceText: string) {
  fields.set(key, { key, label, value, confidence, page, evidence: safe(evidenceText) });
}

function evidence(primary: Hit | null, fallback: Hit | null, defaultText: string) {
  return primary?.evidence ?? fallback?.evidence ?? defaultText;
}

function normalize(value: string) { return value.replace(/\s+/g, " ").trim(); }
function safe(value: string) { return normalize(value).slice(0, 600); }
function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function close(a: number, b: number) { return Math.abs(a - b) <= 1; }
function money(value: number) { const rounded = round2(value); return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""); }
function isYear(value: number) { return Number.isInteger(value) && value >= 1900 && value <= 2100; }

function isoDate(value: string): string | null {
  const compact = value.replace(/\s+/g, "").trim().toUpperCase();
  const match = compact.match(/^(\d{1,2})[\/-](\d{1,2}|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[\/-](\d{2,4})$/);
  if (!match) return null;
  const months: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  const day = Number(match[1]);
  const month = /^[A-Z]{3}$/.test(match[2]) ? months[match[2]] : Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (!month || day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
