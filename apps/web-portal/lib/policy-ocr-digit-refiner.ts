import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const DIGIT_VERSION = "digit_commercial_motor_v1.3.0";
const MONEY_TOKEN = /[0-9][0-9,]*(?:\.[0-9]{1,2})?/g;
const DATE_TOKEN = "([0-9]{1,2}[-/](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|[0-9]{1,2})[-/][0-9]{2,4}|[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2})";

type Evidence = { value: string; page: number; evidence: string };
type MoneyEvidence = { value: number; page: number; evidence: string };

export function refineDigitCommercialPolicy(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  const cleanPages = pages.map(sanitizeText);
  const text = cleanPages.join("\n");
  const upper = text.toUpperCase();
  if (!upper.includes("GO DIGIT GENERAL INSURANCE") && !upper.includes("DIGIT COMMERCIAL VEHICLE")) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const warnings = parsed.warnings.filter((warning) => !warning.includes("Missing or uncertain fields"));

  replace(fields, "insurer_name", "Insurance company", "Go Digit General Insurance Limited", .99, 1, "Go Digit General Insurance Ltd.");

  const product = digitProduct(upper);
  if (product) replace(fields, "policy_product", "Policy product", product.value, .99, product.page, product.evidence);

  const policy = findText(cleanPages, [
    /Policy\s*No\.?\s*[:\-]?\s*(D\d{6,15})/i,
    /Policy\s*No\.?\s*(D\d{6,15})\s*\//i,
  ]);
  if (policy) replace(fields, "policy_number", "Policy number", policy.value, .99, policy.page, policy.evidence);

  const period = findDigitPeriod(cleanPages);
  if (period) {
    replace(fields, "policy_start_date", "Valid from", isoDate(period.start), .99, period.page, period.evidence);
    replace(fields, "policy_end_date", "Valid upto", isoDate(period.end), .99, period.page, period.evidence);
  }

  const idv = findDigitIdv(cleanPages);
  if (idv) replace(fields, "idv", "IDV / Sum insured", formatMoney(idv.value), .99, idv.page, idv.evidence);

  const od = findMoneyByLabel(cleanPages, /\bOwn\s*Damage\s*Premium\b/i, { rejectHeaderOnly: true });
  const tp = findMoneyByLabel(cleanPages, /\bBasic\s*Third[-\s]*Party\s*Liability\b/i, { rejectHeaderOnly: true });
  if (od) replace(fields, "od_premium", "OD premium", formatMoney(od.value), .99, od.page, od.evidence);
  if (tp) replace(fields, "tp_premium", "Third party premium", formatMoney(tp.value), .99, tp.page, tp.evidence);

  const cpa = findDigitCpa(cleanPages);
  if (cpa) {
    replace(fields, "cpa_opted", "CPA opted", cpa.value > 0 ? "Yes" : "No", .99, cpa.page, cpa.evidence);
    replace(fields, "cpa_premium", "CPA amount", formatMoney(cpa.value), .99, cpa.page, cpa.evidence);
  }

  const invoice = findDigitInvoice(cleanPages);
  if (invoice) {
    replace(fields, "total_premium", "Printed net premium", formatMoney(invoice.net), .99, invoice.page, invoice.evidence);
    replace(fields, "tax_amount", "Printed GST", formatMoney(invoice.tax), .99, invoice.page, invoice.evidence);
    replace(fields, "gross_premium", "Printed gross premium", formatMoney(invoice.gross), .99, invoice.page, invoice.evidence);
  }

  const resolvedOd = numberField(fields.get("od_premium"));
  const resolvedTp = numberField(fields.get("tp_premium"));
  const resolvedCpa = numberField(fields.get("cpa_premium")) ?? 0;
  const resolvedNet = numberField(fields.get("total_premium"));
  const resolvedTax = numberField(fields.get("tax_amount"));
  const resolvedGross = numberField(fields.get("gross_premium"));

  if (resolvedOd !== null && resolvedTp !== null && resolvedNet !== null) {
    const calculatedNet = resolvedOd + resolvedTp + resolvedCpa;
    if (Math.abs(calculatedNet - resolvedNet) > 1) {
      warnings.push(`Digit premium cross-check: OD + TP + CPA (${formatMoney(calculatedNet)}) does not match printed net premium (${formatMoney(resolvedNet)}). Review the premium table.`);
    }
  }
  if (resolvedNet !== null && resolvedTax !== null && resolvedGross !== null && Math.abs((resolvedNet + resolvedTax) - resolvedGross) > 1) {
    warnings.push(`Digit premium cross-check: printed net + GST does not match printed gross premium. Review the invoice row.`);
  }

  const required = ["policy_product", "idv", "od_premium", "tp_premium", "policy_number", "insurer_name", "policy_start_date", "policy_end_date"];
  const missing = required.filter((key) => !fields.has(key) || !fields.get(key)?.value.trim());
  if (missing.length) warnings.push(`Review required. Missing or uncertain Digit fields: ${missing.join(", ")}.`);

  return {
    ...parsed,
    parserId: "digit_commercial_motor_v1",
    parserVersion: DIGIT_VERSION,
    fields: [...fields.values()],
    warnings,
  };
}

