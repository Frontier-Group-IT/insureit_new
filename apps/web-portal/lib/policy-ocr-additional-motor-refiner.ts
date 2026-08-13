import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const VERSION = "additional_motor_v1.0.0";
const MONEY_RE = /[0-9][0-9,]*(?:\.[0-9]{1,2})?/g;
const DATE_RE = "((?<![0-9])[0-9]{1,2}[-/](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|[0-9]{1,2})[-/][0-9]{2,4})";

type MoneyHit = { value: number; page: number; evidence: string };
type DatePeriod = { from: string; upto: string; page: number; evidence: string };
type TextHit = { value: string; page: number; evidence: string };

const INSURERS: Record<string, { name: string; version: string }> = {
  shriram_motor_v1: { name: "Shriram General Insurance Company Limited", version: "shriram_motor_v1.1.0" },
  oriental_motor_v1: { name: "The Oriental Insurance Company Limited", version: "oriental_motor_v1.1.0" },
  national_motor_v1: { name: "National Insurance Company Limited", version: "national_motor_v1.1.0" },
  universal_sompo_motor_v1: { name: "Universal Sompo General Insurance Company Limited", version: "universal_sompo_motor_v1.1.0" },
  united_india_motor_v1: { name: "United India Insurance Company Limited", version: "united_india_motor_v1.1.0" },
};

export function refineAdditionalMotorPolicy(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  const config = INSURERS[parsed.parserId];
  if (!config) return parsed;

  const cleanPages = pages.map(sanitize);
  const text = cleanPages.join("\n");
  const upper = text.toUpperCase();
  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const warnings = parsed.warnings.filter((warning) => !/Missing or uncertain fields|not fully supported/i.test(warning));

  for (const key of [
    "policy_product", "idv", "od_premium", "tp_premium", "cpa_opted", "cpa_premium",
    "policy_number", "insurer_name", "policy_start_date", "policy_end_date",
    "total_premium", "tax_amount", "gross_premium",
  ]) {
    fields.delete(key);
  }

  setField(fields, "insurer_name", "Insurance company", config.name, .99, 1, config.name);

  const product = findProduct(upper, parsed.parserId);
  if (product) setField(fields, "policy_product", "Policy product", product.value, .98, 1, product.evidence);

  const policy = findPolicyNumber(cleanPages);
  if (policy) setField(fields, "policy_number", "Policy number", policy.value, .98, policy.page, policy.evidence);

  const period = findPeriod(cleanPages);
  if (period) {
    setField(fields, "policy_start_date", "Valid from", period.from, .98, period.page, period.evidence);
    setField(fields, "policy_end_date", "Valid upto", period.upto, .98, period.page, period.evidence);
  }

  const idv = findIdv(cleanPages);
  if (idv) setField(fields, "idv", "IDV / Sum insured", money(idv.value), .98, idv.page, idv.evidence);

  const cpa = findCpa(cleanPages);
  const cpaValue = cpa?.value ?? 0;
  setField(fields, "cpa_opted", "CPA opted", cpaValue > 0 ? "Yes" : "No", cpa ? .97 : .84, cpa?.page ?? null, cpa?.evidence ?? "No payable owner-driver CPA premium identified");
  setField(fields, "cpa_premium", "CPA amount", money(cpaValue), cpa ? .97 : .84, cpa?.page ?? null, cpa?.evidence ?? "No payable owner-driver CPA premium identified");

  const total = findTotalPremium(cleanPages, parsed.parserId);
  let tax = findTax(cleanPages);
  const gross = findGross(cleanPages);
  if (!tax && total && gross && gross.value > total.value) {
    tax = {
      value: round2(gross.value - total.value),
      page: gross.page,
      evidence: `Derived printed GST from gross premium ${money(gross.value)} minus printed net premium ${money(total.value)}.`,
    };
  }
  if (total) setField(fields, "total_premium", "Printed net premium", money(total.value), .98, total.page, total.evidence);
  if (tax) setField(fields, "tax_amount", "Printed GST", money(tax.value), .96, tax.page, tax.evidence);
  if (gross) setField(fields, "gross_premium", "Printed gross premium", money(gross.value), .96, gross.page, gross.evidence);

  const od = findOwnDamagePremium(cleanPages, parsed.parserId);
  const liability = findLiabilityPremium(cleanPages, parsed.parserId);
  const printedNet = total?.value ?? null;

  if (od && liability && printedNet !== null) {
    const portalTp = normalizeTp(liability.value, cpaValue, printedNet, od.value);
    const calculated = round2(od.value + portalTp + cpaValue);
    if (Math.abs(calculated - printedNet) <= 1) {
      setField(fields, "od_premium", "OD premium", money(od.value), .98, od.page, od.evidence);
      setField(
        fields,
        "tp_premium",
        "Third party premium",
        money(portalTp),
        .98,
        liability.page,
        portalTp === liability.value
          ? liability.evidence
          : `${liability.evidence} | Portal TP excludes Owner-Driver CPA ${money(cpaValue)}.`,
      );
    } else {
      warnings.push(`${config.name} premium fields were withheld because OD + TP + CPA did not reconcile to printed net premium.`);
    }
  } else if (printedNet !== null) {
    warnings.push(`${config.name} financial fields require manual review; labeled OD/TP/CPA evidence was incomplete.`);
  }

  const printedTax = numeric(fields.get("tax_amount"));
  const printedGross = numeric(fields.get("gross_premium"));
  if (printedNet !== null && printedTax !== null && printedGross !== null && Math.abs(round2(printedNet + printedTax) - printedGross) > 1) {
    warnings.push(`${config.name} printed net premium + tax does not match printed gross premium.`);
  }

  const required = ["policy_product", "idv", "policy_number", "insurer_name", "policy_start_date", "policy_end_date"];
  const missing = required.filter((key) => !fields.get(key)?.value?.trim());
  if (missing.length) warnings.push(`Review required. Missing or uncertain ${config.name} fields: ${missing.join(", ")}.`);

  return {
    ...parsed,
    parserVersion: config.version || VERSION,
    fields: [...fields.values()],
    warnings,
  };
}

