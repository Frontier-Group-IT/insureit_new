import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const LABELS: Record<string, string> = {
  insured_name: "Insured name",
  insured_phone: "Phone number",
  vehicle_fuel_type: "Fuel type",
  vehicle_rto_state: "RTO state",
  vehicle_rto_name: "RTO name",
  od_premium: "OD premium",
  tp_premium: "Third party premium",
  cpa_opted: "CPA opted",
  cpa_premium: "CPA amount",
  policy_start_date: "Valid from",
  policy_end_date: "Valid upto",
};

type Fields = Map<string, ParsedPolicyField>;

type MoneyHit = { value: number; page: number; evidence: string };

type PeriodHit = { from: string; upto: string; page: number; evidence: string };

export function refineTataAigVisibleFields(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  const cleanPages = pages.map(sanitize);
  const header = (cleanPages[0] ?? "").split("\n").slice(0, 100).join(" ");
  if (!/TATA\s+AIG\s+GENERAL\s+INSURANCE/i.test(header)) return parsed;
  if (!/BUNDLED\s+AUTO\s+SECURE\s*-?\s*TWO\s+WHEELER|TWO\s+WHEELER\s+POLICY/i.test(cleanPages.join("\n"))) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));

  const insured = findInsuredName(cleanPages);
  if (insured) setField(fields, "insured_name", insured.value, .99, insured.page, insured.evidence);

  const phone = findFullInsuredPhone(cleanPages);
  if (phone) setField(fields, "insured_phone", phone.value, .98, phone.page, phone.evidence);

  const fuel = findText(cleanPages, /Fuel\s+Type\s*[:\-]?\s*(BATTERY|ELECTRIC)/i);
  if (fuel) setField(fields, "vehicle_fuel_type", "Electric", .99, fuel.page, fuel.evidence);

  const rto = findText(cleanPages, /RTO\s+Location\s*[:\-]?\s*([^\n|]{2,50})/i);
  if (rto) {
    setField(fields, "vehicle_rto_name", cleanText(rto.value), .98, rto.page, rto.evidence);
    const state = findRtoStateFromMatchingAddress(cleanPages, cleanText(rto.value));
    if (state) setField(fields, "vehicle_rto_state", state.value, .95, state.page, state.evidence);
  }

  const period = findOwnDamagePeriod(cleanPages);
  if (period) {
    setField(fields, "policy_start_date", period.from, .99, period.page, period.evidence);
    setField(fields, "policy_end_date", period.upto, .99, period.page, period.evidence);
  }

  const cpa = findScheduleOwnerDriverPremium(cleanPages);
  const baseOd = findMoney(cleanPages, /Total\s+Own\s+Damage\s+Premium\s*\(A\)\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  const addOn = findMoney(cleanPages, /Total\s+Add[-\s]*On\s+Premium\s*\(C\)\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  const basicTp = findMoney(cleanPages, /Basic\s+TP\s+Premium\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
  const net = findMoney(cleanPages, /Net\s+Premium\s*\(A\s*\+\s*B\s*\+\s*C\)\s*₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);

  if (cpa) {
    setField(fields, "cpa_opted", cpa.value > 0 ? "Yes" : "No", .99, cpa.page, cpa.evidence);
    setField(fields, "cpa_premium", money(cpa.value), .99, cpa.page, cpa.evidence);
  }

  if (baseOd && basicTp && net && cpa) {
    const od = round2(baseOd.value + (addOn?.value ?? 0));
    if (Math.abs(round2(od + basicTp.value + cpa.value) - net.value) <= 1) {
      setField(fields, "od_premium", money(od), .99, baseOd.page, addOn ? `${baseOd.evidence} | ${addOn.evidence}` : baseOd.evidence);
      setField(fields, "tp_premium", money(basicTp.value), .99, basicTp.page, basicTp.evidence);
    }
  }

  return { ...parsed, fields: [...fields.values()] };
}

function findInsuredName(pages: string[]) {
  for (let index = 0; index < Math.min(pages.length, 6); index += 1) {
    const page = pages[index];
    const match = page.match(/(?:^|\n)(?:Insured\s+Name|Name(?:\s*\(Registered owner of the Motor Vehicle\))?)\s*[:\-]?\s*(Mr\.?|Mrs\.?|Ms\.?)?\s*([^\n|]{2,80})/im);
    if (!match?.[2]) continue;
    const prefix = match[1] ? `${match[1]} ` : "";
    const value = cleanText(`${prefix}${match[2]}`).replace(/\s+(?:Address|Premium Amount).*$/i, "").trim();
    if (value && !/^(NA|N\/A)$/i.test(value)) return { value, page: index + 1, evidence: match[0] };
  }
  return null;
}

function findFullInsuredPhone(pages: string[]) {
  for (let index = 0; index < Math.min(pages.length, 3); index += 1) {
    const page = pages[index];
    const match = page.match(/Contact\s+No\.?\s*[:\-]?\s*(\+?91[ -]?)?([6-9][0-9 -]{9,13})/i);
    if (!match?.[2] || match[0].includes("*")) continue;
    const digits = match[2].replace(/\D/g, "").slice(-10);
    if (/^[6-9]\d{9}$/.test(digits)) return { value: digits, page: index + 1, evidence: match[0] };
  }
  return null;
}

function findRtoStateFromMatchingAddress(pages: string[], rtoName: string) {
  const states = [
    "ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL", "DELHI", "JAMMU AND KASHMIR", "LADAKH", "PUDUCHERRY", "CHANDIGARH"
  ];
  const rto = escapeRegExp(rtoName);
  for (let index = 0; index < Math.min(pages.length, 6); index += 1) {
    const page = pages[index];
    const address = page.match(new RegExp(`(?:Address(?:\\s+for\\s+Communication)?[^\\n]*\\n?[^\\n]{0,180}${rto}[^\\n]{0,120})`, "i"));
    if (!address) continue;
    const upper = address[0].toUpperCase();
    const state = states.find((candidate) => upper.includes(candidate));
    if (state) return { value: titleCase(state), page: index + 1, evidence: address[0] };
  }
  return null;
}

function findScheduleOwnerDriverPremium(pages: string[]): MoneyHit | null {
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (!/Schedule\s+of\s+Premium/i.test(page) || !/Total\s+Liability\s+Premium/i.test(page)) continue;
    const match = page.match(/Compulsory\s+Personal\s+Accident\s+Cover\s+for\s+Owner\s*Driver[\s\S]{0,120}?₹?\s*([0-9][0-9,]{5,}(?:\.[0-9]{1,2})?)[\s\S]{0,80}?₹?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
    const value = parseMoney(match?.[2]);
    if (match && value !== null && value >= 0 && value <= 100000) return { value, page: index + 1, evidence: match[0] };
  }
  return null;
}

function findOwnDamagePeriod(pages: string[]): PeriodHit | null {
  const date = "([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})";
  const patterns = [
    new RegExp(`Own\\s+Damage\\s+Cover\\s+${date}[\\s\\S]{0,60}?${date}`, "i"),
    new RegExp(`Own\\s+Damage\\s+Cover\\s+Period\\s*:\\s*From\\s+${date}[\\s\\S]{0,60}?To\\s+${date}`, "i"),
  ];
  for (let index = 0; index < pages.length; index += 1) {
    for (const pattern of patterns) {
      const match = pages[index].match(pattern);
      if (!match?.[1] || !match?.[2]) continue;
      const from = isoDate(match[1]);
      const upto = isoDate(match[2]);
      if (from && upto) return { from, upto, page: index + 1, evidence: match[0] };
    }
  }
  return null;
}

function findText(pages: string[], pattern: RegExp) {
  for (let index = 0; index < pages.length; index += 1) {
    const match = pages[index].match(pattern);
    if (match?.[1]) return { value: match[1], page: index + 1, evidence: match[0] };
  }
  return null;
}

function findMoney(pages: string[], pattern: RegExp): MoneyHit | null {
  for (let index = 0; index < pages.length; index += 1) {
    const match = pages[index].match(pattern);
    const value = parseMoney(match?.[1]);
    if (match && value !== null) return { value, page: index + 1, evidence: match[0] };
  }
  return null;
}

function setField(fields: Fields, key: string, value: string, confidence: number, page: number | null, evidence: string) {
  const clean = value.trim();
  if (!clean) return;
  fields.set(key, { key, label: LABELS[key] ?? key, value: clean, confidence, page, evidence: sanitize(evidence).slice(0, 500) });
}

function parseMoney(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isoDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return "";
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const month = Number(match[2]);
  const day = Number(match[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return date.toISOString().slice(0, 10);
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").replace(/[;,]+$/, "").trim();
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitize(value: string) {
  return value.replace(/\u00ad/g, "").replace(/[–—]/g, "-").replace(/\r/g, "").split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}
