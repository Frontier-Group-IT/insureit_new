import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

const LABELS: Record<string, string> = {
  insured_name: "Insured name",
  insured_phone: "Phone number",
  vehicle_fuel_type: "Fuel type",
  vehicle_rto_state: "RTO state",
  vehicle_rto_name: "RTO name",
  vehicle_chassis_number: "Chassis number",
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
type TextHit = { value: string; page: number; evidence: string };

const INDIAN_STATES = [
  "ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL PRADESH", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA", "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL", "DELHI", "JAMMU AND KASHMIR", "LADAKH", "PUDUCHERRY", "CHANDIGARH",
];

export function refineTataAigVisibleFields(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  const cleanPages = pages.map(sanitize);
  const header = (cleanPages[0] ?? "").split("\n").slice(0, 100).join(" ");
  if (!/TATA\s+AIG\s+GENERAL\s+INSURANCE/i.test(header)) return parsed;
  if (!/BUNDLED\s+AUTO\s+SECURE\s*-?\s*TWO\s+WHEELER|TWO\s+WHEELER\s+POLICY/i.test(cleanPages.join("\n"))) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const warnings = [...parsed.warnings];

  // These values must be owned by the Tata layout. Generic OCR must never leak
  // POSP/agent numbers, add-on codes or unrelated table values into the form.
  for (const key of ["insured_phone", "vehicle_rto_state", "vehicle_rto_name", "vehicle_chassis_number", "od_premium", "tp_premium", "cpa_opted", "cpa_premium"]) {
    fields.delete(key);
  }

  const insured = findInsuredName(cleanPages);
  if (insured) setField(fields, "insured_name", insured.value, .99, insured.page, insured.evidence);

  const phone = findFullInsuredPhone(cleanPages);
  if (phone) {
    setField(fields, "insured_phone", phone.value, .98, phone.page, phone.evidence);
  } else if (hasMaskedInsuredPhone(cleanPages)) {
    warnings.push("TATA AIG insured mobile is masked on the policy copy, so Phone number was intentionally left blank.");
  }

  const fuel = findText(cleanPages, /Fuel\s+Type\s*[:\-]?\s*(BATTERY|ELECTRIC)/i);
  if (fuel) setField(fields, "vehicle_fuel_type", "Electric", .99, fuel.page, fuel.evidence);

  const rto = findRtoLocation(cleanPages);
  if (rto) setField(fields, "vehicle_rto_name", rto.value, .99, rto.page, rto.evidence);

  const state = findInsuredAddressState(cleanPages, rto?.value ?? "");
  if (state) setField(fields, "vehicle_rto_state", state.value, .97, state.page, state.evidence);

  const chassis = findVehicleIdentifierAfterLabel(cleanPages, /Chassis\s+No\.?/i);
  if (chassis) setField(fields, "vehicle_chassis_number", chassis.value, .99, chassis.page, chassis.evidence);

  const period = findOwnDamagePeriod(cleanPages);
  if (period) {
    setField(fields, "policy_start_date", period.from, .99, period.page, period.evidence);
    setField(fields, "policy_end_date", period.upto, .99, period.page, period.evidence);
  }

  const cpa = findScheduleOwnerDriverPremium(cleanPages);
  const baseOd = findLabeledMoney(cleanPages, /Total\s+Own\s+Damage\s+Premium\s*\(A\)/i);
  const addOn = findLabeledMoney(cleanPages, /Total\s+Add[-\s]*On\s+Premium\s*\(C\)/i);
  const basicTp = findLabeledMoney(cleanPages, /Basic\s+TP\s+Premium/i);
  const net = findLabeledMoney(cleanPages, /Net\s+Premium\s*\(A\s*\+\s*B\s*\+\s*C\)/i);

  if (cpa) {
    setField(fields, "cpa_opted", "Yes", .99, cpa.page, cpa.evidence);
    setField(fields, "cpa_premium", money(cpa.value), .99, cpa.page, cpa.evidence);
  } else {
    warnings.push("TATA AIG CPA amount was withheld because an exact Owner Driver premium row could not be proven.");
  }

  if (baseOd && basicTp && net && cpa) {
    const od = round2(baseOd.value + (addOn?.value ?? 0));
    if (Math.abs(round2(od + basicTp.value + cpa.value) - net.value) <= 1) {
      setField(fields, "od_premium", money(od), .99, baseOd.page, addOn ? `${baseOd.evidence} | ${addOn.evidence}` : baseOd.evidence);
      setField(fields, "tp_premium", money(basicTp.value), .99, basicTp.page, basicTp.evidence);
    } else {
      warnings.push("TATA AIG OD/TP values were withheld because OD + add-ons + TP + CPA did not reconcile to printed net premium.");
    }
  } else {
    warnings.push("TATA AIG OD/TP values require review because one or more labeled premium rows were not proven.");
  }

  return { ...parsed, fields: [...fields.values()], warnings: dedupe(warnings) };
}

function findInsuredName(pages: string[]): TextHit | null {
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

function findFullInsuredPhone(pages: string[]): TextHit | null {
  for (let index = 0; index < Math.min(pages.length, 3); index += 1) {
    const lines = pages[index].split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (!/Contact\s+No\.?/i.test(lines[lineIndex])) continue;
      const block = lines.slice(lineIndex, lineIndex + 2).join(" ");
      if (/\*/.test(block)) continue;
      const match = block.match(/Contact\s+No\.?\s*[:\-]?\s*(?:\+?91[ -]?)?([6-9][0-9 -]{9,13})/i);
      if (!match?.[1]) continue;
      const digits = match[1].replace(/\D/g, "").slice(-10);
      if (/^[6-9]\d{9}$/.test(digits)) return { value: digits, page: index + 1, evidence: block };
    }
  }
  return null;
}

function hasMaskedInsuredPhone(pages: string[]) {
  return pages.slice(0, 3).some((page) => /Contact\s+No\.?[\s\S]{0,50}\*/i.test(page));
}

function findRtoLocation(pages: string[]): TextHit | null {
  const stop = /^(?:Registration|Make|Model|Variant|Fuel|Engine|Motor|Chassis|Body|CC|KW|Mfg|Seating|Insured|Policy|Zone|IDV|Total|Address)\b/i;
  for (let index = 0; index < Math.min(pages.length, 5); index += 1) {
    const lines = pages[index].split("\n").map((line) => line.trim()).filter(Boolean);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const label = line.match(/RTO\s+Location\s*[:\-]?\s*(.*)$/i);
      if (!label) continue;
      const sameLine = cleanRto(label[1] ?? "");
      if (isPlausibleRto(sameLine)) return { value: sameLine, page: index + 1, evidence: line };
      for (let offset = 1; offset <= 3; offset += 1) {
        const candidate = cleanRto(lines[lineIndex + offset] ?? "");
        if (!candidate || stop.test(candidate)) continue;
        if (isPlausibleRto(candidate)) return { value: candidate, page: index + 1, evidence: `${line} | ${lines[lineIndex + offset]}` };
      }
    }
  }
  return null;
}

