import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const VERSION = "iffco_tokio_commercial_motor_v2.0.0";
const MONEY_RE = /[0-9][0-9,]*(?:\.[0-9]{1,2})?/g;
const DATE_RE = /([0-9]{1,2})[\/-]([0-9]{1,2})[\/-]([0-9]{2,4})/;
const TOLERANCE = 0.05;

type Hit = { value: number; page: number; evidence: string };
type TextHit = { value: string; page: number; evidence: string };
type PeriodHit = { from: string; upto: string; page: number; evidence: string };

export function refineIffcoCommercialPolicyV2(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  const cleanPages = pages.map(sanitize);
  const fields = [...parsed.fields];
  const warnings: string[] = [];

  setField(fields, "insurer_name", "Insurance company", "IFFCO-TOKIO General Insurance Company Limited", .99, 1, "IFFCO-TOKIO GENERAL INSURANCE CO.LTD");
  setField(fields, "policy_product", "Policy product", "Package", .99, 1, "Commercial Vehicle / Coverage: Package");

  const policy = findPolicyNumber(cleanPages);
  if (policy) setField(fields, "policy_number", "Policy number", policy.value, .99, policy.page, policy.evidence);

  const period = findPeriod(cleanPages);
  if (period) {
    setField(fields, "policy_start_date", "Valid from", period.from, .99, period.page, period.evidence);
    setField(fields, "policy_end_date", "Valid upto", period.upto, .99, period.page, period.evidence);
  }

  const idv = findIdv(cleanPages);
  if (idv) setField(fields, "idv", "IDV / Sum insured", money(idv.value), .99, idv.page, idv.evidence);

  const netA = findNetPremium(cleanPages, "A");
  const netB = findNetPremium(cleanPages, "B");
  const cpa = findOwnerDriverPremium(cleanPages);
  const section2 = findSection2Premium(cleanPages);
  const totals = findPrintedTotals(cleanPages);

  const cpaValue = cpa?.value ?? 0;
  const section2Value = section2?.value ?? 0;
  const normalizedOd = netA ? round2(netA.value + section2Value) : null;
  const normalizedTp = netB ? round2(Math.max(0, netB.value - cpaValue)) : null;
  const declarationConflict = cpaValue > 0 && hasCpaDeclarationConflict(cleanPages);

  if (normalizedOd !== null && netA) {
    const evidence = section2Value > 0 && section2
      ? `${netA.evidence} | OD add-on/Section 2 premium ${money(section2Value)} (${section2.evidence})`
      : netA.evidence;
    setField(fields, "od_premium", "OD premium", money(normalizedOd), .99, netA.page, evidence);
  }

  if (normalizedTp !== null && netB) {
    const evidence = cpaValue > 0 && cpa
      ? `${netB.evidence} | normalized as Net(B) less separately stored Owner-Driver CPA ${money(cpaValue)}`
      : netB.evidence;
    setField(fields, "tp_premium", "Third party premium", money(normalizedTp), .99, netB.page, evidence);
  }

  if (cpa) {
    setField(fields, "cpa_premium", "CPA amount", money(cpaValue), declarationConflict ? .72 : .99, cpa.page, cpa.evidence);
    setField(fields, "cpa_opted", "CPA opted", cpaValue > 0 ? "Yes" : "No", declarationConflict ? .72 : .99, cpa.page, cpa.evidence);
  } else {
    setField(fields, "cpa_premium", "CPA amount", "0", .82, null, "No payable PA Owner Driver premium identified in the premium table");
    setField(fields, "cpa_opted", "CPA opted", "No", .82, null, "Derived from missing payable Owner-Driver premium");
  }

  if (totals.net) setField(fields, "total_premium", "Printed net premium", money(totals.net.value), .99, totals.net.page, totals.net.evidence);
  if (totals.tax) setField(fields, "tax_amount", "Printed GST", money(totals.tax.value), .99, totals.tax.page, totals.tax.evidence);
  if (totals.gross) setField(fields, "gross_premium", "Printed gross premium", money(totals.gross.value), .99, totals.gross.page, totals.gross.evidence);

  if (declarationConflict) {
    warnings.push("Review required. IFFCO Owner-Driver premium is charged in the premium table, but the policy declaration says PA Owner-Driver cover is not applicable/deleted. Verify CPA before applying.");
  }

  if (normalizedOd !== null && normalizedTp !== null && totals.net) {
    const calculated = round2(normalizedOd + normalizedTp + cpaValue);
    if (!close(calculated, totals.net.value)) {
      warnings.push(`Review required. IFFCO premium components do not reconcile: OD + TP + CPA = ${money(calculated)}, printed net = ${money(totals.net.value)}.`);
    }
  }

  if (totals.net && totals.tax && totals.gross) {
    const calculatedGross = round2(totals.net.value + totals.tax.value);
    if (!close(calculatedGross, totals.gross.value)) {
      warnings.push(`Review required. IFFCO printed net + GST = ${money(calculatedGross)}, printed gross = ${money(totals.gross.value)}.`);
    }
  }

  return { parserId: "iffco_tokio_commercial_motor_v2", parserVersion: VERSION, fields, warnings };
}

function findPolicyNumber(pages: string[]): TextHit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const match = page.match(/P400\s+Policy\s*#\s*(N\d{6,15})/i) ?? page.match(/\bPolicy\s*#\s*(N\d{6,15})\b/i);
    if (match) return { value: match[1].toUpperCase(), page: pageIndex + 1, evidence: match[0] };
  }
  return null;
}

