import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Fields = Map<string, ParsedPolicyField>;

const LABELS: Record<string, string> = {
  insured_name: "Insured name",
  vehicle_registration_status: "Registration status",
  vehicle_registration_number: "Registration number",
  vehicle_class: "Vehicle class",
  vehicle_make: "Vehicle make",
  vehicle_model: "Vehicle model",
  vehicle_manufacturing_year: "Manufacturing year",
  vehicle_capacity: "Vehicle capacity",
  vehicle_chassis_number: "Chassis number",
  vehicle_engine_number: "Engine number",
  vehicle_rto_name: "RTO name",
  vehicle_rto_state: "RTO state",
  policy_product: "Policy product",
  idv: "IDV / Sum insured",
  od_premium: "OD premium",
  tp_premium: "Third party premium",
  cpa_opted: "CPA opted",
  cpa_premium: "CPA amount",
  policy_number: "Policy number",
  insurer_name: "Insurance company",
  policy_start_date: "Valid from",
  policy_end_date: "Valid upto",
  total_premium: "Printed net premium",
  tax_amount: "Printed GST",
  gross_premium: "Printed gross premium",
};

const ICICI = /ICICI\s+LOMBARD(?:\s+GENERAL\s+INSURANCE\s+COMPANY\s+LIMITED)?/i;
const FAMILY = /GOODS\s+CARRYING\s+VEHICLES?\s+PACKAGE\s+POLICY/i;
const MONEY_TOLERANCE = 2;