function findProduct(upper: string, parserId: string): TextHit | null {
  if (parserId === "universal_sompo_motor_v1" && /MOTOR\s+PRIVATE\s+CAR\s+-\s+BUNDLED|BUNDLED\s+POLICY/.test(upper)) {
    return { value: "Bundled", page: 1, evidence: "Motor Private Car - Bundled policy" };
  }
  if (/PACKAGE\s+(?:POLICY|PRODUCT)|GOODS\s+CARRYING\s+VEHICLE\s+-\s+PACKAGE|PCV[\s\S]{0,80}?PACKAGE/.test(upper)) {
    return { value: "Package", page: 1, evidence: "Package policy" };
  }
  if (/LIABILITY\s+ONLY|ACT\s+ONLY|THIRD\s+PARTY/.test(upper)) return { value: "Third Party", page: 1, evidence: "Liability / third-party policy" };
  if (/STANDALONE\s+OWN\s+DAMAGE|\bSAOD\b/.test(upper)) return { value: "SAOD", page: 1, evidence: "Standalone own-damage policy" };
  return null;
}

function findPolicyNumber(pages: string[]): TextHit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const nearby = [lines[index - 1] ?? "", lines[index], lines[index + 1] ?? ""].join(" ");
      if (/Previous\s+Policy/i.test(nearby)) continue;
      const match = nearby.match(/Policy\s*(?:No\.?|Number|#)\s*:?\s*([A-Z0-9][A-Z0-9/-]{5,30})/i);
      if (match?.[1]) return { value: compact(match[1]), page: pageIndex + 1, evidence: nearby };
    }
  }
  return null;
}