function findPeriod(pages: string[]): PeriodHit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const match = page.match(/Period\s+of\s+Insurance\s+From\s*:?\s*([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})(?:\s+[0-9:]+)?[\s\S]{0,100}?To\s*:?\s*(?:Midnight\s+On\s*)?([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i);
    if (!match) continue;
    const from = isoDate(match[1]);
    const upto = isoDate(match[2]);
    if (from && upto) return { from, upto, page: pageIndex + 1, evidence: match[0] };
  }
  return null;
}

function findIdv(pages: string[]): Hit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const patterns = [
      /\bPackage\s+([0-9][0-9,]*(?:\.[0-9]{1,2})?)(?=\s+Non\s+Electrical|\s+Non\s+Elect|\s+Chassis|\s+its\s+value|\s*$)/i,
      /Total\s+Value\s+Net\s+Premium\s+Rs\.?\s*\n?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
    ];
    for (const pattern of patterns) {
      const match = page.match(pattern);
      if (!match) continue;
      const value = number(match[1]);
      if (value >= 10000 && !isYear(value)) return { value, page: pageIndex + 1, evidence: match[0] };
    }
  }
  return null;
}

function findNetPremium(pages: string[], side: "A" | "B"): Hit | null {
  const pattern = new RegExp(`Net\\s*\\(${side}\\)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)`, "i");
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const match = pages[pageIndex].match(pattern);
    if (!match) continue;
    const value = number(match[1]);
    if (value >= 0 && value < 10000000 && !isYear(value)) return { value, page: pageIndex + 1, evidence: match[0] };
  }
  return null;
}

function findOwnerDriverPremium(pages: string[]): Hit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (!/PA\s+Owner\s+Driver/i.test(line)) continue;
      const lineValues = amounts(line).filter((value) => value >= 0 && value <= 1500000 && !isYear(value));
      const source = lineValues.length ? line : `${line} ${lines[lineIndex + 1] ?? ""}`.trim();
      const values = lineValues.length ? lineValues : amounts(source).filter((value) => value >= 0 && value <= 1500000 && !isYear(value));
      const premiumCandidates = values.filter((value) => value <= 100000);
      if (!premiumCandidates.length) continue;
      return { value: premiumCandidates[premiumCandidates.length - 1], page: pageIndex + 1, evidence: source };
    }
  }
  return null;
}

function findSection2Premium(pages: string[]): Hit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    if (!/Premium\s+Bifurcation/i.test(page) || !/Section\s*2\s*\(Rs\.?\)/i.test(page)) continue;
    const match = page.match(/Premium\s+Bifurcation[\s\S]{0,260}?Section\s*1\s*\(Rs\.?\)\s+Section\s*2\s*\(Rs\.?\)[\s\S]{0,220}?\n?\s*([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)/i);
    if (match) {
      const value = number(match[2]);
      if (value >= 0 && value < 10000000) return { value, page: pageIndex + 1, evidence: match[0] };
    }
  }
  return null;
}

function findPrintedTotals(pages: string[]): { net: Hit | null; tax: Hit | null; gross: Hit | null } {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const totalRow = page.match(/GST\s+Details[\s\S]{0,500}?\bTotal\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)/i);
    if (totalRow) {
      return { net: hit(totalRow[1], pageIndex, totalRow[0]), tax: hit(totalRow[2], pageIndex, totalRow[0]), gross: hit(totalRow[3], pageIndex, totalRow[0]) };
    }

    const netMatch = page.match(/Premium\/Taxable\s+Value\s+RS\.?\s*([0-9,.]+)/i);
    const grossMatch = page.match(/Gross\s+Premium\s+Payable\s+Rs\.?\s*([0-9,.]+)/i);
    if (netMatch && grossMatch) {
      const net = number(netMatch[1]);
      const gross = number(grossMatch[1]);
      if (net >= 0 && gross >= net) {
        return {
          net: { value: net, page: pageIndex + 1, evidence: netMatch[0] },
          tax: { value: round2(gross - net), page: pageIndex + 1, evidence: `${netMatch[0]} | ${grossMatch[0]}` },
          gross: { value: gross, page: pageIndex + 1, evidence: grossMatch[0] },
        };
      }
    }
  }
  return { net: null, tax: null, gross: null };
}

function hasCpaDeclarationConflict(pages: string[]) {
  const text = pages.join("\n");
  return /PA\s+coverage\s+for\s+Owner[-\s]*Driver\s+will\s+not\s+be\s+applicable/i.test(text)
    || /opted\s+to\s+delete\s+Compulsory\s+PA\s+cover/i.test(text)
    || /Compulsory\s+PA\s+cover\s+under\s+this\s+policy[^.]*deleted/i.test(text);
}

function setField(fields: ParsedPolicyField[], key: string, label: string, value: string, confidence: number, page: number | null, evidence: string) {
  const next: ParsedPolicyField = { key, label, value, confidence, page, evidence };
  const index = fields.findIndex((field) => field.key === key);
  if (index >= 0) fields[index] = next;
  else fields.push(next);
}

function hit(raw: string, pageIndex: number, evidence: string): Hit { return { value: number(raw), page: pageIndex + 1, evidence }; }
function amounts(text: string) { return [...text.matchAll(MONEY_RE)].map((match) => number(match[0])).filter(Number.isFinite); }
function number(raw: string) { return Number(raw.replace(/,/g, "")); }
function money(value: number) {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function close(a: number, b: number) { return Math.abs(a - b) <= TOLERANCE; }
function isYear(value: number) { return Number.isInteger(value) && value >= 1900 && value <= 2100; }

function isoDate(raw: string) {
  const match = raw.match(DATE_RE);
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const month = Number(match[2]);
  const day = Number(match[1]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sanitize(text: string) {
  return text.replace(/\r/g, "\n").replace(/[\t\f\v]+/g, " ").replace(/[ ]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
