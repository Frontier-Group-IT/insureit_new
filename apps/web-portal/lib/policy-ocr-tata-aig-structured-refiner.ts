import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

const FINANCIAL_KEYS = new Set(["od_premium", "tp_premium", "cpa_premium", "cpa_opted"]);
const MONEY_TOKEN = /(?:₹|Rs\.?|INR)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;

type MoneyHit = { value: number; page: number; evidence: string };

type TextHit = { value: string; page: number; evidence: string };

export function refineTataAigStructuredLayout(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 120).join(" ");
  if (!/TATA\s+AIG\s+GENERAL\s+INSURANCE/i.test(header)) return parsed;
  if (!tables.length) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const warnings = parsed.warnings.filter((warning) =>
    !/TATA AIG.*(?:OD\/TP|premium fields|CPA amount|Registration|RTO)/i.test(warning),
  );

  const registration = findRowValue(tables, /Registration\s+No\.?/i);
  if (registration) {
    if (/^NEW$/i.test(registration.value)) {
      setField(fields, "vehicle_registration_status", "Registration status", "registration_pending", .995, registration.page, registration.evidence);
      fields.delete("vehicle_registration_number");
    } else if (isRegistrationNumber(registration.value)) {
      setField(fields, "vehicle_registration_status", "Registration status", "registered", .99, registration.page, registration.evidence);
      setField(fields, "vehicle_registration_number", "Registration number", compact(registration.value), .99, registration.page, registration.evidence);
    }
  }

  const rto = findRowValue(tables, /RTO\s+Location/i);
  if (rto && isPlausibleRto(rto.value)) {
    setField(fields, "vehicle_rto_name", "RTO name", cleanText(rto.value), .995, rto.page, rto.evidence);
  }

  const net = findRowAmount(tables, /Net\s+Premium\s*\(A\s*\+\s*B\s*\+\s*C\)/i);
  const baseOd = findRowAmount(tables, /Total\s+Own\s+Damage\s+Premium\s*\(A\)/i);
  const addOn = findRowAmount(tables, /Total\s+Add[-\s]*On\s+Premium\s*\(C\)/i);
  const basicTp = findRowAmount(tables, /Basic\s+TP\s+Premium/i);
  const totalLiability = findRowAmount(tables, /Total\s+Liability\s+Premium\s*\(B\)/i);
  const directCpa = findOwnerDriverPremium(tables);
  const derivedCpa = basicTp && totalLiability
    ? round2(totalLiability.value - basicTp.value)
    : null;
  const cpa = directCpa ?? (
    derivedCpa !== null && derivedCpa >= 100 && derivedCpa <= 5000
      ? { value: derivedCpa, page: totalLiability?.page ?? basicTp?.page ?? 1, evidence: `Derived from Total Liability ${money(totalLiability!.value)} - Basic TP ${money(basicTp!.value)}` }
      : null
  );

  if (net && basicTp && cpa) {
    let od: number | null = null;
    if (baseOd && addOn) od = round2(baseOd.value + addOn.value);
    else if (baseOd && !addOn) od = round2(baseOd.value);
    else od = round2(net.value - basicTp.value - cpa.value);

    const reconciles = od >= 0 && Math.abs(round2(od + basicTp.value + cpa.value) - net.value) <= 1;
    if (reconciles) {
      for (const key of FINANCIAL_KEYS) fields.delete(key);
      setField(fields, "od_premium", "OD premium", money(od), .995, baseOd?.page ?? net.page, [baseOd?.evidence, addOn?.evidence, net.evidence].filter(Boolean).join(" | "));
      setField(fields, "tp_premium", "Third party premium", money(basicTp.value), .995, basicTp.page, basicTp.evidence);
      setField(fields, "cpa_premium", "CPA amount", money(cpa.value), .995, cpa.page, cpa.evidence);
      setField(fields, "cpa_opted", "CPA opted", cpa.value > 0 ? "Yes" : "No", .995, cpa.page, cpa.evidence);
    } else {
      for (const key of FINANCIAL_KEYS) fields.delete(key);
      warnings.push("TATA AIG structured premium rows did not reconcile to printed net premium; OD/TP/CPA were withheld rather than guessed.");
    }
  } else if (tables.some((table) => table.rows.some((row) => row.join(" ").match(/Schedule\s+of\s+Premium|Basic\s+TP\s+Premium|Total\s+Liability\s+Premium/i)))) {
    for (const key of FINANCIAL_KEYS) fields.delete(key);
    warnings.push("TATA AIG structured premium evidence was incomplete; OD/TP/CPA were withheld rather than guessed.");
  }

  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+tata-structured-v1.1`,
    fields: [...fields.values()],
    warnings: Array.from(new Set(warnings)),
  };
}

function findRowValue(tables: StructuredPolicyTable[], label: RegExp): TextHit | null {
  for (const table of tables) {
    for (const row of table.rows) {
      const index = row.findIndex((cell) => label.test(cell));
      label.lastIndex = 0;
      if (index < 0) continue;

      const sameCell = row[index].replace(label, " ").replace(/[:\-]+/g, " ").trim();
      label.lastIndex = 0;
      const sameCandidate = cleanText(sameCell);
      if (sameCandidate && !label.test(sameCandidate)) {
        label.lastIndex = 0;
        const token = firstPlainValue(sameCandidate);
        if (token) return { value: token, page: table.page, evidence: row.join(" | ") };
      }
      label.lastIndex = 0;

      for (let offset = 1; offset <= 2; offset += 1) {
        const cell = cleanText(row[index + offset] ?? "");
        if (!cell) continue;
        if (looksLikeAnotherLabel(cell)) break;
        const token = firstPlainValue(cell);
        if (token) return { value: token, page: table.page, evidence: row.join(" | ") };
      }
    }
  }
  return null;
}

function findRowAmount(tables: StructuredPolicyTable[], label: RegExp): MoneyHit | null {
  for (const table of tables) {
    for (const row of table.rows) {
      const index = row.findIndex((cell) => label.test(cell));
      label.lastIndex = 0;
      if (index < 0) continue;

      const localCells: string[] = [];
      const same = row[index].replace(label, " ");
      label.lastIndex = 0;
      localCells.push(same);
      for (let offset = 1; offset <= 2; offset += 1) {
        const cell = row[index + offset] ?? "";
        if (offset > 1 && looksLikeAnotherLabel(cell)) break;
        localCells.push(cell);
        if (hasMoneyLikeToken(cell)) break;
      }

      for (const cell of localCells) {
        const amounts = extractAmounts(cell).filter((value) => value >= 0 && value <= 10000000);
        if (amounts.length) return { value: amounts[0], page: table.page, evidence: row.join(" | ") };
      }
    }
  }
  return null;
}

function findOwnerDriverPremium(tables: StructuredPolicyTable[]): MoneyHit | null {
  const ownerDriver = /Compulsory\s+Personal\s+Accident\s+Cover\s+for\s+Owner\s*Driver|Owner[-\s]*Driver\s+CPA/i;
  for (const table of tables) {
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
      const row = table.rows[rowIndex];
      const anchorIndex = row.findIndex((cell) => ownerDriver.test(cell));
      ownerDriver.lastIndex = 0;
      if (anchorIndex < 0) continue;

      const scoped: string[] = [];
      for (let cellIndex = anchorIndex; cellIndex < row.length; cellIndex += 1) scoped.push(row[cellIndex]);
      for (let next = rowIndex + 1; next <= Math.min(rowIndex + 2, table.rows.length - 1); next += 1) {
        const joined = table.rows[next].join(" | ");
        if (/Total\s+Liability\s+Premium|Net\s+Premium/i.test(joined)) break;
        scoped.push(...table.rows[next]);
      }

      const candidates = scoped
        .flatMap(extractAmounts)
        .filter((value) => value >= 100 && value <= 5000);
      if (!candidates.length) continue;
      const selected = candidates[candidates.length - 1];
      return { value: selected, page: table.page, evidence: scoped.join(" | ") };
    }
  }
  return null;
}

function extractAmounts(value: string) {
  const results: number[] = [];
  MONEY_TOKEN.lastIndex = 0;
  for (const match of value.matchAll(MONEY_TOKEN)) {
    const raw = match[1];
    const parsed = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(parsed)) continue;
    const token = match[0];
    if (!/[₹,\.]|Rs\.?|INR/i.test(token) && parsed < 100) continue;
    results.push(parsed);
  }
  MONEY_TOKEN.lastIndex = 0;
  return results;
}

function hasMoneyLikeToken(value: string) {
  return /₹|Rs\.?|INR|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d{3,}(?:\.\d{1,2})\b/i.test(value);
}

function firstPlainValue(value: string) {
  const cleaned = cleanText(value).replace(/^[:|\-]+|[:|\-]+$/g, "").trim();
  if (!cleaned || /^(NA|N\/A)$/i.test(cleaned)) return cleaned;
  return cleaned.split(/\s{2,}|\|/)[0]?.trim() ?? "";
}

function looksLikeAnotherLabel(value: string) {
  return /^(?:Make|Model|Variant|Fuel|Engine|Motor|Chassis|Body|CC|KW|Mfg|Seating|Zone|Geographical|Policy|Insured|Total|Basic|Premium|Section|Address)\b/i.test(cleanText(value));
}

function isPlausibleRto(value: string) {
  const clean = cleanText(value);
  return clean.length >= 2 && clean.length <= 40 && /^[A-Z][A-Z .-]*$/i.test(clean) && !/^(STATE|ZONE|GEOGRAPHICAL AREA|SEATING CAPACITY|NA|N\/A)$/i.test(clean);
}

function isRegistrationNumber(value: string) {
  return /^[A-Z]{2}[A-Z0-9 -]{4,18}$/i.test(value) && !/^NEW$/i.test(value);
}

function compact(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function money(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function setField(
  fields: Map<string, ParsedPolicyField>,
  key: string,
  label: string,
  value: string,
  confidence: number,
  page: number | null,
  evidence: string,
) {
  fields.set(key, { key, label, value, confidence, page, evidence: cleanText(evidence).slice(0, 500) });
}