function findPeriod(pages: string[]): DatePeriod | null {
  const patterns = [
    new RegExp(`FROM\\s+[0-9: ]*(?:HRS\\s+OF|ON|OF)?\\s*${DATE_RE}[\\s\\S]{0,80}?TO\\s+(?:MIDNIGHT\\s+OF|MIDNIGHT\\s+ON)?\\s*${DATE_RE}`, "i"),
    new RegExp(`Period\\s+of\\s+Insurance[\\s\\S]{0,120}?From\\s*${DATE_RE}[\\s\\S]{0,120}?To\\s*${DATE_RE}`, "i"),
    new RegExp(`Policy\\s+Effective\\s+from[\\s\\S]{0,80}?on\\s*${DATE_RE}[\\s\\S]{0,80}?to\\s+midnight\\s+of\\s*${DATE_RE}`, "i"),
    new RegExp(`OWN\\s+DAMAGE[\\s\\S]{0,120}?FROM\\s+OD\\s+[0-9:]*\\s+OF\\s*${DATE_RE}[\\s\\S]{0,80}?TO\\s+MIDNIGHT\\s+OF\\s*${DATE_RE}`, "i"),
    new RegExp(`Effective\\s+date[\\s\\S]{0,160}?from\\s+[0-9: ]+\\s*${DATE_RE}[\\s\\S]{0,80}?to\\s+midnight\\s+of\\s*${DATE_RE}`, "i"),
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

function findIdv(pages: string[]): MoneyHit | null {
  const labels = [/Total\s+Value/i, /TOTAL\s+IDV/i, /Vehicle\s+IDV/i, /INSURED\s+DECLARED\s+VALUE/i];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (!labels.some((label) => label.test(lines[index]))) continue;
      const evidence = lines.slice(index, index + 3).join(" ");
      const candidates = amounts(evidence).filter((value) => value >= 10000 && value <= 1000000000 && !isYear(value));
      if (candidates.length) return { value: Math.max(...candidates), page: pageIndex + 1, evidence };
    }
  }
  return null;
}

function findOwnDamagePremium(pages: string[], parserId: string): MoneyHit | null {
  const labels = parserId === "universal_sompo_motor_v1"
    ? [/NET\s+OWN\s+DAMAGE\s+PREMIUM/i, /OWN\s+DAMAGE\s+PREMIUM\s*\([AB]\)/i]
    : parserId === "united_india_motor_v1"
      ? [/Gross\s+OD\s*\(A\)/i, /A-OWN\s+DAMAGE[\s\S]{0,80}?Total/i]
      : [/OD\s+TOTAL/i, /MOTOR\s+TOTAL\s+OD/i, /Net\s+Own\s+Damage\s+Premium/i, /Own\s+Damage\s+Premium\s*\(A\)/i];
  return findMoneyAfterLabels(pages, labels, { min: 100, max: 10000000 });
}

function findLiabilityPremium(pages: string[], parserId: string): MoneyHit | null {
  const labels = parserId === "universal_sompo_motor_v1"
    ? [/NET\s+LIABILITY\s+PREMIUM/i, /TOTAL\s+LIABILITY\s+PREMIUM/i, /Basic\s+TP\s+Premium/i]
    : parserId === "united_india_motor_v1"
      ? [/Gross\s+TP\s*\(B\)/i]
      : [/^TP\s+TOTAL/i, /Net\s+Liability\s+Premium/i, /TOTAL\s+LIABILITY\s+PREMIUM/i];
  return findMoneyAfterLabels(pages, labels, { min: 100, max: 10000000 });
}

function findCpa(pages: string[]): MoneyHit | null {
  const labels = [
    /Compulsory\s+PA\s+Cover\s+for\s+Owner\s+Driver/i,
    /P\.A\.\s+Cover\s+under\s+Section\s+III\s+for\s+Owner\s*-\s*Driver/i,
    /PA\s+Cover\s+under\s+Section\s+III\s+for\s+Owner\s*-\s*Driver/i,
    /Owner\s+Driver/i,
    /\bCPA\b/i,
  ];
  const hit = findMoneyAfterLabels(pages, labels, { min: 0, max: 100000 }, (value) => value <= 100000 && !isCoverageLimit(value));
  if (hit) return hit;
  if (pages.join("\n").match(/P\.?A\.?\s+Cover\s+under\s+Section\s+III\s+for\s+Owner\s*-\s*Driver[^\n]{0,80}Rs\.\s*0/i)) {
    return { value: 0, page: 1, evidence: "PA Cover under Section III for Owner-Driver: Rs. 0" };
  }
  return null;
}

