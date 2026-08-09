import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const VERSION = "iffco_tokio_commercial_motor_v2.3.0";
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

  const totals = findPrintedTotals(cleanPages);
  let netA = findNetPremium(cleanPages, "A", totals.net?.value ?? null);
  let netB = findNetPremium(cleanPages, "B", totals.net?.value ?? null);
  const paired = findPairedNetPremiumRow(cleanPages, totals.net?.value ?? null);
  netA ??= paired?.a ?? null;
  netB ??= paired?.b ?? null;

  const cpa = findOwnerDriverPremium(cleanPages);
  const section2 = findSection2Premium(cleanPages);
  const fallbackTp = netB ? null : findFallbackTpExcludingCpa(cleanPages, totals.net?.value ?? null);

  const cpaValue = cpa?.value ?? 0;
  const section2Value = section2?.value ?? 0;
  let normalizedOd = netA ? round2(netA.value + section2Value) : null;
  let normalizedTp = netB
    ? round2(Math.max(0, netB.value - cpaValue))
    : fallbackTp
      ? round2(fallbackTp.value)
      : null;

  if (totals.net && normalizedTp !== null && normalizedOd === null && cpa) {
    const recovered = round2(totals.net.value - normalizedTp - cpaValue);
    if (isPlausibleComponent(recovered, totals.net.value)) normalizedOd = recovered;
  }
  if (totals.net && normalizedOd !== null && normalizedTp === null && cpa) {
    const recovered = round2(totals.net.value - normalizedOd - cpaValue);
    if (isPlausibleComponent(recovered, totals.net.value)) normalizedTp = recovered;
  }

  if (totals.net && netB && (!netA || (section2Value === 0 && !close(round2(netA.value + netB.value), totals.net.value)))) {
    const recoveredOd = round2(totals.net.value - netB.value);
    if (isPlausibleComponent(recoveredOd, totals.net.value)) normalizedOd = recoveredOd;
  }

  const declarationConflict = cpaValue > 0 && hasCpaDeclarationConflict(cleanPages);

  if (normalizedOd !== null && isPlausibleComponent(normalizedOd, totals.net?.value ?? null)) {
    const evidence = netA
      ? section2Value > 0 && section2
        ? `${netA.evidence} | OD add-on/Section 2 premium ${money(section2Value)} (${section2.evidence})`
        : netA.evidence
      : totals.net && normalizedTp !== null
        ? `${totals.net.evidence} | OD recovered by printed-net reconciliation`
        : "OD recovered by IFFCO accounting reconciliation";
    setField(fields, "od_premium", "OD premium", money(normalizedOd), netA ? .99 : .9, netA?.page ?? totals.net?.page ?? null, evidence);
  }

  if (normalizedTp !== null && isPlausibleComponent(normalizedTp, totals.net?.value ?? null)) {
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

function findNetPremium(pages: string[], side: "A" | "B", printedNet: number | null): Hit | null {
  const label = new RegExp(`Net\\s*\\(\\s*${side}\\s*\\)|Net\\s*${side}`, "i");
  const direct = new RegExp(`(?:Net\\s*\\(\\s*${side}\\s*\\)|Net\\s*${side})[ \\t]*[:\\-]?[ \\t]*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)`, "i");
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const match = page.match(direct);
    if (match) {
      const value = number(match[1]);
      if (isPlausibleComponent(value, printedNet)) return { value, page: pageIndex + 1, evidence: match[0] };
    }

    const labelMatch = label.exec(page);
    if (!labelMatch || labelMatch.index === undefined) continue;
    const around = page.slice(Math.max(0, labelMatch.index - 120), labelMatch.index + labelMatch[0].length + 120);
    const opposite = side === "A" ? /Net\s*\(\s*B\s*\)|Net\s*B/i : /Net\s*\(\s*A\s*\)|Net\s*A/i;
    if (opposite.test(around)) continue;
    const after = page.slice(labelMatch.index + labelMatch[0].length, labelMatch.index + labelMatch[0].length + 100);
    const candidates = amounts(after).filter((value) => isPlausibleComponent(value, printedNet));
    if (candidates.length) return { value: candidates[0], page: pageIndex + 1, evidence: `${labelMatch[0]} ${after.slice(0, 80)}`.trim() };
  }
  return null;
}

