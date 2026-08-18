import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const VERSION = "new_india_commercial_motor_v1.3.1";
const MONEY_RE = /[0-9][0-9,]*(?:\.[0-9]{1,2})?/g;

type MoneyHit = { value: number; page: number; evidence: string };
type DatePeriod = { from: string; upto: string; page: number; evidence: string };
type TextHit = { value: string; page: number; evidence: string };

export function refineNewIndiaCommercialPolicy(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  const cleanPages = pages.map(sanitize);
  const text = cleanPages.join("\n");
  const upper = text.toUpperCase();
  if (!upper.includes("THE NEW INDIA ASSURANCE") && !upper.includes("NEW INDIA ASSURANCE COMPANY")) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const warnings = parsed.warnings.filter((warning) => !/New India|Missing or uncertain fields/i.test(warning));

  for (const key of [
    "policy_product", "idv", "od_premium", "tp_premium", "cpa_opted", "cpa_premium",
    "policy_number", "insurer_name", "policy_start_date", "policy_end_date",
    "total_premium", "tax_amount", "gross_premium",
  ]) {
    fields.delete(key);
  }

  setField(fields, "insurer_name", "Insurance company", "The New India Assurance Company Limited", .99, 1, "The New India Assurance Co. Ltd.");

  if (/GOODS\s+CARRYING\s+VEHICLE\s+PACKAGE\s+POLICY/i.test(upper) || /COMMERCIAL\s+VEHICLE\s+PACKAGE\s+POLICY/i.test(upper)) {
    setField(fields, "policy_product", "Policy product", "Package", .99, 1, "Goods Carrying Vehicle Package Policy");
  } else if (/LIABILITY\s+ONLY|ACT\s+ONLY/i.test(upper)) {
    setField(fields, "policy_product", "Policy product", "Third Party", .98, 1, "New India liability-only policy");
  } else if (/STANDALONE\s+OWN\s+DAMAGE|SAOD/i.test(upper)) {
    setField(fields, "policy_product", "Policy product", "SAOD", .98, 1, "New India standalone own-damage policy");
  }

  const policy = findCurrentPolicyNumber(cleanPages);
  if (policy) setField(fields, "policy_number", "Policy number", policy.value, .99, policy.page, policy.evidence);

  const period = findPolicyPeriod(cleanPages);
  if (period) {
    setField(fields, "policy_start_date", "Valid from", period.from, .99, period.page, period.evidence);
    setField(fields, "policy_end_date", "Valid upto", period.upto, .99, period.page, period.evidence);
  }

  const idv = findTotalIdv(cleanPages);
  if (idv) setField(fields, "idv", "IDV / Sum insured", money(idv.value), .99, idv.page, idv.evidence);

  const od =
    findExactRowAmount(cleanPages, /Net\s+Own\s+Damage\s+Premium\s*\(A\)/i, { min: 100, max: 10000000 })
    ?? findFirstRowAmount(cleanPages, /Total\s+OD\s+Premium\s*\(Rs\.?\)?/i, { min: 100, max: 10000000 });
  const liability =
    findExactRowAmount(cleanPages, /Net\s+Liability\s+Premium\s*\(B\)/i, { min: 100, max: 10000000 })
    ?? findFirstRowAmount(cleanPages, /Total\s+TP\s+Premium\s*\(Rs\.?\)?/i, { min: 100, max: 10000000 });
  const cpa = findOwnerDriverCpa(cleanPages);
  const total =
    findExactRowAmount(cleanPages, /Total\s+Premium\s*\(A\s*\+\s*B\)/i, { min: 100, max: 10000000 })
    ?? findFirstRowAmount(cleanPages, /Net\s+Premium\s*\(Rs\.?\)?/i, { min: 100, max: 10000000 });
  const tax =
    findFirstRowAmount(cleanPages, /\bGST\s*\(Rs\.?\)?/i, { min: 0, max: 10000000 })
    ?? findExactRowAmount(cleanPages, /\bIGST\b/i, { min: 0, max: 10000000 });
  const gross =
    findExactRowAmount(cleanPages, /Gross\s+Premium\s+Paid/i, { min: 100, max: 10000000 })
    ?? findFirstRowAmount(cleanPages, /Total\s+Payable\s*\(Rs\.?\)?/i, { min: 100, max: 10000000 });

  const cpaValue = cpa?.value ?? 0;
  if (cpa) {
    setField(fields, "cpa_opted", "CPA opted", cpaValue > 0 ? "Yes" : "No", .99, cpa.page, cpa.evidence);
    setField(fields, "cpa_premium", "CPA amount", money(cpaValue), .99, cpa.page, cpa.evidence);
  } else {
    setField(fields, "cpa_opted", "CPA opted", "No", .82, null, "No payable owner-driver CPA premium row identified");
    setField(fields, "cpa_premium", "CPA amount", "0", .82, null, "No payable owner-driver CPA premium row identified");
  }

  if (od) setField(fields, "od_premium", "OD premium", money(od.value), .99, od.page, od.evidence);

  if (liability) {
    const portalTp = round2(Math.max(0, liability.value - cpaValue));
    setField(
      fields,
      "tp_premium",
      "Third party premium",
      money(portalTp),
      .99,
      liability.page,
      `${liability.evidence} | Portal TP = printed liability/TP premium ${money(liability.value)} minus Owner-Driver CPA ${money(cpaValue)}.`,
    );
  }

  if (total) setField(fields, "total_premium", "Printed net premium", money(total.value), .99, total.page, total.evidence);
  if (tax) setField(fields, "tax_amount", "Printed GST", money(tax.value), .99, tax.page, tax.evidence);
  if (gross) setField(fields, "gross_premium", "Printed gross premium", money(gross.value), .99, gross.page, gross.evidence);

  const odValue = numeric(fields.get("od_premium"));
  const tpValue = numeric(fields.get("tp_premium"));
  const printedNet = total?.value ?? numeric(fields.get("total_premium"));
  if (odValue !== null && tpValue !== null && printedNet !== null) {
    const calculated = round2(odValue + tpValue + cpaValue);
    if (Math.abs(calculated - printedNet) > 1) {
      warnings.push(`New India premium cross-check failed: OD + TP + CPA = ${money(calculated)}, while printed net premium = ${money(printedNet)}.`);
    }
  }

  const printedTax = tax?.value ?? numeric(fields.get("tax_amount"));
  const printedGross = gross?.value ?? numeric(fields.get("gross_premium"));
  if (printedNet !== null && printedTax !== null && printedGross !== null && Math.abs(round2(printedNet + printedTax) - printedGross) > 1) {
    warnings.push("New India printed net premium + tax does not match printed gross/total payable. Review the policy schedule.");
  }

  const required = ["policy_product", "idv", "od_premium", "tp_premium", "policy_number", "insurer_name", "policy_start_date", "policy_end_date"];
  const missing = required.filter((key) => !fields.get(key)?.value?.trim());
  if (missing.length) warnings.push(`Review required. Missing or uncertain New India fields: ${missing.join(", ")}.`);

  return {
    ...parsed,
    parserId: "new_india_motor_v1",
    parserVersion: VERSION,
    fields: [...fields.values()],
    warnings,
  };
}