export function refineIciciLombardMotorPolicy(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 180).join(" ");
  const firstTwo = pages.slice(0, 2).join("\n");
  if (!ICICI.test(header) && !ICICI.test(firstTwo)) return parsed;
  if (!FAMILY.test(firstTwo) && !/Product\s+Code\s*:\s*3003/i.test(firstTwo)) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const warnings = parsed.warnings.filter((warning) => !/insurer format is not fully supported/i.test(warning));

  set(fields, "insurer_name", "ICICI Lombard General Insurance Company Limited", .999, 1, "ICICI Lombard legal name on policy");
  set(fields, "policy_product", "Package", .999, 2, "Goods Carrying Vehicles Package Policy");

  const insured = insuredNameFromIcici(pages);
  if (insured) set(fields, "insured_name", insured.value, .995, insured.page, insured.evidence);

  const policy = currentPolicyNumber(pages);
  if (policy) set(fields, "policy_number", policy.value, .999, policy.page, policy.evidence);

  const period = currentPeriod(pages);
  if (period) {
    set(fields, "policy_start_date", period.start, .999, period.page, period.evidence);
    set(fields, "policy_end_date", period.end, .999, period.page, period.evidence);
  }

  const riskVehicle = riskAssumptionVehicleDetails(pages[0] ?? "");
  const localVehicle = registrationNeighborhoodDetails(pages[0] ?? "");

  const registration = riskVehicle?.registration
    ?? localVehicle?.registration
    ?? registrationNumber(pages, tables)
    ?? existingValidRegistration(fields);
  if (registration) {
    set(fields, "vehicle_registration_number", registration.value, .999, registration.page, registration.evidence);
    set(fields, "vehicle_registration_status", "registered", .999, registration.page, registration.evidence);
  }

  const scheduleVehicle = scheduleVehicleDetails(
    pages[1] ?? "",
    registration?.value ?? fields.get("vehicle_registration_number")?.value ?? "",
  );

  const vehicleClass = structuredColumn(tables, [/^Vehicle\s+Class$/i])
    ?? explicitVehicleClassValue(pages)
    ?? labelValue(pages, /Vehicle\s+Class/i, 2);
  set(
    fields,
    "vehicle_class",
    "GCV",
    .999,
    vehicleClass?.page ?? 2,
    vehicleClass?.evidence ?? "ICICI Goods Carrying Vehicles Package Policy",
  );

  const make = riskVehicle?.make
    ?? localVehicle?.make
    ?? structuredColumn(tables, [/^Make$/i]);
  const model = riskVehicle?.model
    ?? localVehicle?.model
    ?? structuredColumn(tables, [/^Model$/i]);
  const makeModel = labelPair(pages, /Vehicle\s+Make\s*\/\s*Model/i);
  if (make) set(fields, "vehicle_make", normalizeVehicleMake(make.value), .999, make.page, make.evidence);
  else if (makeModel?.left) set(fields, "vehicle_make", normalizeVehicleMake(makeModel.left), .995, makeModel.page, makeModel.evidence);
  if (model) set(fields, "vehicle_model", normalizeVehicleModel(model.value), .999, model.page, model.evidence);
  else if (makeModel?.right) set(fields, "vehicle_model", normalizeVehicleModel(makeModel.right), .995, makeModel.page, makeModel.evidence);

  const year = riskVehicle?.year
    ?? structuredColumn(tables, [/^Mfg\s*Yr$/i, /Manufactur(?:ing|e)\s+Year/i]);
  if (year && /^(?:19|20)\d{2}$/.test(year.value.trim())) {
    set(fields, "vehicle_manufacturing_year", year.value.trim(), .999, year.page, year.evidence);
  }

  const capacityValue = structuredColumn(tables, [/^GVW(?:\s*\(KG\))?$/i, /^Gross\s+Vehicle\s+Weight/i])
    ?? scheduleVehicleCapacity(pages[1] ?? "", registration?.value ?? fields.get("vehicle_registration_number")?.value ?? "");
  if (capacityValue) {
    const capacity = numericCapacity(capacityValue.value);
    if (capacity != null) set(fields, "vehicle_capacity", String(capacity), .999, capacityValue.page, capacityValue.evidence);
  }

  const structuredChassis = structuredColumn(tables, [/^Chassis\s+No\.?$/i]);
  const structuredEngine = structuredColumn(tables, [/^Engine\s+No\.?$/i]);
  const chassis = riskVehicle?.chassis
    ?? localVehicle?.chassis
    ?? scheduleVehicle?.chassis
    ?? (structuredChassis && validVehicleId(structuredChassis.value) ? structuredChassis : null);
  const engine = riskVehicle?.engine
    ?? localVehicle?.engine
    ?? scheduleVehicle?.engine
    ?? (structuredEngine && validVehicleId(structuredEngine.value) ? structuredEngine : null);
  if (chassis && validVehicleId(chassis.value)) {
    set(fields, "vehicle_chassis_number", compactId(chassis.value), .999, chassis.page, chassis.evidence);
  } else {
    fields.delete("vehicle_chassis_number");
  }
  if (engine && validVehicleId(engine.value)) {
    set(fields, "vehicle_engine_number", compactId(engine.value), .999, engine.page, engine.evidence);
  } else {
    fields.delete("vehicle_engine_number");
  }

  const rto = boundedRtoValue(pages)
    ?? explicitRtoValue(pages)
    ?? riskVehicle?.rto
    ?? localVehicle?.rto
    ?? scheduleVehicle?.rto
    ?? safeRtoValue(labelValue(pages, /RTO\s+(?:City|Location)/i, 2));
  if (rto) {
    const rtoName = cleanVehicle(rto.value);
    set(fields, "vehicle_rto_name", rtoName, .999, rto.page, rto.evidence);
    const state = rtoStateFromName(rtoName);
    if (state) set(fields, "vehicle_rto_state", state, .995, rto.page, "Derived from explicit ICICI RTO location: " + rtoName);
  } else {
    fields.delete("vehicle_rto_name");
    fields.delete("vehicle_rto_state");
  }

  const structuredIdv = structuredColumn(tables, [/^Total\s+IDV(?:\s*\(.*\))?$/i]);
  const textIdv = findIciciTotalIdv(pages);
  const idv = structuredIdv && money(structuredIdv.value) != null ? structuredIdv : textIdv;
  if (idv) setMoney(fields, "idv", money(idv.value), .999, idv.page, idv.evidence);
  else fields.delete("idv");

  const od = structuredMoney(tables, /Total\s+Own\s+Damage\s+Premium\s*\(A\)/i)
    ?? explicitMoney(firstTwo, /Total\s+Own\s+Damage\s+Premium\s*\(A\)/i);
  const tp = structuredMoney(tables, /Total\s+Liability\s+Premium\s*\(B\)/i)
    ?? explicitMoney(firstTwo, /Total\s+Liability\s+Premium\s*\(B\)/i);
  const net = structuredMoney(tables, /Total\s+Package\s+Premium\s*\(A\s*\+\s*B\)/i)
    ?? explicitMoney(firstTwo, /Total\s+Package\s+Premium\s*\(A\s*\+\s*B\)/i);
  const tax = structuredMoney(tables, /Total\s+Tax\s+Payable/i)
    ?? explicitMoney(firstTwo, /Total\s+Tax\s+Payable(?:\s+in)?/i);
  const gross = structuredMoney(tables, /Total\s+Premium\s+Payable/i)
    ?? explicitMoney(firstTwo, /Total\s+Premium\s+Payable(?:\s+in)?/i);

  const explicitCpaZero =
    /Compulsory\s+Personal\s+Accident\s+cover\s+has\s+not\s+been\s+opted/i.test(firstTwo)
    || /PA\s+Cover\s+for\s+Owner[-\s]*Driver[^\n]{0,80}CSI\s*0(?:\.00)?/i.test(firstTwo);

  if (od != null && tp != null && net != null && close(od + tp, net)) {
    setMoney(fields, "od_premium", od, .999, 2, "ICICI Total Own Damage Premium(A)");
    setMoney(fields, "tp_premium", tp, .999, 2, "ICICI Total Liability Premium(B)");
    setMoney(fields, "total_premium", net, .999, 2, "ICICI Total Package Premium(A+B)");
  } else {
    fields.delete("od_premium");
    fields.delete("tp_premium");
    if (net != null) setMoney(fields, "total_premium", net, .995, 2, "ICICI Total Package Premium(A+B)");
    warnings.push("Review required. ICICI OD/TP values did not reconcile to Total Package Premium; unsafe OD/TP values were withheld.");
  }

  if (tax != null) setMoney(fields, "tax_amount", tax, .999, 2, "ICICI Total Tax Payable");
  if (gross != null) setMoney(fields, "gross_premium", gross, .999, 2, "ICICI Total Premium Payable");
  if (net != null && tax != null && gross != null && !close(net + tax, gross)) {
    warnings.push("Review required. ICICI net premium plus displayed tax does not exactly reconcile to gross premium; retained only explicit labelled totals.");
  }

  if (explicitCpaZero) {
    setMoney(fields, "cpa_premium", 0, .999, 2, "ICICI explicit CPA not opted / CSI 0.00");
    set(fields, "cpa_opted", "No", .999, 2, "ICICI explicit CPA not opted / CSI 0.00");
  }

  removeHeaderArtifacts(fields);
  requireEvidence(fields, warnings);

  return {
    parserId: "icici_lombard_motor_v1",
    parserVersion: "icici_lombard_motor_v1.8.0+gcv-live-replay-v9",
    fields: [...fields.values()],
    warnings,
  };
}


