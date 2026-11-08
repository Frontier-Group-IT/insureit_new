import type { ParsedPolicyField, ParsedPolicyResult } from "./policy-ocr-parsers";

const DATE = String.raw`([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})`;
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Add verified, previously missing/incorrect ICICI 3005 bundled two-wheeler
 * values from LOCAL PDF text. This never modifies the already-working vehicle
 * identity, IDV, OD premium, CPA amount or policy number extractors.
 */
export function refineIcici3005OutstandingFields(
  nativePages: string[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (parsed.parserId !== "icici_lombard_motor_v1") return parsed;
  const page1 = nativePages[0] ?? "";
  const page2 = nativePages[1] ?? "";
  if (!/ICICI\s+LOMBARD/i.test(page1)
    || !/Product\s+Code\s*:\s*3005\b/i.test(page1)
    || !/Bundled\s*[-–—]?\s*Two\s+Wheeler\s+Policy/i.test(page1 + "\n" + page2)) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const lines1 = page1.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lines2 = page2.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let changed = false;

  function setWhen(key: string, label: string, value: string | null, page: number, evidence: string, override = false) {
    if (!value) return;
    const prior = fields.get(key);
    if (prior?.value?.trim() === value) return;
    if (prior?.value?.trim() && !override) return;
    fields.set(key, { key, label, value, confidence: .995, page, evidence } satisfies ParsedPolicyField);
    changed = true;
  }

  // RTO City has previously been misread literally as "City".
  const rtoLine = lines1.find((line) => /^RTO\s+City\s*:?/i.test(line));
  const rto = rtoLine?.match(/^RTO\s+City\s*:?\s+([A-Z][A-Z .]+[-–][A-Z][A-Z .-]+)$/i)?.[1]?.trim() ?? null;
  const existingRto = fields.get("vehicle_rto_name")?.value?.trim() ?? "";
  if (rto) {
    setWhen("vehicle_rto_name", "RTO name", rto, 1,
      "ICICI RTO City label on risk-assumption page",
      !existingRto || /^(?:RTO\s*)?(?:City|Location)$/i.test(existingRto));
  }

  // Bundled product: one-year Own Damage dates are the policy onboarding
  // validity, NOT the five-year third-party coverage end date.
  const odLine = lines1.find((line) => /^Period\s+of\s+Insurance\s*[-–]?\s*Own\s+Damage\b/i.test(line));
  const datePattern = new RegExp(DATE + String.raw`\s+to\s+` + DATE, "i");
  const dates = odLine?.match(datePattern);
  const start = isoDate(dates?.[1]);
  const end = isoDate(dates?.[2]);
  if (start && end && Date.parse(start) < Date.parse(end)) {
    setWhen("policy_start_date", "Valid from", start, 1, "ICICI Own Damage period start");
    setWhen("policy_end_date", "Valid upto", end, 1, "ICICI Own Damage period end");
  }

  // Document A+B totals include the CPA premium in section B. TP premium in
  // the portal is the BASIC third-party liability amount, NOT total B.
  const tp = labelledMoney(lines2, /Basic\s+Third\s+Party\s+Liability/i);
  const liabilityTotal = labelledMoney(lines2, /Total\s+Liability\s+Premium\s*\(\s*B\s*\)/i);
  const net = labelledMoney(lines2, /Total\s+Package\s+Premium\s*\(\s*A\s*\+\s*B\s*\)/i);
  const tax = labelledMoney(lines2, /Total\s+Tax\s+Payable(?:\s+in)?/i);
  const gross = labelledMoney(lines2, /Total\s+Premium\s+Payable(?:\s+in)?/i);
  const od = number(fields.get("od_premium")?.value)
    ?? labelledMoney(lines2, /Total\s+Own\s+Damage\s+Premium\s*\(\s*A\s*\)/i);
  const cpa = number(fields.get("cpa_premium")?.value);
  const liabilityReconciles = tp != null && cpa != null && liabilityTotal != null
    && close(tp + cpa, liabilityTotal);
  const netReconciles = tp != null && cpa != null && od != null && net != null
    && close(od + tp + cpa, net);
  if (tp != null && tp > 0 && (liabilityReconciles || netReconciles)) {
    const existing = number(fields.get("tp_premium")?.value);
    setWhen("tp_premium", "Third party premium", String(tp), 2,
      "ICICI Basic Third Party Liability; reconciled with section B/net",
      existing == null || !close(existing, tp));
  }

  // Only repair printed money figures when the three explicitly labelled
  // totals reconcile. Do not infer amounts from stray table/IGST percentages.
  if (net != null && tax != null && gross != null && close(net + tax, gross)) {
    const existingNet = number(fields.get("total_premium")?.value);
    setWhen("total_premium", "Printed net premium", String(net), 2,
      "ICICI Total Package Premium(A+B)", existingNet != null && !close(existingNet, net));
    const existingTax = number(fields.get("tax_amount")?.value);
    setWhen("tax_amount", "Printed GST", String(tax), 2,
      "ICICI Total Tax Payable", existingTax != null && !close(existingTax, tax));
    const existingGross = number(fields.get("gross_premium")?.value);
    setWhen("gross_premium", "Printed gross premium", String(gross), 2,
      "ICICI Total Premium Payable", existingGross != null && !close(existingGross, gross));
  }

  if (!changed) return parsed;
  const warnings = parsed.warnings.flatMap((warning) => {
    const match = warning.match(/^Review required\. Missing or uncertain fields:\s*(.+)\.$/);
    if (!match) return [warning];
    const stillMissing = match[1].split(",").map((key) => key.trim())
      .filter((key) => !fields.get(key)?.value?.trim());
    return stillMissing.length
      ? [`Review required. Missing or uncertain fields: ${stillMissing.join(", ")}.`]
      : [];
  });
  return {
    ...parsed,
    parserVersion: parsed.parserVersion.includes("+icici-3005-outstanding-v1")
      ? parsed.parserVersion : parsed.parserVersion + "+icici-3005-outstanding-v1",
    fields: [...fields.values()],
    warnings,
  };
}

function labelledMoney(lines: string[], label: RegExp): number | null {
  for (let i = 0; i < lines.length; i += 1) {
    const hit = lines[i].match(label);
    if (!hit || hit.index == null) continue;
    const tail = lines[i].slice(hit.index + hit[0].length);
    const sameLine = tail.match(/^[\s:₹\x60()]*([\d,]+(?:\.\d{2})?)(?!\d)/);
    if (sameLine) return number(sameLine[1]);
    // Only accept an unambiguous monetary-only next row.
    const next = lines[i + 1]?.match(/^[\s₹\x60]*([\d,]+\.\d{2})[\s₹\x60]*$/);
    if (next) return number(next[1]);
  }
  return null;
}

function number(value: string | undefined): number | null {
  if (!value || !/^\s*[\d,]+(?:\.\d{1,2})?\s*$/.test(value)) return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function close(a: number, b: number) {
  return Math.abs(a - b) <= 1;
}

function isoDate(value: string | undefined): string | null {
  const m = value?.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/i);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (!month || year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