function replace(fields: Map<string, ParsedPolicyField>, key: string, label: string, value: string, confidence: number, page: number | null, evidence: string) {
  if (!value.trim()) return;
  fields.set(key, { key, label, value: value.trim(), confidence, page, evidence: sanitizeText(evidence).slice(0, 500) });
}

function digitProduct(upper: string): Evidence | null {
  if (/DIGIT\s+COMMERCIAL\s+VEHICLE\s+(?:COMPREHENSIVE|PACKAGE)\s+POLICY/i.test(upper)) {
    return { value: "Package", page: 1, evidence: "Digit Commercial Vehicle Comprehensive Policy" };
  }
  if (/\b(?:LIABILITY\s+ONLY|ACT\s+ONLY|THIRD\s+PARTY)\b/i.test(upper) && !/COMPREHENSIVE|PACKAGE/i.test(upper)) {
    return { value: "Third Party", page: 1, evidence: "Digit liability / third-party policy" };
  }
  if (/\b(?:STANDALONE|STAND\s+ALONE)\s+(?:OWN\s+DAMAGE|OD)|\bSAOD\b/i.test(upper)) {
    return { value: "SAOD", page: 1, evidence: "Digit standalone own-damage policy" };
  }
  return null;
}

function findDigitPeriod(pages: string[]): { start: string; end: string; page: number; evidence: string } | null {
  const patterns = [
    new RegExp(`Period\\s*of\\s*Policy[\\s\\S]{0,260}?From\\s*${DATE_TOKEN}(?:\\s+[0-9]{1,2}:[0-9]{2}:[0-9]{2})?[\\s\\S]{0,160}?To\\s*${DATE_TOKEN}`, "i"),
    new RegExp(`From\\s*${DATE_TOKEN}(?:\\s+[0-9]{1,2}:[0-9]{2}:[0-9]{2})?[\\s\\S]{0,120}?To\\s*${DATE_TOKEN}`, "i"),
    new RegExp(`\\b${DATE_TOKEN}\\s+${DATE_TOKEN}\\s+Digit\\s+Commercial\\s+Vehicle\\s+(?:Comprehensive|Package)\\s+Policy`, "i"),
  ];
  for (let page = 0; page < pages.length; page += 1) {
    for (const pattern of patterns) {
      const match = pages[page].match(pattern);
      if (match?.[1] && match?.[2]) return { start: match[1], end: match[2], page: page + 1, evidence: match[0] };
    }
  }
  return null;
}

function findDigitIdv(pages: string[]): MoneyEvidence | null {
  for (let page = 0; page < pages.length; page += 1) {
    const text = pages[page];
    const start = text.search(/YOUR\s+VEHICLE\s+IDV/i);
    if (start < 0) continue;
    const remainder = text.slice(start);
    const endRelative = remainder.search(/OWN\s+DAMAGE\s+PREMIUM/i);
    const block = endRelative > 0 ? remainder.slice(0, endRelative) : remainder.slice(0, 1200);
    const rows = block.split("\n");
    const totalIdvIndex = rows.findIndex((line) => /TOTAL\s+IDV/i.test(line));
    const candidateArea = totalIdvIndex >= 0 ? rows.slice(totalIdvIndex, totalIdvIndex + 10).join(" ") : block;
    const amounts = moneyValues(candidateArea).filter((value) => value >= 1000 && value <= 1000000000);
    if (!amounts.length) continue;
    const value = Math.max(...amounts);
    return { value, page: page + 1, evidence: block.slice(0, 700) };
  }
  return null;
}

