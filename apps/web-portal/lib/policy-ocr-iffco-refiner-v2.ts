import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const VERSION = "iffco_tokio_commercial_motor_v2.2.0";
const MONEY_RE = /[0-9][0-9,]*(?:\.[0-9]{1,2})?/g;
const DATE_RE = /([0-9]{1,2})[\/-]([0-9]{1,2})[\/-]([0-9]{2,4})/;
const DATE_TOKEN_RE = /[0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4}/g;
const TOLERANCE = 0.05;
const REPLACE_KEYS = new Set([
  "insurer_name", "policy_product", "policy_number", "policy_start_date", "policy_end_date",
  "idv", "od_premium", "tp_premium", "cpa_premium", "cpa_opted",
  "total_premium", "tax_amount", "gross_premium",
]);
const REQUIRED_KEYS = [
  "policy_product", "idv", "od_premium", "tp_premium", "policy_number", "insurer_name", "policy_start_date", "policy_end_date",
];

type Hit = { value: number; page: number; evidence: string };
type TextHit = { value: string; page: number; evidence: string };
type PeriodHit = { from: string; upto: string; page: number; evidence: string };

export function refineIffcoCommercialPolicyV2(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  const cleanPages = pages.map(sanitize);
  const fields = parsed.fields.filter((field) => !REPLACE_KEYS.has(field.key));
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

  let netA = findNetPremium(cleanPages, "A");
  let netB = findNetPremium(cleanPages, "B");
  const paired = findPairedNetPremiumRow(cleanPages);
  netA ??= paired?.a ?? null;
  netB ??= paired?.b ?? null;

  const cpa = findOwnerDriverPremium(cleanPages);
  const section2 = findSection2Premium(cleanPages);
  const totals = findPrintedTotals(cleanPages);
  const fallbackTp = netB ? null : findFallbackTpExcludingCpa(cleanPages);

  const cpaValue = cpa?.value ?? 0;
  const section2Value = section2?.value ?? 0;
  let normalizedOd = netA ? round2(netA.value + section2Value) : null;
  let normalizedTp = netB
    ? round2(Math.max(0, netB.value - cpaValue))
    : fallbackTp
      ? round2(fallbackTp.value)
      : null;

  if (totals.net && normalizedTp !== null && normalizedOd === null && cpa) {
    normalizedOd = round2(totals.net.value - normalizedTp - cpaValue);
  }
  if (totals.net && normalizedOd !== null && normalizedTp === null && cpa) {
    normalizedTp = round2(totals.net.value - normalizedOd - cpaValue);
  }

  if (totals.net && netB && (!netA || (section2Value === 0 && !close(round2(netA.value + netB.value), totals.net.value)))) {
    const recoveredOd = round2(totals.net.value - netB.value);
    if (recoveredOd >= 0) normalizedOd = recoveredOd;
  }

  const declarationConflict = cpaValue > 0 && hasCpaDeclarationConflict(cleanPages);

  if (normalizedOd !== null && normalizedOd >= 0) {
    const evidence = netA
      ? section2Value > 0 && section2
        ? `${netA.evidence} | OD add-on/Section 2 premium ${money(section2Value)} (${section2.evidence})`
        : netA.evidence
      : totals.net && normalizedTp !== null
        ? `${totals.net.evidence} | OD recovered by printed-net reconciliation`
        : "OD recovered by IFFCO accounting reconciliation";
    setField(fields, "od_premium", "OD premium", money(normalizedOd), netA ? .99 : .9, netA?.page ?? totals.net?.page ?? null, evidence);
  }

  if (normalizedTp !== null && normalizedTp >= 0) {
    const evidence = netB
      ? cpaValue > 0 && cpa
        ? `${netB.evidence} | normalized as Net(B) less separately stored Owner-Driver CPA ${money(cpaValue)}`
        : netB.evidence
      : fallbackTp
        ? `${fallbackTp.evidence} | TP recovered from IFFCO liability rows excluding CPA`
        : totals.net && normalizedOd !== null
          ? `${totals.net.evidence} | TP recovered by printed-net reconciliation`
          : "TP recovered by IFFCO accounting reconciliation";
    setField(fields, "tp_premium", "Third party premium", money(normalizedTp), netB ? .99 : fallbackTp ? .93 : .9, netB?.page ?? fallbackTp?.page ?? totals.net?.page ?? null, evidence);
  }

  if (cpa) {
    setField(fields, "cpa_premium", "CPA amount", money(cpaValue), declarationConflict ? .72 : .99, cpa.page, cpa.evidence);
    setField(fields, "cpa_opted", "CPA opted", cpaValue > 0 ? "Yes" : "No", declarationConflict ? .72 : .99, cpa.page, cpa.evidence);
  } else {
    setField(fields, "cpa_premium", "CPA amount", "0", .55, null, "No payable PA Owner Driver premium identified reliably in the scanned premium table; do not auto-apply");
    setField(fields, "cpa_opted", "CPA opted", "No", .55, null, "Derived from missing payable Owner-Driver premium; do not auto-apply");
    warnings.push("Review required. IFFCO Owner-Driver CPA row was not read reliably from the scanned premium table. Verify CPA before applying.");
  }

  if (totals.net) setField(fields, "total_premium", "Printed net premium", money(totals.net.value), .99, totals.net.page, totals.net.evidence);
  if (totals.tax) setField(fields, "tax_amount", "Printed GST", money(totals.tax.value), .99, totals.tax.page, totals.tax.evidence);
  if (totals.gross) setField(fields, "gross_premium", "Printed gross premium", money(totals.gross.value), .99, totals.gross.page, totals.gross.evidence);

  if (fallbackTp && !netB) {
    warnings.push("IFFCO TP was recovered from Basic TP plus readable liability rows because Net(B) was split in OCR. Verify the value against the schedule before applying.");
  }

  if (declarationConflict) {
    warnings.push("Review required. IFFCO Owner-Driver premium is charged in the premium table, but the policy declaration says PA Owner-Driver cover is not applicable/deleted. Verify CPA before applying.");
  }

  if (normalizedOd !== null && normalizedTp !== null && totals.net && cpa) {
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

  const present = new Set(fields.map((field) => field.key));
  const missing = REQUIRED_KEYS.filter((key) => !present.has(key));
  if (missing.length) warnings.push(`Review required. Missing or uncertain IFFCO fields: ${missing.join(", ")}.`);

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
    const exact = page.match(/Period\s+of\s+Insurance\s+From\s*:?\s*([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})(?:\s+[0-9:]+)?[\s\S]{0,140}?To\s*:?\s*(?:Midnight\s+On\s*)?([0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/i);
    if (exact) {
      const from = isoDate(exact[1]);
      const upto = isoDate(exact[2]);
      if (from && upto) return { from, upto, page: pageIndex + 1, evidence: exact[0] };
    }

    const marker = page.search(/Period\s+of\s+Insurance|Insurance\s+Period/i);
    if (marker < 0) continue;
    const window = page.slice(marker, marker + 520);
    const tokens = [...window.matchAll(DATE_TOKEN_RE)].map((match) => match[0]);
    for (let first = 0; first < tokens.length; first += 1) {
      for (let second = first + 1; second < tokens.length; second += 1) {
        const from = isoDate(tokens[first]);
        const upto = isoDate(tokens[second]);
        if (!from || !upto || !isAnnualPeriod(from, upto)) continue;
        return { from, upto, page: pageIndex + 1, evidence: window.slice(0, 320) };
      }
    }
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
  const label = new RegExp(`Net\\s*\\(\\s*${side}\\s*\\)|Net\\s*${side}`, "i");
  const direct = new RegExp(`(?:Net\\s*\\(\\s*${side}\\s*\\)|Net\\s*${side})[ \\t]*[:\\-]?[ \\t]*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)`, "i");
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const match = page.match(direct);
    if (match) {
      const value = number(match[1]);
      if (validPremium(value)) return { value, page: pageIndex + 1, evidence: match[0] };
    }

    const labelMatch = label.exec(page);
    if (!labelMatch || labelMatch.index === undefined) continue;
    const around = page.slice(Math.max(0, labelMatch.index - 120), labelMatch.index + labelMatch[0].length + 120);
    const opposite = side === "A" ? /Net\s*\(\s*B\s*\)|Net\s*B/i : /Net\s*\(\s*A\s*\)|Net\s*A/i;
    if (opposite.test(around)) continue;
    const after = page.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 100);
    const candidates = amounts(after).filter(validPremium);
    if (candidates.length) return { value: candidates[0], page: pageIndex + 1, evidence: `${labelMatch[0]} ${after.slice(0, 80)}`.trim() };
  }
  return null;
}

function findPairedNetPremiumRow(pages: string[]): { a: Hit; b: Hit } | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const aMatch = /Net\s*\(\s*A\s*\)/i.exec(page);
    const bMatch = /Net\s*\(\s*B\s*\)/i.exec(page);
    if (!aMatch || !bMatch || aMatch.index === undefined || bMatch.index === undefined) continue;

    const firstIndex = Math.min(aMatch.index, bMatch.index);
    const secondEnd = Math.max(aMatch.index + aMatch[0].length, bMatch.index + bMatch[0].length);
    if (secondEnd - firstIndex > 220) continue;

    const afterLabels = page.slice(secondEnd, secondEnd + 260);
    const values = amounts(afterLabels).filter(validPremium);
    if (values.length >= 2) {
      return {
        a: { value: values[0], page: pageIndex + 1, evidence: page.slice(firstIndex, Math.min(page.length, secondEnd + 180)) },
        b: { value: values[1], page: pageIndex + 1, evidence: page.slice(firstIndex, Math.min(page.length, secondEnd + 180)) },
      };
    }

    const lines = page.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const header = lines.slice(index, index + 4).join(" ");
      if (!/Net\s*\(\s*A\s*\)/i.test(header) || !/Net\s*\(\s*B\s*\)/i.test(header)) continue;
      const source = lines.slice(index, index + 8).join(" | ");
      const lineValues = amounts(lines.slice(index + 1, index + 8).join(" ")).filter(validPremium);
      if (lineValues.length < 2) continue;
      return {
        a: { value: lineValues[0], page: pageIndex + 1, evidence: source },
        b: { value: lineValues[1], page: pageIndex + 1, evidence: source },
      };
    }
  }
  return null;
}