function findCurrentPolicyNumber(pages: string[]): TextHit | null {
  const candidates = new Map<string, { count: number; page: number; evidence: string; labeled: boolean }>();
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const prev = lines[Math.max(0, lineIndex - 1)] ?? "";
      const next = lines[lineIndex + 1] ?? "";
      const nearby = `${prev} ${line} ${next}`;
      if (/Previous\s+Policy\s+No/i.test(line) || /Previous\s+Policy\s+No/i.test(`${prev} ${line}`)) continue;

      const labeledLine = /Policy\s+No\.?/i.test(line) && !/Previous/i.test(line);
      const labeledNearby = /Policy\s+No\.?/i.test(nearby) && !/Previous\s+Policy\s+No/i.test(nearby);
      for (const match of nearby.matchAll(/\b([0-9]{18,25})\b/g)) {
        const value = match[1];
        const entry = candidates.get(value);
        candidates.set(value, {
          count: (entry?.count ?? 0) + 1,
          page: entry?.page ?? pageIndex + 1,
          evidence: entry?.evidence ?? nearby,
          labeled: Boolean(entry?.labeled || labeledLine || labeledNearby),
        });
      }
    }
  }
  if (!candidates.size) return null;
  const best = [...candidates.entries()].sort((a, b) => {
    if (a[1].labeled !== b[1].labeled) return Number(b[1].labeled) - Number(a[1].labeled);
    return b[1].count - a[1].count;
  })[0];
  return { value: best[0], page: best[1].page, evidence: best[1].evidence };
}

function findPolicyPeriod(pages: string[]): DatePeriod | null {
  const date = "([0-9]{1,2}[-/](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|[0-9]{1,2})[-/][0-9]{2,4})";
  const patterns = [
    new RegExp(`Own\\s+Damage\\s+Period\\s*:?\\s*${date}[\\s\\S]{0,80}?To\\s*${date}`, "i"),
    new RegExp(`Motor\\s+Liability\\s+Period\\s*:?\\s*${date}[\\s\\S]{0,80}?To\\s*${date}`, "i"),
    new RegExp(`Period\\s+of\\s+cover\\s*:?\\s*${date}[\\s\\S]{0,100}?to\\s*${date}`, "i"),
  ];
  for (let index = 0; index < pages.length; index += 1) {
    for (const pattern of patterns) {
      const match = pages[index].match(pattern);
      if (!match) continue;
      const from = isoDate(match[1]);
      const upto = isoDate(match[2]);
      if (from && upto) return { from, upto, page: index + 1, evidence: match[0] };
    }
  }
  return null;
}

