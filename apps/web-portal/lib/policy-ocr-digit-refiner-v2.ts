import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const VERSION = "digit_commercial_motor_v1.4.0";
const MONEY_RE = /[0-9][0-9,]*(?:\.[0-9]{1,2})?/g;

type MoneyHit = { value: number; page: number; evidence: string };

export function refineDigitCommercialPolicyV2(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  const cleanPages = pages.map(sanitize);
  const text = cleanPages.join("\n");
  const upper = text.toUpperCase();
  if (!upper.includes("GO DIGIT GENERAL INSURANCE") && !upper.includes("DIGIT COMMERCIAL VEHICLE")) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const warnings = parsed.warnings.filter((warning) => !/Digit premium cross-check|Missing or uncertain Digit fields/i.test(warning));

  setField(fields, "insurer_name", "Insurance company", "Go Digit General Insurance Limited", .99, 1, "Go Digit General Insurance Ltd.");

  if (/DIGIT\s+COMMERCIAL\s+VEHICLE\s+(?:COMPREHENSIVE|PACKAGE)\s+POLICY/i.test(upper)) {
    setField(fields, "policy_product", "Policy product", "Package", .99, 1, "Digit Commercial Vehicle Comprehensive Policy");
  } else if (/\b(?:STANDALONE|STAND\s+ALONE)\s+(?:OWN\s+DAMAGE|OD)|\bSAOD\b/i.test(upper)) {
    setField(fields, "policy_product", "Policy product", "SAOD", .99, 1, "Digit standalone own-damage policy");
  } else if (/\b(?:LIABILITY\s+ONLY|ACT\s+ONLY|THIRD\s+PARTY)\b/i.test(upper)) {
    setField(fields, "policy_product", "Policy product", "Third Party", .99, 1, "Digit liability / third-party policy");
  }

  const idv = findDigitIdv(cleanPages);
  const currentIdv = numeric(fields.get("idv"));
  if (idv) {
    setField(fields, "idv", "IDV / Sum insured", money(idv.value), .99, idv.page, idv.evidence);
  } else if (currentIdv !== null && currentIdv >= 1900 && currentIdv <= 2100) {
    fields.delete("idv");
    warnings.push("Digit IDV was rejected because the extracted value looked like a manufacturing year. Review the IDV field.");
  }

  const odDirect = findDirectPremium(cleanPages, /Own\s*Damage\s*Premium/i, "od");
  const tpDirect = findDirectPremium(cleanPages, /Basic\s*Third[-\s]*Party\s*Liability/i, "tp");
  const cpa = findCpa(cleanPages);

  if (odDirect) setField(fields, "od_premium", "OD premium", money(odDirect.value), .99, odDirect.page, odDirect.evidence);
  if (tpDirect) setField(fields, "tp_premium", "Third party premium", money(tpDirect.value), .99, tpDirect.page, tpDirect.evidence);
  if (cpa) {
    setField(fields, "cpa_opted", "CPA opted", cpa.value > 0 ? "Yes" : "No", .99, cpa.page, cpa.evidence);
    setField(fields, "cpa_premium", "CPA amount", money(cpa.value), .99, cpa.page, cpa.evidence);
  }

  const invoice = findInvoice(cleanPages);
  if (invoice) {
    setField(fields, "total_premium", "Printed net premium", money(invoice.net), .99, invoice.page, invoice.evidence);
    setField(fields, "tax_amount", "Printed GST", money(invoice.tax), .99, invoice.page, invoice.evidence);
    setField(fields, "gross_premium", "Printed gross premium", money(invoice.gross), .99, invoice.page, invoice.evidence);
  }

  let od = numeric(fields.get("od_premium"));
  let tp = numeric(fields.get("tp_premium"));
  const cpaValue = numeric(fields.get("cpa_premium")) ?? 0;
  const net = numeric(fields.get("total_premium"));

  if ((od === null || od <= 0) && net !== null && net > 0 && tp !== null && tp >= 0) {
    const derived = round2(net - tp - cpaValue);
    if (derived > 0) {
      setField(fields, "od_premium", "OD premium", money(derived), .95, invoice?.page ?? tpDirect?.page ?? 1, "Derived from Digit printed Net Premium minus TP and CPA after direct OD extraction was unavailable.");
      warnings.push("Digit OD premium was recovered using the printed net premium cross-check. Verify once against the policy schedule.");
      od = derived;
    }
  }
  if ((tp === null || tp <= 0) && net !== null && net > 0 && od !== null && od >= 0) {
    const derived = round2(net - od - cpaValue);
    if (derived > 0) {
      setField(fields, "tp_premium", "Third party premium", money(derived), .95, invoice?.page ?? odDirect?.page ?? 1, "Derived from Digit printed Net Premium minus OD and CPA after direct TP extraction was unavailable.");
      warnings.push("Digit TP premium was recovered using the printed net premium cross-check. Verify once against the policy schedule.");
      tp = derived;
    }
  }

  if (od !== null && tp !== null && net !== null) {
    const calculated = round2(od + tp + cpaValue);
    if (Math.abs(calculated - net) > 1) {
      warnings.push(`Digit premium cross-check failed: OD + TP + CPA = ${money(calculated)}, while printed net premium = ${money(net)}.`);
    }
  }

  const tax = numeric(fields.get("tax_amount"));
  const gross = numeric(fields.get("gross_premium"));
  if (net !== null && tax !== null && gross !== null && Math.abs(round2(net + tax) - gross) > 1) {
    warnings.push("Digit printed net premium + GST does not match printed gross premium. Review the invoice values.");
  }

  const required = ["policy_product", "idv", "od_premium", "tp_premium", "policy_number", "insurer_name", "policy_start_date", "policy_end_date"];
  const missing = required.filter((key) => !fields.get(key)?.value?.trim());
  if (missing.length) warnings.push(`Review required. Missing or uncertain Digit fields: ${missing.join(", ")}.`);

  return { ...parsed, parserId: "digit_commercial_motor_v1", parserVersion: VERSION, fields: [...fields.values()], warnings };
}