function findTotalPremium(pages: string[], parserId: string): MoneyHit | null {
  const labels = parserId === "universal_sompo_motor_v1"
    ? [/TOTAL\s+PACKAGE\s+PREMIUM/i]
    : parserId === "national_motor_v1"
      ? [/Premium\s*(?:₹|Rs\.?)?/i, /TOTAL\s+PREMIUM/i]
      : [/Premium\s*\(A\s*\+\s*B\)/i, /TOTAL\s+PREMIUM/i, /Gross\s+OD\s*&\s*TP/i];
  return findMoneyAfterLabels(pages, labels, { min: 100, max: 10000000 });
}

function findTax(pages: string[]): MoneyHit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n");
    for (const line of lines) {
      const upper = line.toUpperCase();
      const igstIndex = upper.lastIndexOf("IGST");
      const gstIndex = upper.indexOf("GST");
      const labelIndex = igstIndex >= 0 ? igstIndex : gstIndex;
      if (labelIndex < 0) continue;
      const labelLength = igstIndex >= 0 ? 4 : 3;
      const afterLabel = line
        .slice(labelIndex + labelLength)
        .split(/Total\s+Amount|TOTAL\s+POLICY\s+PREMIUM|TOTAL\s+PAYABLE\s+PREMIUM|Gross\s+Premium/i)[0];
      const candidates = amounts(afterLabel).filter((value) => value >= 1 && value <= 10000000 && !isYear(value));
      if (candidates.length) return { value: candidates[candidates.length - 1], page: pageIndex + 1, evidence: line };
    }
  }
  return null;
}

function findGross(pages: string[]): MoneyHit | null {
  return findMoneyAfterLabels(pages, [/TOTAL\s+PAYABLE\s+PREMIUM/i, /Total\s+Amount/i, /TOTAL\s+POLICY\s+PREMIUM/i, /Gross\s+Premium/i, /Premium\s+Amount/i], { min: 100, max: 10000000 });
}

function findMoneyAfterLabels(
  pages: string[],
  labels: RegExp[],
  limits: { min: number; max: number },
  predicate: (value: number) => boolean = () => true,
): MoneyHit | null {
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const matchedLabel = labels.find((label) => label.test(lines[index]));
      if (!matchedLabel) continue;
      const match = lines[index].match(matchedLabel);
      const afterLabel = match?.index === undefined ? lines[index] : lines[index].slice(match.index + match[0].length);
      let evidence = lines[index];
      let candidates = amounts(afterLabel).filter((value) => value >= limits.min && value <= limits.max && !isYear(value) && predicate(value));
      if (!candidates.length && lines[index + 1]) {
        evidence = `${lines[index]} ${lines[index + 1]}`;
        candidates = amounts(lines[index + 1]).filter((value) => value >= limits.min && value <= limits.max && !isYear(value) && predicate(value));
      }
      if (candidates.length) return { value: candidates[candidates.length - 1], page: pageIndex + 1, evidence };
    }
  }
  return null;
}

function normalizeTp(liability: number, cpa: number, net: number, od: number) {
  const direct = round2(liability);
  const excludesCpa = round2(liability - cpa);
  if (Math.abs(round2(od + direct + cpa) - net) <= 1) return direct;
  if (Math.abs(round2(od + excludesCpa + cpa) - net) <= 1) return excludesCpa;
  return direct;
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

function isCoverageLimit(value: number) {
  return value >= 100000;
}

function compact(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9\-/.]/g, "");
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