function insuredNameFromIcici(pages: string[]): VehicleEvidence | null {
  for (let page = 0; page < Math.min(2, pages.length); page += 1) {
    const lines = rawLines(pages[page] ?? "");
    for (let i = 0; i < lines.length; i += 1) {
      const same = lines[i].match(/Name\s+of\s+the\s+Insured\s*[:#-]\s*(.+?)(?:\s+Policy\s+No\.?\s*[:#-]|$)/i);
      if (same) {
        const value = clean(same[1]);
        if (safeInsuredName(value)) return { value, page: page + 1, evidence: "ICICI explicit insured-name label" };
      }
      if (/^Name\s+of\s+the\s+Insured\s*:?$/i.test(lines[i])) {
        for (let j = i + 1; j <= Math.min(i + 12, lines.length - 1); j += 1) {
          const candidate = clean(lines[j]);
          if (!candidate || looksLikeRiskLabel(candidate) || /Period\s+of\s+Insurance/i.test(candidate)) continue;
          if (safeInsuredName(candidate)) {
            return { value: candidate, page: page + 1, evidence: "ICICI insured-name next value" };
          }
        }
      }
    }
  }
  return null;
}

function safeInsuredName(value: string) {
  const cleaned = clean(value);
  if (cleaned.length < 2 || cleaned.length > 120) return false;
  if (/^(?:NA|N\/A|NAME|POLICY|PERIOD|VEHICLE|RTO|REGISTRATION|ENGINE|CHASSIS)$/i.test(cleaned)) return false;
  return /[A-Z]/i.test(cleaned);
}

function currentPolicyNumber(pages: string[]) {
  for (let page = 0; page < Math.min(2, pages.length); page += 1) {
    const lines = rawLines(pages[page]);
    for (let i = 0; i < lines.length; i += 1) {
      if (!/Policy\s+No\.?/i.test(lines[i]) || /Previous\s+Policy/i.test(lines[i])) continue;
      const block = lines.slice(i, i + 2).join(" ");
      const hit = block.match(/Policy\s+No\.?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{7,34})/i)?.[1];
      if (hit) return { value: hit.replace(/[.,;:]$/, ""), page: page + 1, evidence: block };
    }
  }
  return null;
}

function currentPeriod(pages: string[]) {
  for (let page = 0; page < Math.min(2, pages.length); page += 1) {
    const text = pages[page];
    const hit = text.match(/(?:Period\s+of\s+Insurance\s*[:\-]?\s*)?([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})(?:\s+00:00)?\s+to\s+(?:Midnight\s+of\s+)?([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i);
    if (!hit) continue;
    const start = namedDate(hit[1]);
    const end = namedDate(hit[2]);
    if (start && end) return { start, end, page: page + 1, evidence: hit[0] };
  }
  return null;
}

function registrationNumber(pages: string[], tables: StructuredPolicyTable[]) {
  const structured = structuredColumn(tables, [/^Vehicle\s+Registration\s+No\.?$/i]);
  if (structured) {
    const value = compactId(structured.value);
    if (validRegistration(value)) return { ...structured, value };
  }
  const found = labelValue(pages, /Vehicle\s+Registration\s+No\.?/i, 1);
  if (!found) return null;
  const value = compactId(found.value);
  return validRegistration(value) ? { ...found, value } : null;
}

function structuredColumn(tables: StructuredPolicyTable[], labels: RegExp[]) {
  for (const table of tables) {
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r] ?? [];
      for (let c = 0; c < row.length; c += 1) {
        const cell = clean(row[c] ?? "");
        if (!labels.some((label) => label.test(cell))) continue;
        for (let next = r + 1; next <= Math.min(r + 3, table.rows.length - 1); next += 1) {
          const value = clean(table.rows[next]?.[c] ?? "");
          if (!value) continue;
          if (labels.some((label) => label.test(value))) break;
          return { value, page: table.page, evidence: `${cell} column => ${value}` };
        }
        if (c + 1 < row.length) {
          const right = clean(row[c + 1] ?? "");
          if (right && !labels.some((label) => label.test(right))) return { value: right, page: table.page, evidence: `${cell} => ${right}` };
        }
      }
    }
  }
  return null;
}

function labelValue(pages: string[], label: RegExp, maxPage: number) {
  for (let page = 0; page < Math.min(maxPage, pages.length); page += 1) {
    const lines = rawLines(pages[page]);
    for (let i = 0; i < lines.length; i += 1) {
      if (!label.test(lines[i])) continue;
      const same = clean(lines[i].replace(label, "").replace(/^\s*[:#-]\s*/, ""));
      if (same && !looksLikeLabel(same)) return { value: same, page: page + 1, evidence: lines[i] };
      for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j += 1) {
        if (looksLikeLabel(lines[j])) break;
        return { value: lines[j], page: page + 1, evidence: `${lines[i]} => ${lines[j]}` };
      }
    }
  }
  return null;
}

function labelPair(pages: string[], label: RegExp) {
  const found = labelValue(pages, label, 1);
  if (!found) return null;
  const parts = found.value.split("/").map(clean).filter(Boolean);
  if (parts.length < 2) return null;
  return { left: parts[0], right: parts.slice(1).join(" / "), page: found.page, evidence: found.evidence };
}

function explicitMoney(text: string, label: RegExp): number | null {
  const escaped = text.split(/\r?\n/).map(clean);
  for (let i = 0; i < escaped.length; i += 1) {
    const line = escaped[i];
    if (!label.test(line)) continue;
    const labelIndex = line.search(label);
    const after = labelIndex >= 0 ? line.slice(labelIndex).replace(label, " ") : line;
    const direct = money(after);
    if (direct != null) return direct;
    for (let j = i + 1; j <= Math.min(i + 2, escaped.length - 1); j += 1) {
      if (/Total\s+(?:Own\s+Damage|Liability|Package|Tax|Premium)|Premium\s+Taxable|IGST|CGST|SGST/i.test(escaped[j])) break;
      const value = money(escaped[j]);
      if (value != null) return value;
    }
  }
  return null;
}

function money(value: string): number | null {
  const matches = value.match(/\d[\d,]*(?:\.\d{1,2})?/g) ?? [];
  for (const raw of matches) {
    if (/,$/.test(raw)) continue;
    const parsed = Number(raw.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}


type VehicleEvidence = { value: string; page: number; evidence: string };
type RiskVehicleDetails = {
  registration: VehicleEvidence | null;
  make: VehicleEvidence | null;
  model: VehicleEvidence | null;
  rto: VehicleEvidence | null;
  year: VehicleEvidence | null;
  chassis: VehicleEvidence | null;
  engine: VehicleEvidence | null;
};

function riskAssumptionVehicleDetails(pageOne: string): RiskVehicleDetails | null {
  const lines = rawLines(pageOne);
  const strict = strictRiskAssumptionVehicleDetails(lines);
  if (strict) return strict;
  return looseRiskAssumptionVehicleDetails(lines);
}

function strictRiskAssumptionVehicleDetails(lines: string[]): RiskVehicleDetails | null {
  const start = lines.findIndex((line) => /^Insured\s*&\s*Vehicle\s+Details\s*:?$/i.test(line));
  const previous = lines.findIndex((line, index) => index > start && /^Previous\s+Policy\s+Details\s*:?$/i.test(line));
  if (start < 0 || previous < 0) return null;

  const section = lines.slice(start + 1, previous);
  const labels = [
    /^Name\s+of\s+the\s+Insured\s*:?$/i,
    /^Period\s+of\s+Insurance\s*:?$/i,
    /^Vehicle\s+Make\s*\/\s*Model\s*:?$/i,
    /^RTO\s+City\s*:?$/i,
    /^Vehicle\s+Registration\s+No\.?\s*:?$/i,
    /^Vehicle\s+Registration\s+Date\s*:?$/i,
    /^Engine\s+No\.?\s*:?$/i,
    /^Chassis\s+No\.?\s*:?$/i,
    /^Current\s+Year\s+NCB(?:\(%\))?\s*:?$/i,
    /^Vehicle\s+Usage\s*:?$/i,
  ];

  const labelPositions = labels.map((pattern) => section.findIndex((line) => pattern.test(line)));
  if (labelPositions.some((index) => index < 0)) return null;
  const lastLabel = Math.max(...labelPositions);
  const values = section.slice(lastLabel + 1).filter(Boolean);
  return vehicleDetailsFromOrderedValues(values);
}

function looseRiskAssumptionVehicleDetails(lines: string[]): RiskVehicleDetails | null {
  const previous = lines.findIndex((line) => /Previous\s+Policy\s+Details/i.test(line));
  const usage = lines.findIndex((line, index) =>
    (previous < 0 || index < previous) && /Vehicle\s+Usage/i.test(line)
  );
  if (usage < 0) return null;

  const end = previous > usage ? previous : Math.min(lines.length, usage + 18);
  const values = lines
    .slice(usage + 1, end)
    .map(clean)
    .filter(Boolean)
    .filter((line) => !looksLikeRiskLabel(line));

  if (values.length < 6) return null;
  return vehicleDetailsFromOrderedValues(values);
}

function vehicleDetailsFromOrderedValues(values: string[]): RiskVehicleDetails | null {
  const registrationIndex = values.findIndex((entry) => validRegistration(compactId(entry)));
  if (registrationIndex < 0) return null;

  const registrationValue = compactId(values[registrationIndex]);
  const before = values.slice(0, registrationIndex);
  const after = values.slice(registrationIndex + 1);

  const makeModelRaw = [...before].reverse().find((entry) =>
    entry.includes("/") && /[A-Z]/i.test(entry) && !/\d{1,2}[-/][A-Z]{3}[-/]?\d{2,4}/i.test(entry)
  ) ?? null;
  const makeModel = makeModelRaw ? makeModelRaw.split("/").map(clean).filter(Boolean) : [];

  const rtoRaw = before.length ? before[before.length - 1] : "";
  const rto = isSafeRto(rtoRaw) && rtoRaw !== makeModelRaw ? rtoRaw : "";

  const dateIndex = after.findIndex((entry) =>
    /^(?:[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{4})$/i.test(entry)
  );
  const idCandidates = after
    .slice(dateIndex >= 0 ? dateIndex + 1 : 0)
    .map((entry) => ({ raw: entry, compact: compactId(entry) }))
    .filter((entry) => validVehicleId(entry.compact));

  const evidence = (raw: string) => "ICICI Risk Assumption ordered vehicle values: " + raw;

  return {
    registration: { value: registrationValue, page: 1, evidence: evidence(values[registrationIndex]) },
    make: makeModel[0] ? { value: makeModel[0], page: 1, evidence: evidence(makeModelRaw ?? "") } : null,
    model: makeModel[1] ? { value: makeModel.slice(1).join(" / "), page: 1, evidence: evidence(makeModelRaw ?? "") } : null,
    rto: rto ? { value: rto, page: 1, evidence: evidence(rto) } : null,
    year: null,
    engine: idCandidates[0] ? { value: idCandidates[0].compact, page: 1, evidence: evidence(idCandidates[0].raw) } : null,
    chassis: idCandidates[1] ? { value: idCandidates[1].compact, page: 1, evidence: evidence(idCandidates[1].raw) } : null,
  };
}

function looksLikeRiskLabel(value: string) {
  return /^(?:Name\s+of\s+the\s+Insured|Period\s+of\s+Insurance|Vehicle\s+Make|RTO\s+City|Vehicle\s+Registration|Engine\s+No|Chassis\s+No|Current\s+Year\s+NCB|Vehicle\s+Usage|Previous\s+Policy)/i.test(value);
}

function existingValidRegistration(fields: Fields): VehicleEvidence | null {
  const field = fields.get("vehicle_registration_number");
  if (!field) return null;
  const value = compactId(field.value);
  if (!validRegistration(value)) return null;
  return {
    value,
    page: field.page ?? 1,
    evidence: field.evidence || "Validated existing registration candidate",
  };
}



function registrationNeighborhoodDetails(pageOne: string): RiskVehicleDetails | null {
  const lines = rawLines(pageOne);
  const previous = lines.findIndex((line) => /Previous\s+Policy\s+Details/i.test(line));
  const bounded = previous >= 0 ? lines.slice(0, previous) : lines.slice(0, 220);

  const regIndex = bounded.findIndex((line) => validRegistration(compactId(line)));
  if (regIndex < 0) return null;

  const registrationValue = compactId(bounded[regIndex]);
  const before = bounded.slice(Math.max(0, regIndex - 8), regIndex);
  const after = bounded.slice(regIndex + 1, Math.min(bounded.length, regIndex + 10));

  const makeModelRaw = [...before].reverse().find((line) =>
    line.includes("/")
    && /[A-Z]/i.test(line)
    && !looksLikeRiskLabel(line)
    && !/\b(?:19|20)\d{2}\b/.test(line)
  ) ?? null;
  const makeModel = makeModelRaw ? makeModelRaw.split("/").map(clean).filter(Boolean) : [];

  const rtoRaw = [...before].reverse().find((line) =>
    line !== makeModelRaw
    && isSafeRto(line)
    && looksLikeRtoLocation(line)
    && !/\b(?:19|20)\d{2}\b/.test(line)
    && !/\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(line)
  ) ?? "";

  const dateIndex = after.findIndex((line) =>
    /^(?:[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}|\d{1,2}[-/]\d{1,2}[-/]\d{4})$/i.test(line)
  );
  const idSearch = after.slice(dateIndex >= 0 ? dateIndex + 1 : 0);
  const ids = idSearch
    .map((raw) => ({ raw, compact: compactId(raw) }))
    .filter((entry) => validVehicleId(entry.compact) && !looksLikeIdentifierLabel(entry.raw));

  const evidence = (value: string) => "ICICI page-1 registration neighborhood: " + value;

  return {
    registration: { value: registrationValue, page: 1, evidence: evidence(bounded[regIndex]) },
    make: makeModel[0] ? { value: makeModel[0], page: 1, evidence: evidence(makeModelRaw ?? "") } : null,
    model: makeModel[1] ? { value: makeModel.slice(1).join(" / "), page: 1, evidence: evidence(makeModelRaw ?? "") } : null,
    rto: rtoRaw ? { value: rtoRaw, page: 1, evidence: evidence(rtoRaw) } : null,
    year: null,
    engine: ids[0] ? { value: ids[0].compact, page: 1, evidence: evidence(ids[0].raw) } : null,
    chassis: ids[1] ? { value: ids[1].compact, page: 1, evidence: evidence(ids[1].raw) } : null,
  };
}

function looksLikeIdentifierLabel(value: string) {
  return /(?:ENGINE\s+NO|CHASSIS\s+NO|CURRENT\s+YEAR\s+NCB|VEHICLE\s+USAGE|REGISTRATION\s+DATE|HYPOTHECATED\s+TO)/i.test(value);
}

function scheduleVehicleDetails(pageTwo: string, registration: string): {
  chassis: VehicleEvidence | null;
  engine: VehicleEvidence | null;
  rto: VehicleEvidence | null;
} | null {
  if (!pageTwo.trim()) return null;

  const normalizedRegistration = compactId(registration);
  const lines = rawLines(pageTwo);
  let chassis: VehicleEvidence | null = null;
  let engine: VehicleEvidence | null = null;

  // First try a clean single-line row.
  for (const line of lines) {
    if (!normalizedRegistration || !compactId(line).includes(normalizedRegistration)) continue;
    const parsed = vehicleIdsFromScheduleText(line, normalizedRegistration);
    if (parsed.chassis || parsed.engine) {
      chassis = parsed.chassis;
      engine = parsed.engine;
      break;
    }
  }

  // Live Google Layout can fragment one schedule row over several text lines.
  // Bound the search to the registration row through the IDV header/value block,
  // then use the documented ICICI column order after manufacturing year.
  if (!chassis || !engine) {
    const regIndex = lines.findIndex((line) =>
      normalizedRegistration && compactId(line).includes(normalizedRegistration)
    );
    if (regIndex >= 0) {
      let endIndex = Math.min(lines.length, regIndex + 12);
      for (let i = regIndex + 1; i < Math.min(lines.length, regIndex + 18); i += 1) {
        if (/^(?:Trailer\s+Registration\s+No\.|Body\s+IDV|Premium\s+Details)/i.test(lines[i])) {
          endIndex = i;
          break;
        }
      }
      const bounded = lines.slice(regIndex, endIndex).join(" ");
      const parsed = vehicleIdsFromScheduleText(bounded, normalizedRegistration);
      chassis = chassis ?? parsed.chassis;
      engine = engine ?? parsed.engine;
    }
  }

  const rto = explicitRtoFromText(pageTwo, 2);
  if (!chassis && !engine && !rto) return null;
  return { chassis, engine, rto };
}

function vehicleIdsFromScheduleText(text: string, normalizedRegistration: string) {
  const tokens = clean(text).split(/\s+/).filter(Boolean);
  const regIndex = tokens.findIndex((token) => compactId(token) === normalizedRegistration);
  const searchStart = regIndex >= 0 ? regIndex + 1 : 0;

  const yearIndex = tokens.findIndex((token, index) =>
    index >= searchStart && /^(?:19|20)\d{2}$/.test(token.replace(/[^0-9]/g, ""))
  );
  if (yearIndex < 0) return { chassis: null, engine: null };

  const afterYear = tokens
    .slice(yearIndex + 1)
    .map((token) => ({ raw: token, compact: compactId(token) }))
    .filter((entry) => entry.compact && entry.compact !== normalizedRegistration);

  // ICICI GCV schedule places carrying capacity immediately after Mfg Yr,
  // then Chassis No., Engine No., and Trailer Chassis No. Google Layout can
  // split chassis/engine values over multiple OCR lines. Remove the small
  // carrying-capacity/trailer sentinels, then reconstruct the identifier pair.
  while (afterYear.length && /^\d{1,3}$/.test(afterYear[0].compact)) afterYear.shift();
  while (afterYear.length && /^(?:0|NA|NIL)$/.test(afterYear[afterYear.length - 1].compact)) afterYear.pop();

  const fragments = afterYear
    .filter((entry) =>
      !/^(?:TRAILER|MODEL|CARRIER|PUBLICCARRIER|PARTIALLYBUILT|OPEN|BHARAT|BENZ|BHARATBENZ)$/i.test(entry.compact)
      && !looksLikeIdentifierLabel(entry.raw)
      && /^[A-Z0-9]+$/.test(entry.compact)
    );

  const reconstructed = reconstructIciciScheduleIdentifiers(fragments);
  if (reconstructed) return reconstructed;

  const candidates = fragments.filter((entry) => validVehicleId(entry.compact));
  const first = candidates[0] ?? null;
  const second = candidates[1] ?? null;
  return {
    chassis: first ? {
      value: first.compact,
      page: 2,
      evidence: "ICICI policy schedule bounded vehicle row: " + first.raw,
    } : null,
    engine: second ? {
      value: second.compact,
      page: 2,
      evidence: "ICICI policy schedule bounded vehicle row: " + second.raw,
    } : null,
  };
}

function reconstructIciciScheduleIdentifiers(
  fragments: Array<{ raw: string; compact: string }>,
): { chassis: VehicleEvidence | null; engine: VehicleEvidence | null } | null {
  if (fragments.length < 2) return null;

  // A chassis/VIN in this layout is normally 17 characters. Find the earliest
  // fragment boundary that reconstructs a plausible 17-character chassis,
  // then join the remaining fragments as the engine number.
  let chassis = "";
  for (let i = 0; i < fragments.length - 1; i += 1) {
    chassis += fragments[i].compact;
    if (chassis.length < 17) continue;
    if (chassis.length > 18) break;
    if (!validVehicleId(chassis)) continue;

    const engine = fragments.slice(i + 1).map((entry) => entry.compact).join("");
    if (!validVehicleId(engine)) continue;

    return {
      chassis: {
        value: chassis,
        page: 2,
        evidence: "ICICI wrapped schedule chassis fragments: " + fragments.slice(0, i + 1).map((entry) => entry.raw).join(" | "),
      },
      engine: {
        value: engine,
        page: 2,
        evidence: "ICICI wrapped schedule engine fragments: " + fragments.slice(i + 1).map((entry) => entry.raw).join(" | "),
      },
    };
  }
  return null;
}

function scheduleVehicleCapacity(pageTwo: string, registration: string): VehicleEvidence | null {
  const normalizedRegistration = compactId(registration);
  if (!pageTwo.trim() || !normalizedRegistration) return null;

  const lines = rawLines(pageTwo);
  const regIndex = lines.findIndex((line) => compactId(line).includes(normalizedRegistration));
  if (regIndex < 0) return null;

  const bounded = lines.slice(regIndex, Math.min(lines.length, regIndex + 10)).join(" ");
  const tokens = clean(bounded).split(/\s+/).filter(Boolean);
  const registrationTokenIndex = tokens.findIndex((token) => compactId(token) === normalizedRegistration);
  const yearIndex = tokens.findIndex((token, index) =>
    index > registrationTokenIndex && /^(?:19|20)\d{2}$/.test(token.replace(/[^0-9]/g, ""))
  );
  if (yearIndex < 0) return null;

  // ICICI GCV schedule order places GVW immediately before Mfg Yr.
  for (let i = yearIndex - 1; i > Math.max(registrationTokenIndex, yearIndex - 6); i -= 1) {
    const raw = tokens[i];
    const parsed = numericCapacity(raw);
    if (parsed != null && parsed >= 1000) {
      return {
        value: String(parsed),
        page: 2,
        evidence: "ICICI policy schedule GVW immediately before manufacturing year: " + raw,
      };
    }
  }
  return null;
}

function numericCapacity(value: string): number | null {
  const hit = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!hit) return null;
  const parsed = Number(hit[0]);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000) return null;
  return parsed;
}

function rtoStateFromName(value: string): string | null {
  const normalized = clean(value).toUpperCase();
  const states: Array<[RegExp, string]> = [
    [/^RAJASTHAN\b/, "Rajasthan"],
    [/^MADHYA\s+PRADESH\b/, "Madhya Pradesh"],
    [/^MAHARASHTRA\b/, "Maharashtra"],
    [/^GUJARAT\b/, "Gujarat"],
    [/^UTTAR\s+PRADESH\b/, "Uttar Pradesh"],
    [/^DELHI\b/, "Delhi"],
    [/^HARYANA\b/, "Haryana"],
    [/^PUNJAB\b/, "Punjab"],
    [/^CHHATTISGARH\b/, "Chhattisgarh"],
    [/^UTTARAKHAND\b/, "Uttarakhand"],
    [/^BIHAR\b/, "Bihar"],
    [/^JHARKHAND\b/, "Jharkhand"],
    [/^WEST\s+BENGAL\b/, "West Bengal"],
    [/^ODISHA\b/, "Odisha"],
    [/^KARNATAKA\b/, "Karnataka"],
    [/^TAMIL\s+NADU\b/, "Tamil Nadu"],
    [/^TELANGANA\b/, "Telangana"],
    [/^ANDHRA\s+PRADESH\b/, "Andhra Pradesh"],
    [/^KERALA\b/, "Kerala"],
    [/^ASSAM\b/, "Assam"],
  ];
  return states.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

function explicitVehicleClassValue(pages: string[]): VehicleEvidence | null {
  for (let page = 0; page < Math.min(2, pages.length); page += 1) {
    const lines = rawLines(pages[page] ?? "");
    for (let i = 0; i < lines.length; i += 1) {
      const same = lines[i].match(/Vehicle\s+Class\s*[:#-]\s*(.+)$/i);
      if (same) {
        const value = clean(same[1]).replace(/\s{2,}.*/, "").trim();
        if (isSafeVehicleClass(value)) {
          return { value, page: page + 1, evidence: "ICICI explicit Vehicle Class label: " + lines[i] };
        }
      }
      if (/^Vehicle\s+Class\s*:?$/i.test(lines[i])) {
        const next = clean(lines[i + 1] ?? "");
        if (isSafeVehicleClass(next)) {
          return { value: next, page: page + 1, evidence: "ICICI Vehicle Class next-line value: " + next };
        }
      }
    }
  }
  return null;
}

function isSafeVehicleClass(value: string) {
  const cleaned = clean(value);
  return Boolean(cleaned)
    && cleaned.length <= 80
    && !/^(?:Category|Make|Model|RTO\s+(?:City|Location)|Vehicle\s+Registration)/i.test(cleaned);
}

function boundedRtoValue(pages: string[]): VehicleEvidence | null {
  for (let page = 0; page < Math.min(2, pages.length); page += 1) {
    const text = pages[page] ?? "";
    const label = /RTO\s+(?:City|Location)/i.exec(text);
    if (!label) continue;

    const window = text.slice(label.index, Math.min(text.length, label.index + 260));
    const stateLocation = window.match(
      /\b(RAJASTHAN|MADHYA\s+PRADESH|MAHARASHTRA|GUJARAT|UTTAR\s+PRADESH|DELHI|HARYANA|PUNJAB|CHHATTISGARH|UTTARAKHAND|BIHAR|JHARKHAND|WEST\s+BENGAL|ODISHA|KARNATAKA|TAMIL\s+NADU|TELANGANA|ANDHRA\s+PRADESH|KERALA|ASSAM)\s*-\s*([A-Z][A-Z .'-]{2,60})/i,
    );
    if (!stateLocation) continue;

    const value = clean(stateLocation[1] + "-" + stateLocation[2])
      .replace(/\s{2,}.*/, "")
      .replace(/[,:;]+$/, "")
      .trim();
    if (!isSafeRto(value) || !looksLikeRtoLocation(value)) continue;

    return {
      value,
      page: page + 1,
      evidence: "ICICI bounded RTO label window",
    };
  }
  return null;
}

function explicitRtoValue(pages: string[]): VehicleEvidence | null {
  for (let page = 0; page < Math.min(2, pages.length); page += 1) {
    const hit = explicitRtoFromText(pages[page] ?? "", page + 1);
    if (hit) return hit;
  }
  return null;
}

function explicitRtoFromText(text: string, page: number): VehicleEvidence | null {
  const lines = rawLines(text);
  for (let i = 0; i < lines.length; i += 1) {
    const same = lines[i].match(/RTO\s+(?:City|Location)\s*[:#-]\s*(.+)$/i);
    if (same) {
      const value = clean(same[1]).replace(/\s{2,}.*/, "").trim();
      if (isSafeRto(value) && looksLikeRtoLocation(value)) {
        return { value, page, evidence: "ICICI explicit RTO label: " + lines[i] };
      }
    }

    if (/^RTO\s+(?:City|Location)\s*:?$/i.test(lines[i])) {
      for (let j = i + 1; j <= Math.min(i + 10, lines.length - 1); j += 1) {
        const next = clean(lines[j] ?? "");
        if (!next || looksLikeRiskLabel(next) || looksLikeIdentifierLabel(next)) continue;
        if (isSafeRto(next) && looksLikeRtoLocation(next)) {
          return { value: next, page, evidence: "ICICI RTO nearby value: " + next };
        }
      }
    }
  }
  return null;
}

function structuredMoney(tables: StructuredPolicyTable[], label: RegExp): number | null {
  for (const table of tables) {
    for (let r = 0; r < table.rows.length; r += 1) {
      const row = table.rows[r] ?? [];
      for (let c = 0; c < row.length; c += 1) {
        const cell = clean(row[c] ?? "");
        if (!label.test(cell)) continue;
        const same = money(cell.replace(label, " "));
        if (same != null) return same;
        for (let right = c + 1; right < Math.min(row.length, c + 4); right += 1) {
          const found = money(clean(row[right] ?? ""));
          if (found != null) return found;
        }
        for (let next = r + 1; next <= Math.min(r + 2, table.rows.length - 1); next += 1) {
          const found = money(clean(table.rows[next]?.[c] ?? ""));
          if (found != null) return found;
        }
      }
    }
  }
  return null;
}

function findIciciTotalIdv(pages: string[]): VehicleEvidence | null {
  for (let page = 0; page < Math.min(2, pages.length); page += 1) {
    const text = pages[page] ?? "";
    const start = text.search(/Total\s+IDV/i);
    if (start < 0) continue;
    const rest = text.slice(start);
    const end = rest.search(/Premium\s+Details/i);
    const bounded = end >= 0 ? rest.slice(0, end) : rest.slice(0, 900);
    const matches = bounded.match(/\d[\d,]*(?:\.\d{1,2})?/g) ?? [];
    const values = matches
      .map((raw) => ({ raw, value: Number(raw.replace(/,/g, "")) }))
      .filter((entry) => Number.isFinite(entry.value) && entry.value >= 10000);
    const candidate = values.at(-1);
    if (candidate) {
      return {
        value: candidate.raw,
        page: page + 1,
        evidence: "ICICI Total IDV bounded vehicle-value block",
      };
    }
  }
  return null;
}

function safeRtoValue(hit: VehicleEvidence | null) {
  if (!hit || !isSafeRto(hit.value)) return null;
  return hit;
}

function looksLikeRtoLocation(value: string) {
  const cleaned = clean(value).toUpperCase();
  return /-/.test(cleaned)
    || /^(?:RAJASTHAN|MADHYA\s+PRADESH|MAHARASHTRA|GUJARAT|UTTAR\s+PRADESH|DELHI|HARYANA|PUNJAB|CHHATTISGARH|UTTARAKHAND|BIHAR|JHARKHAND|WEST\s+BENGAL|ODISHA|KARNATAKA|TAMIL\s+NADU|TELANGANA|ANDHRA\s+PRADESH|KERALA|ASSAM)\b/.test(cleaned);
}

function isSafeRto(value: string) {
  const cleaned = clean(value);
  return Boolean(cleaned)
    && cleaned.length <= 100
    && !/^(?:Hypothecated\s+To|Category|City|RTO\s+(?:City|Location)|Vehicle\s+Class|Vehicle\s+Registration(?:\s+No\.?|\s+Date)?|Engine\s+No\.?|Chassis\s+No\.?|Current\s+Year\s+NCB(?:\(%\))?|Vehicle\s+Usage)$/i.test(cleaned)
    && !/^(?:REGISTRATION|ENGINE|CHASSIS|CURRENTYEARNCB|VEHICLEUSAGE)$/i.test(compactId(cleaned))
    && /[A-Z]/i.test(cleaned);
}

function validVehicleId(value: string) {
  const compact = compactId(value);
  if (compact.length < 10 || compact.length > 24) return false;
  if (!/[A-Z]/.test(compact) || !/\d/.test(compact)) return false;
  return !/^(?:CHASSISNO|ENGINENO|CURRENTYEARNCB|VEHICLEUSAGE|HYPOTHECATEDTO)$/i.test(compact);
}

function normalizeVehicleMake(value: string) {
  const cleaned = cleanVehicle(value).toUpperCase();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 2 && parts[0].length >= 6 && parts[1].length <= 2 && /^[A-Z]+$/.test(parts[0] + parts[1])) {
    return parts.join("");
  }
  return cleaned;
}

function normalizeVehicleModel(value: string) {
  return cleanVehicle(value)
    .replace(/(\d)([A-Z])/g, "$1 $2")
    .replace(/([A-Z])(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function removeHeaderArtifacts(fields: Fields) {
  const invalid = /^(?:CATEGORY|MODEL|CITY|RTO\s*CITY|RTO\s*LOCATION|MAKE|VEHICLE\s+CLASS|VEHICLE\s+SUBCLASS)$/i;
  for (const key of ["vehicle_class", "vehicle_make", "vehicle_model", "vehicle_rto_name"]) {
    const value = fields.get(key)?.value?.trim() ?? "";
    if (!value || invalid.test(value)) fields.delete(key);
  }
  const idv = fields.get("idv");
  if (idv && money(idv.value) == null) fields.delete("idv");
}

function requireEvidence(fields: Fields, warnings: string[]) {
  const required = ["policy_number", "vehicle_registration_number", "vehicle_make", "vehicle_model", "idv", "total_premium", "gross_premium"];
  const missing = required.filter((key) => !fields.get(key)?.value?.trim());
  if (missing.length) warnings.push(`Review required. ICICI structured extraction could not safely prove: ${missing.join(", ")}.`);
}

function set(fields: Fields, key: string, value: string, confidence: number, page: number | null, evidence: string) {
  const cleanValue = value.trim();
  if (!cleanValue) return;
  fields.set(key, { key, label: LABELS[key] ?? key, value: cleanValue, confidence, page, evidence });
}

function setMoney(fields: Fields, key: string, value: number | null, confidence: number, page: number | null, evidence: string) {
  if (value == null || !Number.isFinite(value)) return;
  set(fields, key, Number.isInteger(value) ? String(value) : String(round2(value)), confidence, page, evidence);
}

function namedDate(raw: string) {
  const hit = raw.match(/^([A-Z][a-z]{2})\s+(\d{1,2}),\s+(\d{4})$/i);
  if (!hit) return null;
  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const month = months.indexOf(hit[1].slice(0, 3).toLowerCase()) + 1;
  if (!month) return null;
  const year = Number(hit[3]);
  const day = Number(hit[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function validRegistration(value: string) {
  return /^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}$/.test(value);
}

function compactId(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanVehicle(value: string) {
  return clean(value).replace(/\s{2,}/g, " ").trim();
}

function looksLikeLabel(value: string) {
  return /^(?:Name\s+of\s+the\s+Insured|Period\s+of\s+Insurance|Vehicle\s+Make|RTO\s+City|Vehicle\s+Registration|Engine\s+No|Chassis\s+No|Current\s+Year\s+NCB|Vehicle\s+Usage|Previous\s+Policy|Vehicle\s+Class|Category|Invoice\s+No)/i.test(value);
}

function rawLines(value: string) { return value.split(/\r?\n/).map(clean).filter(Boolean); }
function clean(value: string) { return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(); }
function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function close(a: number, b: number) { return Math.abs(a - b) <= MONEY_TOLERANCE; }