function findTotalIdv(pages: string[]): MoneyHit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (!/Total\s+IDV/i.test(line)) continue;
      const combined = `${line}\n${lines[lineIndex + 1] ?? ""}`;
      const values = amounts(combined).filter((value) => value >= 10000 && value <= 1000000000 && !isYear(value));
      if (!values.length) continue;
      const value = Math.max(...values);
      return { value, page: pageIndex + 1, evidence: combined };
    }
  }

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const anchor = page.search(/INSURED\s+DECLARED\s+VALUE/i);
    if (anchor < 0) continue;
    const tail = page.slice(anchor);
    const stop = tail.search(/\n(?:ENHANCED\s+COVER|SCHEDULE\s+OF\s+PREMIUM|BATTERY\s+PROTECT\s+COVER)/i);
    const block = stop > 0 ? tail.slice(0, stop) : tail.slice(0, 1400);
    if (!/Total\s+Value/i.test(block)) continue;
    const values = amounts(block).filter((value) => value >= 10000 && value <= 1000000000 && !isYear(value));
    if (!values.length) continue;
    const value = Math.max(...values);
    return { value, page: pageIndex + 1, evidence: block };
  }
  return null;
}

function findOwnerDriverCpa(pages: string[]): MoneyHit | null {
  const ownerDriver = /(?:PA\s+Cover\s+For|Compulsory\s+PA\s+Premium\s+for)\s+Owner\s*Driver/i;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (!ownerDriver.test(line)) continue;

      const rowParts = [line];
      for (let offset = 1; offset <= 2; offset += 1) {
        const continuation = lines[lineIndex + offset] ?? "";
        if (offset > 1 && ownerDriver.test(continuation)) break;
        rowParts.push(continuation);
      }

      const combined = rowParts.join(" ");
      const direct = amounts(combined).filter((value) => value > 20 && value <= 5000 && !isYear(value));
      if (direct.length) return { value: direct[0], page: pageIndex + 1, evidence: combined };

      const standalone: { value: number; evidence: string }[] = [];
      for (let offset = 1; offset <= 20; offset += 1) {
        const continuation = lines[lineIndex + offset] ?? "";
        if (/Calculated\s+(?:OD|TP)\s+Premium|Total\s+(?:OD|TP)\s+Premium/i.test(continuation)) break;
        const match = continuation.match(/^\s*(?:Rs\.?\s*)?([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*$/i);
        if (!match) continue;
        const value = parseMoney(match[1]);
        if (value !== null && value > 20 && value <= 5000) standalone.push({ value, evidence: continuation });
      }
      if (standalone.length) {
        return { value: standalone[0].value, page: pageIndex + 1, evidence: `${line} | ${standalone[0].evidence}` };
      }
    }
  }
  return null;
}

function findFirstRowAmount(
  pages: string[],
  label: RegExp,
  limits: { min: number; max: number },
): MoneyHit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n");
    for (const line of lines) {
      const match = line.match(label);
      if (!match || match.index === undefined) continue;
      const after = line.slice(match.index + match[0].length);
      const candidates = amounts(after).filter((value) => value >= limits.min && value <= limits.max && !isYear(value));
      if (!candidates.length) continue;
      return { value: candidates[0], page: pageIndex + 1, evidence: line };
    }
  }
  return null;
}

function findExactRowAmount(
  pages: string[],
  label: RegExp,
  limits: { min: number; max: number },
): MoneyHit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n");
    for (const line of lines) {
      const match = line.match(label);
      if (!match || match.index === undefined) continue;
      const after = line.slice(match.index + match[0].length);
      const candidates = amounts(after).filter((value) => value >= limits.min && value <= limits.max && !isYear(value));
      if (!candidates.length) continue;
      return { value: candidates[candidates.length - 1], page: pageIndex + 1, evidence: line };
    }
  }
  return null;
}

function amounts(value: string): number[] {
  return [...value.matchAll(MONEY_RE)]
    .map((match) => parseMoney(match[0]))
    .filter((item): item is number => item !== null);
}

function setField(fields: Map<string, ParsedPolicyField>, key: string, label: string, value: string, confidence: number, page: number | null, evidence: string) {
  if (!value.trim()) return;
  fields.set(key, { key, label, value: value.trim(), confidence, page, evidence: sanitize(evidence).slice(0, 600) });
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

function isYear(value: number) {
  return Number.isInteger(value) && value >= 1900 && value <= 2100;
}

function isoDate(value: string): string | null {
  const match = value.trim().toUpperCase().match(/^(\d{1,2})[-/](\d{1,2}|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[-/](\d{2,4})$/);
  if (!match) return null;
  const months: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  const day = Number(match[1]);
  const month = /^[A-Z]{3}$/.test(match[2]) ? months[match[2]] : Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  if (!month || day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sanitize(value: string) {
  return value
    .replace(/\u00ad/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