function findDigitIdv(pages: string[]): MoneyHit | null {
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const start = page.search(/YOUR\s+VEHICLE\s+IDV/i);
    if (start < 0) continue;
    const tail = page.slice(start);
    const end = tail.search(/OWN\s+DAMAGE\s+PREMIUM/i);
    const block = end > 0 ? tail.slice(0, end) : tail.slice(0, 1800);

    const totalLabel = block.search(/TOTAL\s+IDV/i);
    const focused = totalLabel >= 0 ? block.slice(totalLabel, Math.min(block.length, totalLabel + 800)) : block;
    const candidates = numbers(focused).filter(isPlausibleIdv);
    if (candidates.length) return { value: Math.max(...candidates), page: index + 1, evidence: focused.slice(0, 700) };

    const fallback = numbers(block).filter(isPlausibleIdv);
    if (fallback.length) return { value: Math.max(...fallback), page: index + 1, evidence: block.slice(0, 700) };
  }
  return null;
}

function findDirectPremium(pages: string[], label: RegExp, kind: "od" | "tp"): MoneyHit | null {
  const min = kind === "od" ? 100 : 100;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const matches = [...page.matchAll(new RegExp(label.source, "gi"))];
    const hits: Array<{ distance: number; value: number; evidence: string }> = [];
    for (const match of matches) {
      const start = match.index ?? 0;
      const after = page.slice(start + match[0].length, start + match[0].length + 220);
      if (/^\s*\[[AB]\]/i.test(after)) continue;
      const amountMatch = after.match(/[₹`Rs.()\s:=/-]*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
      if (!amountMatch) continue;
      const value = parseMoney(amountMatch[1]);
      if (value === null || value < min || value > 10000000 || isYear(value)) continue;
      hits.push({ distance: amountMatch.index ?? 999, value, evidence: page.slice(start, start + Math.min(260, match[0].length + after.length)) });
    }
    if (hits.length) {
      hits.sort((a, b) => a.distance - b.distance);
      return { value: hits[0].value, page: pageIndex + 1, evidence: hits[0].evidence };
    }
  }

  const premiumBlock = findPremiumBlock(pages);
  if (!premiumBlock) return null;
  const pattern = kind === "od"
    ? /Own\s*Damage\s*Premium[\s\S]{0,120}?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i
    : /Basic\s*Third[-\s]*Party\s*Liability[\s\S]{0,120}?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;
  const matched = premiumBlock.text.match(pattern);
  const value = parseMoney(matched?.[1]);
  return value !== null && value >= min && !isYear(value)
    ? { value, page: premiumBlock.page, evidence: matched?.[0] ?? premiumBlock.text.slice(0, 400) }
    : null;
}

function findPremiumBlock(pages: string[]) {
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const start = page.search(/OWN\s+DAMAGE\s+PREMIUM\s*\[A\]/i);
    if (start < 0) continue;
    const tail = page.slice(start);
    const end = tail.search(/\bNote\s*:/i);
    return { page: index + 1, text: end > 0 ? tail.slice(0, end) : tail.slice(0, 1800) };
  }
  return null;
}

function findCpa(pages: string[]): MoneyHit | null {
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const match = page.match(/PA\s*cover\s*for\s*Owner[-\s]*Driver([\s\S]{0,120})/i);
    if (!match) continue;
    const evidence = match[0];
    if (/(?:--|NIL|\bNA\b)/i.test(match[1])) return { value: 0, page: index + 1, evidence };
    const amount = match[1].match(/([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);
    const value = parseMoney(amount?.[1]);
    if (value !== null && value >= 0 && value <= 100000) return { value, page: index + 1, evidence };
  }
  return { value: 0, page: 1, evidence: "No payable PA cover for Owner-Driver identified" };
}

function findInvoice(pages: string[]): { net: number; tax: number; gross: number; page: number; evidence: string } | null {
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const header = page.search(/Invoice\s+Number\s+Invoice\s+Date\s+Net\s+Premium/i);
    if (header < 0) continue;
    const window = page.slice(header, header + 1200);
    const row = window.match(/\b[A-Z]{1,5}\d{5,}\s+(\d{4}-\d{2}-\d{2})\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)\s+([0-9,.]+)/i);
    if (row) {
      const values = row.slice(2, 9).map((item) => parseMoney(item));
      if (values.every((item): item is number => item !== null)) {
        const [net, igst, cgst, sgst, utgst, cess, gross] = values;
        return { net, tax: round2(igst + cgst + sgst + utgst + cess), gross, page: index + 1, evidence: row[0] };
      }
    }
  }
  return null;
}

function setField(fields: Map<string, ParsedPolicyField>, key: string, label: string, value: string, confidence: number, page: number | null, evidence: string) {
  if (!value.trim()) return;
  fields.set(key, { key, label, value: value.trim(), confidence, page, evidence: sanitize(evidence).slice(0, 500) });
}

function numbers(value: string) {
  return [...value.matchAll(MONEY_RE)].map((match) => parseMoney(match[0])).filter((item): item is number => item !== null);
}

function isPlausibleIdv(value: number) {
  return value >= 10000 && value <= 1000000000 && !isYear(value);
}

function isYear(value: number) {
  return Number.isInteger(value) && value >= 1900 && value <= 2100;
}

function numeric(field: ParsedPolicyField | undefined) {
  return field ? parseMoney(field.value) : null;
}

function parseMoney(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number) {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sanitize(value: string) {
  return value.replace(/\u00ad/g, "").replace(/[–—]/g, "-").replace(/\r/g, "").split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}