function findMoneyByLabel(pages: string[], label: RegExp, options?: { rejectHeaderOnly?: boolean }): MoneyEvidence | null {
  for (let page = 0; page < pages.length; page += 1) {
    const lines = pages[page].split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (!label.test(lines[index])) continue;
      label.lastIndex = 0;
      const window = lines.slice(index, index + 3).join(" ");
      if (options?.rejectHeaderOnly && /\[[AB]\]/i.test(lines[index]) && !/[0-9]{3,}(?:\.[0-9]{1,2})?/.test(lines[index])) continue;
      const labelMatch = window.match(label);
      label.lastIndex = 0;
      if (!labelMatch || labelMatch.index === undefined) continue;
      const afterLabel = window.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 140);
      const values = moneyValues(afterLabel).filter((value) => value >= 0 && value <= 100000000);
      if (!values.length) continue;
      return { value: values[0], page: page + 1, evidence: window };
    }
  }
  return null;
}

function findDigitCpa(pages: string[]): MoneyEvidence | null {
  for (let page = 0; page < pages.length; page += 1) {
    const lines = pages[page].split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (!/PA\s*cover\s*for\s*Owner[-\s]*Driver/i.test(lines[index])) continue;
      const evidence = lines.slice(index, index + 2).join(" ");
      if (/Owner[-\s]*Driver[^\n]{0,100}(?:--|NIL|NA\b)/i.test(evidence)) return { value: 0, page: page + 1, evidence };
      const labelMatch = evidence.match(/PA\s*cover\s*for\s*Owner[-\s]*Driver/i);
      const after = labelMatch?.index !== undefined ? evidence.slice(labelMatch.index + labelMatch[0].length) : evidence;
      const values = moneyValues(after).filter((value) => value >= 0 && value <= 100000);
      if (values.length) return { value: values[0], page: page + 1, evidence };
    }
  }
  return { value: 0, page: 1, evidence: "No payable PA cover for Owner-Driver identified" };
}

function findDigitInvoice(pages: string[]): { net: number; tax: number; gross: number; page: number; evidence: string } | null {
  for (let page = 0; page < pages.length; page += 1) {
    const text = pages[page];
    if (!/Invoice\s+Number\s+Invoice\s+Date\s+Net\s+Premium/i.test(text)) continue;
    const match = text.match(/\b[A-Z]{1,5}\d{5,}\s+(\d{4}-\d{2}-\d{2})\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)/i);
    if (!match) continue;
    const net = parseMoney(match[2]);
    const igst = parseMoney(match[3]);
    const cgst = parseMoney(match[4]);
    const sgst = parseMoney(match[5]);
    const utgst = parseMoney(match[6]);
    const cess = parseMoney(match[7]);
    const gross = parseMoney(match[8]);
    if ([net, igst, cgst, sgst, utgst, cess, gross].some((value) => value === null)) continue;
    return { net: net!, tax: igst! + cgst! + sgst! + utgst! + cess!, gross: gross!, page: page + 1, evidence: match[0] };
  }
  return null;
}

function findText(pages: string[], patterns: RegExp[]): Evidence | null {
  for (let page = 0; page < pages.length; page += 1) {
    for (const pattern of patterns) {
      const match = pages[page].match(pattern);
      if (match?.[1]) return { value: match[1].trim(), page: page + 1, evidence: match[0] };
    }
  }
  return null;
}

function moneyValues(value: string) {
  return [...value.matchAll(MONEY_TOKEN)].map((match) => parseMoney(match[0])).filter((item): item is number => item !== null);
}

function numberField(field: ParsedPolicyField | undefined) {
  return field ? parseMoney(field.value) : null;
}

function parseMoney(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function isoDate(value: string) {
  const clean = value.trim().toUpperCase();
  const iso = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return validIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const match = clean.match(/^(\d{1,2})[-/]([A-Z]{3}|\d{1,2})[-/](\d{2,4})$/);
  if (!match) return "";
  const months: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  const month = months[match[2]] ?? Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  return validIso(year, month, Number(match[1]));
}

function validIso(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return date.toISOString().slice(0, 10);
}

function sanitizeText(value: string) {
  return value.replace(/\u00ad/g, "").replace(/[–—]/g, "-").replace(/\r/g, "").split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}