function findOwnerDriverPremium(pages: string[]): Hit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const match = /PA\s+Owner[-\s]*Driver/i.exec(page);
    if (!match || match.index === undefined) continue;

    const start = match.index;
    const rawWindow = page.slice(start, start + 240);
    const nextRow = rawWindow.search(/\b(?:Legal\s+Liability|Hire\s+Reward|LL\s+to|PA\s+to\s+Passenger|Net\s*\()/i);
    const window = nextRow > 0 ? rawWindow.slice(0, nextRow) : rawWindow;
    const values = amounts(window).filter((value) => value >= 0 && value <= 1500000 && !isYear(value));

    const coverageIndex = values.findIndex((value) => value > 100000);
    if (coverageIndex >= 0) {
      const premium = values.slice(coverageIndex + 1).find((value) => value >= 0 && value <= 100000);
      if (premium !== undefined) return { value: premium, page: pageIndex + 1, evidence: window };
    }

    const premium = values.find((value) => value >= 0 && value <= 100000);
    if (premium !== undefined) return { value: premium, page: pageIndex + 1, evidence: window };
  }
  return null;
}

function findFallbackTpExcludingCpa(pages: string[]): Hit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const basic = amountAfterLabel(page, /Basic\s+TP\s+Premium/i, 120, { ignoreImt: false });
    if (basic === null || basic <= 0 || basic > 1000000) continue;

    const legalDriver = amountAfterLabel(page, /Legal\s+Liability\s+to\s+Driver/i, 130, { ignoreImt: true }) ?? 0;
    const value = round2(basic + Math.max(0, legalDriver));
    return {
      value,
      page: pageIndex + 1,
      evidence: `Basic TP Premium ${money(basic)}${legalDriver ? ` + Legal Liability to Driver ${money(legalDriver)}` : ""}`,
    };
  }
  return null;
}