function cleanRto(value: string) {
  return cleanText(value).replace(/\b(?:Seating Capacity|Registration Date|Hypothecation|Total IDV|Policy Year).*$/i, "").trim();
}

function isPlausibleRto(value: string) {
  return value.length >= 2 && value.length <= 30 && /^[A-Z][A-Z .-]*$/i.test(value) && !/^(STATE|NA|N\/A|SEATING|CAPACITY|VEHICLE|DETAILS)$/i.test(value);
}

function findInsuredAddressState(pages: string[], rtoName: string): TextHit | null {
  for (let index = 0; index < Math.min(pages.length, 4); index += 1) {
    const page = pages[index];
    const addressIndex = page.search(/(?:^|\n)Address(?:\s+for\s+Communication)?\b/i);
    if (addressIndex < 0) continue;
    const block = page.slice(addressIndex, addressIndex + 650);
    const upper = block.toUpperCase();
    if (rtoName && !upper.includes(rtoName.toUpperCase())) continue;
    const state = INDIAN_STATES.find((candidate) => upper.includes(candidate));
    if (state) return { value: titleCase(state), page: index + 1, evidence: block.slice(0, 300) };
  }
  return null;
}

function findVehicleIdentifierAfterLabel(pages: string[], label: RegExp): TextHit | null {
  for (let index = 0; index < Math.min(pages.length, 5); index += 1) {
    const page = pages[index];
    const match = label.exec(page);
    if (!match || match.index === undefined) continue;
    const block = page.slice(match.index + match[0].length, match.index + match[0].length + 180);
    const candidates = [...block.matchAll(/\b[A-Z0-9]{14,25}\b/g)]
      .map((entry) => entry[0].toUpperCase())
      .filter((value) => /[A-Z]/.test(value) && /\d/.test(value));
    if (candidates.length) return { value: candidates[0], page: index + 1, evidence: `${match[0]} ${block.slice(0, 100)}` };
  }
  return null;
}

function findScheduleOwnerDriverPremium(pages: string[]): MoneyHit | null {
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (!/Schedule\s+of\s+Premium/i.test(page)) continue;
    const anchor = page.search(/Compulsory\s+Personal\s+Accident\s+Cover\s+for\s+Owner\s*Driver/i);
    if (anchor < 0) continue;
    const tail = page.slice(anchor, anchor + 360);
    const stopIndex = tail.search(/Total\s+Liability\s+Premium|Net\s+Premium/i);
    const block = stopIndex > 0 ? tail.slice(0, stopIndex) : tail;
    const values = [...block.matchAll(/(?:₹|Rs\.?|INR)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi)]
      .map((match) => ({ raw: match[0], value: parseMoney(match[1]) }))
      .filter((item): item is { raw: string; value: number } => item.value !== null)
      .filter((item) => item.value >= 100 && item.value <= 100000);
    if (!values.length) continue;
    const selected = values[values.length - 1];
    if (selected.value < 100 || selected.value > 5000) continue;
    return { value: selected.value, page: index + 1, evidence: block };
  }
  return null;
}

function findLabeledMoney(pages: string[], label: RegExp): MoneyHit | null {
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const match = label.exec(page);
    if (!match || match.index === undefined) continue;
    const after = page.slice(match.index + match[0].length, match.index + match[0].length + 140);
    const moneyMatch = after.match(/(?:₹|Rs\.?|INR)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
    const value = parseMoney(moneyMatch?.[1]);
    if (value !== null) return { value, page: index + 1, evidence: `${match[0]} ${after.slice(0, 90)}` };
  }
  return null;
}

function findOwnDamagePeriod(pages: string[]): PeriodHit | null {
  const date = "([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})";
  const patterns = [
    new RegExp(`Own\\s+Damage\\s+Cover\\s+${date}[\\s\\S]{0,90}?${date}`, "i"),
    new RegExp(`Own\\s+Damage\\s+Cover\\s+Period\\s*:\\s*From\\s+${date}[\\s\\S]{0,90}?To\\s+${date}`, "i"),
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

function findText(pages: string[], pattern: RegExp): TextHit | null {
  for (let index = 0; index < pages.length; index += 1) {
    const match = pages[index].match(pattern);
    if (match?.[1]) return { value: match[1], page: index + 1, evidence: match[0] };
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

function sanitize(value: string) {
  return value.replace(/\u00ad/g, "").replace(/[–—]/g, "-").replace(/\r/g, "").split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}