function findPairedNetPremiumRow(pages: string[], printedNet: number | null): { a: Hit; b: Hit } | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const aMatch = /Net\s*\(\s*A\s*\)/i.exec(page);
    const bMatch = /Net\s*\(\s*B\s*\)/i.exec(page);
    if (!aMatch || !bMatch || aMatch.index === undefined || bMatch.index === undefined) continue;

    const firstIndex = Math.min(aMatch.index, bMatch.index);
    const secondEnd = Math.max(aMatch.index + aMatch[0].length, bMatch.index + bMatch[0].length);
    if (secondEnd - firstIndex > 220) continue;

    const sourceWindow = page.slice(secondEnd, secondEnd + 300);
    const candidates = amounts(sourceWindow).filter((value) => isPlausibleComponent(value, printedNet));
    const pair = choosePlausiblePair(candidates, printedNet);
    if (pair) {
      return {
        a: { value: pair[0], page: pageIndex + 1, evidence: page.slice(firstIndex, Math.min(page.length, secondEnd + 220)) },
        b: { value: pair[1], page: pageIndex + 1, evidence: page.slice(firstIndex, Math.min(page.length, secondEnd + 220)) },
      };
    }
  }
  return null;
}

function findOwnerDriverPremium(pages: string[]): Hit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const tableStart = page.search(/A\.\s*Own\s+Damage|Basic\s+TP\s+Premium|Third\s+Party\s*\(Rs\.?\)/i);
    const tableEndMatch = /Co-Insurance|Premium\/Taxable|Gross\s+Premium|Net\s*\(\s*B\s*\)/i.exec(tableStart >= 0 ? page.slice(tableStart) : page);
    const segmentStart = tableStart >= 0 ? tableStart : 0;
    const segmentEnd = tableEndMatch?.index !== undefined ? segmentStart + tableEndMatch.index + 260 : Math.min(page.length, segmentStart + 2600);
    const segment = page.slice(segmentStart, segmentEnd);
    const regex = /P\.?A\.?\s+Owner[-\s]*Driver/gi;
    let match: RegExpExecArray | null;
    let zeroHit: Hit | null = null;

    while ((match = regex.exec(segment))) {
      const absoluteIndex = segmentStart + (match.index ?? 0);
      const rawWindow = page.slice(absoluteIndex, absoluteIndex + 420);
      const nextRow = rawWindow.slice(match[0].length).search(/\b(?:Legal\s+Liability|Hire\s+Reward|LL\s+to|PA\s+to\s+Passenger|Net\s*\(|Basic\s+TP)/i);
      const window = nextRow >= 0 ? rawWindow.slice(0, match[0].length + nextRow) : rawWindow;
      const cleaned = window.replace(/\(\s*IMT\s*\d+\s*\)/gi, " ").replace(/\bIMT\s*\d+\b/gi, " ");
      const values = amounts(cleaned).filter((value) => value >= 0 && value <= 1500000 && !isYear(value));
      const coverageIndex = values.findIndex((value) => value >= 100000);
      const premiumCandidates = coverageIndex >= 0
        ? values.slice(coverageIndex + 1).filter((value) => value >= 0 && value <= 5000)
        : values.filter((value) => value >= 0 && value <= 5000);
      const positive = premiumCandidates.find((value) => value > 0);
      if (positive !== undefined) return { value: positive, page: pageIndex + 1, evidence: window };
      if (premiumCandidates.includes(0) && !zeroHit) zeroHit = { value: 0, page: pageIndex + 1, evidence: window };
    }

    if (zeroHit) return zeroHit;
  }
  return null;
}