function amountAfterLabel(page: string, label: RegExp, maxChars: number, options: { ignoreImt: boolean }): number | null {
  const match = label.exec(page);
  if (!match || match.index === undefined) return null;
  let window = page.slice(match.index + match[0].length, match.index + match[0].length + maxChars);
  if (options.ignoreImt) window = window.replace(/\(\s*IMT\s*\d+\s*\)/gi, " ").replace(/\bIMT\s*\d+\b/gi, " ");
  const nextLabel = window.search(/\b(?:Basic|Legal|PA\s+Owner|LL\s+to|Geographical|Overturning|Hire\s+Reward|Net\s*\()/i);
  if (nextLabel > 0) window = window.slice(0, nextLabel);
  const values = amounts(window).filter((value) => value >= 0 && value <= 1000000 && !isYear(value));
  return values.length ? values[0] : null;
}

function findSection2Premium(pages: string[]): Hit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    if (!/Premium\s+Bifurcation/i.test(page) || !/Section\s*2\s*\(Rs\.?\)/i.test(page)) continue;
    const match = page.match(/Premium\s+Bifurcation[\s\S]{0,300}?Section\s*1\s*\(Rs\.?\)\s+Section\s*2\s*\(Rs\.?\)[\s\S]{0,260}?\n?\s*([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)/i);
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
    const totalRow = page.match(/GST\s+Details[\s\S]{0,650}?\bTotal\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)/i);
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

    const net = amountAfterLabel(page, /Premium\/Taxable\s+Value(?:\s+RS\.?)?/i, 140, { ignoreImt: false });
    const gross = amountAfterLabel(page, /Gross\s+Premium\s+Payable(?:\s+Rs\.?)?/i, 140, { ignoreImt: false });
    if (net !== null && gross !== null && gross >= net) {
      return {
        net: { value: net, page: pageIndex + 1, evidence: "Premium/Taxable Value OCR window" },
        tax: { value: round2(gross - net), page: pageIndex + 1, evidence: "Derived from printed net and gross" },
        gross: { value: gross, page: pageIndex + 1, evidence: "Gross Premium Payable OCR window" },
      };
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
function validPremium(value: number) { return value >= 0 && value < 10000000 && !isYear(value); }

function isAnnualPeriod(from: string, upto: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${upto}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  const days = Math.round((end - start) / 86400000);
  return days >= 360 && days <= 370;
}

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