function findFallbackTpExcludingCpa(pages: string[], printedNet: number | null): Hit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const basic = amountAfterLabel(page, /Basic\s+TP\s+Premium/i, 120, { ignoreImt: false });
    if (basic === null || basic <= 0 || !isPlausibleComponent(basic, printedNet)) continue;

    const legalDriver = amountAfterLabel(page, /Legal\s+Liability\s+to\s+Driver/i, 130, { ignoreImt: true }) ?? 0;
    const value = round2(basic + Math.max(0, legalDriver));
    if (!isPlausibleComponent(value, printedNet)) continue;
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
  const values = amounts(window).filter((value) => value >= 0 && value <= 250000 && !isYear(value) && value !== 997134);
  return values.length ? values[0] : null;
}

function findSection2Premium(pages: string[]): Hit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    if (!/Premium\s+Bifurcation/i.test(page) || !/Section\s*2\s*\(Rs\.?\)/i.test(page)) continue;
    const match = page.match(/Premium\s+Bifurcation[\s\S]{0,300}?Section\s*1\s*\(Rs\.?\)\s+Section\s*2\s*\(Rs\.?\)[\s\S]{0,260}?\n?\s*([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)/i);
    if (match) {
      const value = number(match[2]);
      if (value >= 0 && value < 250000) return { value, page: pageIndex + 1, evidence: match[0] };
    }
  }
  return null;
}

function findPrintedTotals(pages: string[]): { net: Hit | null; tax: Hit | null; gross: Hit | null } {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const totalRow = page.match(/GST\s+Details[\s\S]{0,650}?\bTotal\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)/i);
    if (totalRow) {
      const net = number(totalRow[1]);
      const tax = number(totalRow[2]);
      const gross = number(totalRow[3]);
      if (isPlausiblePrintedTotals(net, tax, gross)) {
        return { net: hit(totalRow[1], pageIndex, totalRow[0]), tax: hit(totalRow[2], pageIndex, totalRow[0]), gross: hit(totalRow[3], pageIndex, totalRow[0]) };
      }
    }

    const netMatch = page.match(/Premium\/Taxable\s+Value\s+RS\.?\s*([0-9,.]+)/i);
    const grossMatch = page.match(/Gross\s+Premium\s+Payable\s+Rs\.?\s*([0-9,.]+)/i);
    if (netMatch && grossMatch) {
      const net = number(netMatch[1]);
      const gross = number(grossMatch[1]);
      const tax = round2(gross - net);
      if (isPlausiblePrintedTotals(net, tax, gross)) {
        return {
          net: { value: net, page: pageIndex + 1, evidence: netMatch[0] },
          tax: { value: tax, page: pageIndex + 1, evidence: `${netMatch[0]} | ${grossMatch[0]}` },
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

function choosePlausiblePair(values: number[], printedNet: number | null): [number, number] | null {
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      const a = values[i];
      const b = values[j];
      if (!isPlausibleComponent(a, printedNet) || !isPlausibleComponent(b, printedNet)) continue;
      if (printedNet !== null && round2(a + b) > printedNet + TOLERANCE) continue;
      if (a <= 5 && b > 50000) continue;
      return [a, b];
    }
  }
  return null;
}

function isPlausibleComponent(value: number, printedNet: number | null) {
  if (!Number.isFinite(value) || value < 0 || value > 250000 || isYear(value) || value === 997134) return false;
  if (printedNet !== null && value > printedNet + TOLERANCE) return false;
  return true;
}

function isPlausiblePrintedTotals(net: number, tax: number, gross: number) {
  if (![net, tax, gross].every(Number.isFinite)) return false;
  if (net <= 0 || gross < net || tax < 0 || net > 1000000 || gross > 1500000) return false;
  return close(round2(net + tax), gross);
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
