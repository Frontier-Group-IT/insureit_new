import type { ParsedPolicyField, ParsedPolicyResult } from "@/lib/policy-ocr-parsers";
import type { StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";

type Fields = Map<string, ParsedPolicyField>;
type Hit = { value: string; page: number; evidence: string };
type MoneyHit = { value: number; page: number; evidence: string };
type Family = "digit_misd" | "iffco_misd" | "magma_pcp_package" | "national_twp_package";

const LABELS: Record<string, string> = {
  insurer_name: "Insurance company",
  policy_product: "Policy product",
  vehicle_registration_status: "Registration status",
  vehicle_registration_number: "Registration number",
  vehicle_class: "Vehicle class",
  vehicle_make: "Vehicle make",
  vehicle_model: "Vehicle model",
  vehicle_fuel_type: "Fuel type",
  vehicle_manufacturing_year: "Manufacturing year",
  vehicle_capacity: "Vehicle capacity",
  vehicle_chassis_number: "Chassis number",
  vehicle_engine_number: "Engine number",
  vehicle_rto_name: "RTO name",
  vehicle_rto_state: "RTO state",
  idv: "IDV / Sum insured",
  od_premium: "OD premium",
  tp_premium: "Third party premium",
  cpa_opted: "CPA opted",
  cpa_premium: "CPA amount",
  total_premium: "Printed net premium",
  tax_amount: "Printed GST",
  gross_premium: "Printed gross premium",
};

const VEHICLE_WEAK_KEYS = [
  "vehicle_class", "vehicle_make", "vehicle_model", "vehicle_fuel_type",
  "vehicle_manufacturing_year", "vehicle_capacity", "vehicle_chassis_number",
  "vehicle_engine_number", "vehicle_rto_name", "vehicle_rto_state",
];

export function refineProductionBenchmarkPolicy(
  pages: string[],
  tables: StructuredPolicyTable[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  const header = currentHeader(pages);
  const text = normalize(pages.join("\n"));
  const family = detectFamily(header, text);
  if (!family) return parsed;

  const fields: Fields = new Map(parsed.fields.map((field) => [field.key, field]));
  const warnings = parsed.warnings.filter((warning) => !/production benchmark round/i.test(warning));

  if (family === "digit_misd") refineDigitMisd(pages, tables, fields, text);
  else if (family === "iffco_misd") refineIffcoMisd(pages, tables, fields, text);
  else if (family === "magma_pcp_package") refineMagmaPcp(pages, tables, fields, text);
  else refineNationalTwpPackage(pages, tables, fields, text);

  financialSanity(fields);
  warnings.push(`Production benchmark round 1 refinement applied: ${family}.`);
  return {
    ...parsed,
    parserVersion: `${parsed.parserVersion}+prod-r1-${family}`,
    fields: [...fields.values()],
    warnings,
  };
}

function detectFamily(header: string, text: string): Family | null {
  if (/GO\s+DIGIT\s+GENERAL\s+INSURANCE/i.test(header)
      && /COMMERCIAL\s+VEHICLE|CASH\s+VAN|MISCELLANEOUS|SPECIAL\s+TYPE/i.test(text)
      && !/DIGIT\s+PRIVATE\s+CAR\s+POLICY/i.test(header)) return "digit_misd";

  if (/IFFCO[-\s]*TOKIO\s+GENERAL\s+INSURANCE/i.test(header)
      && /\bJCB\b|BACKHOE|EXCAVATOR|MISCELLANEOUS|SPECIAL\s+TYPE|CLASS\s+D/i.test(text)) return "iffco_misd";

  if (/MAGMA\s+GENERAL\s+INSURANCE|MAGMAINSURANCE\.COM/i.test(header)
      && /PRIVATE\s+CAR/i.test(text)
      && /PACKAGE/i.test(text)) return "magma_pcp_package";

  const nationalHeader = /NATIONAL\s+INSURANCE(?:\s+COMPANY)?|CUSTOMER\.SUPPORT@NIC\.CO\.IN|NIC\.CO\.IN/i.test(header);
  if (nationalHeader
      && /TWO\s*WHEELER|MOTOR\s*CYCLE|MOTORCYCLE|SCOOTER|MOTOR\s*BIKE/i.test(text)
      && /PACKAGE|OWN\s+DAMAGE|\bOD\s+COVER/i.test(text)) return "national_twp_package";

  return null;
}

function refineDigitMisd(pages: string[], tables: StructuredPolicyTable[], fields: Fields, text: string) {
  deleteKeys(fields, [...VEHICLE_WEAK_KEYS, "od_premium", "tp_premium", "total_premium", "tax_amount", "gross_premium"]);
  set(fields, "insurer_name", "Go Digit General Insurance Limited", .99, 1, "Current-policy Digit header");
  set(fields, "policy_product", "Package", .99, 1, "Digit commercial vehicle package");
  set(fields, "vehicle_class", "MISD", .99, 1, "Digit commercial miscellaneous/special-use layout");

  vehicleIdentity(pages, tables, fields, "digit");
  const registration = fields.get("vehicle_registration_number")?.value;
  applyRegistrationRto(fields, registration);

  const cpa = strictOwnerDriverPremium(tables, text, 3);
  if (cpa?.opted === true) {
    set(fields, "cpa_opted", "Yes", .99, cpa.page, cpa.evidence);
    set(fields, "cpa_premium", money(cpa.value), .99, cpa.page, cpa.evidence);
  } else {
    set(fields, "cpa_opted", "No", .98, cpa?.page ?? 1, cpa?.evidence ?? "No payable owner-driver PA row in the current premium schedule");
    set(fields, "cpa_premium", "0", .98, cpa?.page ?? 1, cpa?.evidence ?? "No payable owner-driver PA row in the current premium schedule");
  }

  const od = findMoney(tables, pages, /Total\s+(?:OD|Own\s+Damage)\s+Premium|Net\s+Own\s+Damage\s+Premium/i, 20, 1_000_000, "last");
  const tpTotal = findMoney(tables, pages, /Total\s+(?:TP|Act|Liability)\s+Premium|Net\s+Liability\s+Premium/i, 100, 1_000_000, "last");
  const basicTp = findMoney(tables, pages, /Basic\s+(?:Third[-\s]*Party|TP)(?:\s+Liability)?/i, 100, 1_000_000, "first");
  const driver = findMoney(tables, pages, /Legal\s+Liability\s+(?:to|for)\s+(?:Paid\s+)?Driver/i, 1, 10_000, "last");
  const tp = tpTotal ?? (basicTp ? { ...basicTp, value: round2(basicTp.value + (driver?.value ?? 0)), evidence: `${basicTp.evidence} | liability additions ${money(driver?.value ?? 0)}` } : null);
  if (od) putMoney(fields, "od_premium", od);
  if (tp) putMoney(fields, "tp_premium", tp);

  let net = findMoney(tables, pages, /(?:Total\s+)?Net\s+Premium|Taxable\s+Value|Total\s+Package\s+Premium/i, 100, 2_000_000, "largest");
  if (od && tp) net = { value: round2(od.value + tp.value + (cpa?.value ?? 0)), page: od.page, evidence: "OD + TP + owner-driver CPA reconciliation" };
  if (net) putMoney(fields, "total_premium", net);

  const tax = findTax(tables, pages, net, text);
  if (tax) putMoney(fields, "tax_amount", tax);
  const gross = findMoney(tables, pages, /Gross\s+Premium|Final\s+Premium|Total\s+Amount\s+Payable/i, 100, 5_000_000, "largest")
    ?? reconciledGross(net, tax);
  if (gross) putMoney(fields, "gross_premium", gross);
}

function refineIffcoMisd(pages: string[], tables: StructuredPolicyTable[], fields: Fields, text: string) {
  deleteKeys(fields, [...VEHICLE_WEAK_KEYS, "od_premium", "tp_premium", "cpa_opted", "cpa_premium", "tax_amount", "gross_premium"]);
  set(fields, "insurer_name", "IFFCO-TOKIO General Insurance Company Limited", .99, 1, "Current-policy IFFCO-TOKIO header");
  set(fields, "policy_product", "Package", .99, 1, "IFFCO commercial vehicle package");
  set(fields, "vehicle_class", "MISD", .99, 1, "IFFCO miscellaneous/special-type commercial layout");

  vehicleIdentity(pages, tables, fields, "iffco");
  if (!fields.get("vehicle_make") && /\bJCB\b/i.test(text)) set(fields, "vehicle_make", "JCB", .96, 1, "JCB vehicle schedule marker");
  applyRegistrationRto(fields, fields.get("vehicle_registration_number")?.value);

  const netValue = numericField(fields, "total_premium");
  const net = netValue && netValue > 0
    ? { value: netValue, page: fields.get("total_premium")?.page ?? 1, evidence: fields.get("total_premium")?.evidence ?? "Printed net premium" }
    : findMoney(tables, pages, /Taxable\s+Value|Net\s+Premium|Premium\s+Bifurcation/i, 100, 2_000_000, "largest");
  if (net && !fields.get("total_premium")) putMoney(fields, "total_premium", net);

  const basicTp = findMoney(tables, pages, /Basic\s+TP\s+Premium|Basic\s+Third[-\s]*Party(?:\s+Premium)?/i, 100, 1_000_000, "first");
  const driver = findMoney(tables, pages, /Legal\s+Liability\s+to\s+(?:Paid\s+)?Driver/i, 1, 10_000, "first");
  const tp = basicTp ? { ...basicTp, value: round2(basicTp.value + (driver?.value ?? 0)), evidence: `${basicTp.evidence} | legal-driver liability ${money(driver?.value ?? 0)}` } : null;

  const cpa = strictOwnerDriverPremium(tables, text, 3);
  const cpaValue = cpa?.opted ? cpa.value : 0;
  if (cpa?.opted) {
    set(fields, "cpa_opted", "Yes", .99, cpa.page, cpa.evidence);
    set(fields, "cpa_premium", money(cpa.value), .99, cpa.page, cpa.evidence);
  } else {
    set(fields, "cpa_opted", "No", .98, cpa?.page ?? 1, cpa?.evidence ?? "No payable current owner-driver PA row");
    set(fields, "cpa_premium", "0", .98, cpa?.page ?? 1, cpa?.evidence ?? "No payable current owner-driver PA row");
  }

  if (tp) putMoney(fields, "tp_premium", tp);
  if (net && tp) {
    const od = round2(net.value - tp.value - cpaValue);
    if (od >= 0 && od < net.value) putMoney(fields, "od_premium", { value: od, page: net.page, evidence: "Printed net - Basic TP/liability - current owner-driver CPA" });
  }

  const tax = findTax(tables, pages, net, text);
  if (tax) putMoney(fields, "tax_amount", tax);
  const gross = findMoney(tables, pages, /Gross\s+Premium(?:\s+Payable)?|Total\s+Premium\s+Payable|Grand\s+Total/i, 100, 5_000_000, "largest")
    ?? reconciledGross(net, tax);
  if (gross) putMoney(fields, "gross_premium", gross);
}

function refineMagmaPcp(pages: string[], tables: StructuredPolicyTable[], fields: Fields, text: string) {
  deleteKeys(fields, ["vehicle_make", "vehicle_model", "vehicle_fuel_type", "vehicle_rto_name", "vehicle_rto_state", "tp_premium", "cpa_opted", "cpa_premium"]);
  set(fields, "insurer_name", "Magma General Insurance Limited", .99, 1, "Current-policy Magma header");
  set(fields, "policy_product", "Package", .99, 1, "Magma private-car package");
  set(fields, "vehicle_class", "PCP", .99, 1, "Private-car package layout");
  vehicleIdentity(pages, tables, fields, "magma");
  trimRegistration(fields);
  applyRegistrationRto(fields, fields.get("vehicle_registration_number")?.value);

  const cpa = strictOwnerDriverPremium(tables, text, 2);
  if (cpa?.opted) {
    set(fields, "cpa_opted", "Yes", .99, cpa.page, cpa.evidence);
    set(fields, "cpa_premium", money(cpa.value), .99, cpa.page, cpa.evidence);
  } else if (cpa || explicitCpaOptOut(text)) {
    set(fields, "cpa_opted", "No", .99, cpa?.page ?? 1, cpa?.evidence ?? "Explicit owner-driver PA opt-out");
    set(fields, "cpa_premium", "0", .99, cpa?.page ?? 1, cpa?.evidence ?? "Explicit owner-driver PA opt-out");
  }

  const netValue = numericField(fields, "total_premium");
  const odValue = numericField(fields, "od_premium");
  const cpaValue = numericField(fields, "cpa_premium");
  if (netValue !== null && odValue !== null && cpaValue !== null) {
    const tp = round2(netValue - odValue - cpaValue);
    if (tp >= 0 && tp <= netValue) putMoney(fields, "tp_premium", { value: tp, page: fields.get("total_premium")?.page ?? 1, evidence: "Printed net - OD - current owner-driver CPA" });
  }
}

function refineNationalTwpPackage(pages: string[], tables: StructuredPolicyTable[], fields: Fields, text: string) {
  deleteKeys(fields, [...VEHICLE_WEAK_KEYS, "od_premium", "tp_premium", "cpa_opted", "cpa_premium", "total_premium", "tax_amount", "gross_premium"]);
  set(fields, "insurer_name", "National Insurance Company Limited", .99, 1, "Current-policy National Insurance header");
  set(fields, "policy_product", "Package", .99, 1, "Current two-wheeler package schedule");
  set(fields, "vehicle_class", "TWP", .99, 1, "Motor-cycle/two-wheeler package layout");
  vehicleIdentity(pages, tables, fields, "national");

  const registration = fields.get("vehicle_registration_number")?.value;
  if (!registration && /REGISTRATION\s+PENDING|NEW\s+VEHICLE|\bNEW\b/i.test(currentHeader(pages))) {
    set(fields, "vehicle_registration_status", "registration_pending", .99, 1, "New/unregistered vehicle in current schedule");
  }
  applyRegistrationRto(fields, registration);

  const cpa = strictOwnerDriverPremium(tables, text, 3);
  const cpaKnownNo = explicitCpaOptOut(text) || Boolean(cpa && !cpa.opted);
  if (cpa?.opted) {
    set(fields, "cpa_opted", "Yes", .99, cpa.page, cpa.evidence);
    set(fields, "cpa_premium", money(cpa.value), .99, cpa.page, cpa.evidence);
  } else if (cpaKnownNo) {
    set(fields, "cpa_opted", "No", .99, cpa?.page ?? 1, cpa?.evidence ?? "Explicit owner-driver PA opt-out");
    set(fields, "cpa_premium", "0", .99, cpa?.page ?? 1, cpa?.evidence ?? "Explicit owner-driver PA opt-out");
  } else {
    // Do not retain a weak PA candidate from policy wording pages.
    fields.delete("cpa_opted");
    fields.delete("cpa_premium");
  }

  const od = findMoney(tables, pages, /Own\s+Damage\s+Cover\s+Premium|Total\s+Own\s+Damage\s+Premium|Net\s+OD\s+Premium/i, 20, 500_000, "last", 4);
  const tp = findMoney(tables, pages, /Legal\s+Liability\s+Cover|Basic\s+(?:TP|Liability)|Third\s+Party\s+Premium/i, 100, 500_000, "last", 4);
  if (od) putMoney(fields, "od_premium", od);
  if (tp) putMoney(fields, "tp_premium", tp);
  const cpaValue = numericField(fields, "cpa_premium") ?? 0;
  const net = od && tp ? { value: round2(od.value + tp.value + cpaValue), page: od.page, evidence: "OD + TP + owner-driver CPA reconciliation" }
    : findMoney(tables, pages, /Net\s+Premium|Premium\s*₹|Total\s+Package\s+Premium/i, 100, 500_000, "last", 4);
  if (net) putMoney(fields, "total_premium", net);
  const tax = findTax(tables, pages, net, text, 4);
  if (tax) putMoney(fields, "tax_amount", tax);
  const gross = findMoney(tables, pages, /Gross\s+Premium|Total\s+Amount|Total\s+Payable/i, 100, 1_000_000, "last", 4)
    ?? reconciledGross(net, tax);
  if (gross) putMoney(fields, "gross_premium", gross);
}

function vehicleIdentity(pages: string[], tables: StructuredPolicyTable[], fields: Fields, family: Family | "digit" | "iffco" | "magma" | "national") {
  const make = findText(tables, pages, /^(?:Vehicle\s+)?Make(?:\s+of\s+Vehicle)?\s*[:/-]?$/i, validVehicleText, 4);
  const model = findText(tables, pages, /^(?:Vehicle\s+)?Model(?:\s*\/\s*Vehicle\s+Variant|\s*-\s*Variant|\s+of\s+Vehicle)?\s*[:/-]?$/i, validVehicleText, 4);
  const fuel = findText(tables, pages, /^(?:Type\s+of\s+)?Fuel(?:\s+Type)?\s*:?$/i, (value) => /PETROL|DIESEL|CNG|LPG|ELECTRIC|BATTERY|HYBRID/i.test(value), 3);
  const year = findText(tables, pages, /Year\s+of\s+(?:Manufacture|Mfg)|Manufacturing\s+Year|Mfg\.?\s*Year|^Year$/i, (value) => /^(?:19|20)\d{2}$/.test(clean(value)), 4);
  const chassis = findText(tables, pages, /Chassis\s*(?:No\.?|Number)?/i, validChassis, 4);
  const engine = findText(tables, pages, /Engine(?:\s+or\s+M\/C)?\s*(?:No\.?|Number)?/i, validEngine, 4);
  const capacity = findText(tables, pages, /GVW|Gross\s+Vehicle\s+Weight|Seating\s+Capacity|Cubic\s+Capacity|^CC$/i, validCapacity, 4);

  if (make) set(fields, "vehicle_make", canonicalMake(make.value), .98, make.page, make.evidence);
  if (model) set(fields, "vehicle_model", canonicalModel(model.value), .98, model.page, model.evidence);
  if (fuel) set(fields, "vehicle_fuel_type", canonicalFuel(fuel.value), .98, fuel.page, fuel.evidence);
  if (year) set(fields, "vehicle_manufacturing_year", clean(year.value), .98, year.page, year.evidence);
  if (chassis) set(fields, "vehicle_chassis_number", compact(chassis.value), .98, chassis.page, chassis.evidence);
  if (engine) set(fields, "vehicle_engine_number", compact(engine.value), .98, engine.page, engine.evidence);
  if (capacity) {
    let value = clean(capacity.value).replace(/,/g, "");
    if ((family === "digit" || family === "digit_misd") && /^\d{3,6}$/.test(value)) value = `${value}KG`;
    set(fields, "vehicle_capacity", value, .96, capacity.page, capacity.evidence);
  }
}

function findText(
  tables: StructuredPolicyTable[],
  pages: string[],
  label: RegExp,
  accept: (value: string) => boolean,
  maxPage = 4,
): Hit | null {
  for (const table of tables) {
    if (table.page > maxPage) continue;
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
      const row = table.rows[rowIndex].map(clean);
      for (let column = 0; column < row.length; column += 1) {
        const cell = row[column];
        if (!test(label, cell)) continue;
        const inline = clean(cell.replace(label, ""));
        label.lastIndex = 0;
        for (const candidate of [inline, ...row.slice(column + 1)]) {
          if (candidate && accept(candidate) && !headingGarbage(candidate)) return { value: candidate, page: table.page, evidence: safe(`${cell} | ${candidate}`) };
        }
        for (let next = rowIndex + 1; next <= Math.min(rowIndex + 3, table.rows.length - 1); next += 1) {
          const candidate = clean(table.rows[next][column] ?? "");
          if (candidate && accept(candidate) && !headingGarbage(candidate)) return { value: candidate, page: table.page, evidence: safe(`${cell} | ${candidate}`) };
        }
      }
    }
  }

  for (let pageIndex = 0; pageIndex < Math.min(pages.length, maxPage); pageIndex += 1) {
    const lines = pages[pageIndex].split(/\r?\n/).map(clean).filter(Boolean);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (!test(label, line)) continue;
      const match = line.match(label);
      label.lastIndex = 0;
      const after = clean(line.slice((match?.index ?? 0) + (match?.[0]?.length ?? 0)));
      for (const candidate of [after, ...lines.slice(lineIndex + 1, lineIndex + 3)]) {
        if (candidate && accept(candidate) && !headingGarbage(candidate)) return { value: candidate, page: pageIndex + 1, evidence: safe(`${line} | ${candidate}`) };
      }
    }
  }
  return null;
}

function findMoney(
  tables: StructuredPolicyTable[],
  pages: string[],
  label: RegExp,
  min: number,
  max: number,
  mode: "first" | "last" | "largest" = "last",
  maxPage = 8,
): MoneyHit | null {
  const hits: MoneyHit[] = [];
  for (const table of tables) {
    if (table.page > maxPage) continue;
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
      const row = table.rows[rowIndex].map(clean);
      for (let column = 0; column < row.length; column += 1) {
        const cell = row[column];
        if (!test(label, cell)) continue;
        const sources = [row.slice(column + 1).join(" "), cell.replace(label, ""), table.rows[rowIndex + 1]?.[column] ?? ""];
        label.lastIndex = 0;
        for (const source of sources) {
          const values = moneyValues(source).filter((value) => value >= min && value <= max && !isYear(value) && !percentLike(value, source));
          if (values.length) {
            hits.push({ value: pick(values, mode), page: table.page, evidence: safe(row.join(" | ")) });
            break;
          }
        }
      }
    }
  }
  if (hits.length) return chooseMoney(hits, mode);

  for (let pageIndex = 0; pageIndex < Math.min(pages.length, maxPage); pageIndex += 1) {
    const lines = pages[pageIndex].split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (!test(label, lines[index])) continue;
      const match = lines[index].match(label);
      label.lastIndex = 0;
      const after = lines[index].slice((match?.index ?? 0) + (match?.[0]?.length ?? 0));
      for (const source of [after, lines[index + 1] ?? ""]) {
        const values = moneyValues(source).filter((value) => value >= min && value <= max && !isYear(value) && !percentLike(value, source));
        if (values.length) hits.push({ value: pick(values, mode), page: pageIndex + 1, evidence: safe(`${lines[index]} | ${source}`) });
      }
    }
  }
  return chooseMoney(hits, mode);
}

function strictOwnerDriverPremium(tables: StructuredPolicyTable[], text: string, maxPage: number): { value: number; opted: boolean; page: number; evidence: string } | null {
  if (explicitCpaOptOut(text)) return { value: 0, opted: false, page: 1, evidence: "Explicit owner-driver PA/CPA opt-out in current policy" };
  for (const table of tables) {
    if (table.page > maxPage) continue;
    for (const row of table.rows) {
      const joined = clean(row.join(" | "));
      if (!/(?:COMPULSORY\s+)?P\.?A\.?\s+(?:COVER\s+)?(?:FOR\s+)?OWNER[-\s]*DRIVER|OWNER[-\s]*DRIVER\s+(?:CPA|P\.?A\.?)/i.test(joined)) continue;
      if (/PAID\s+DRIVER|EMPLOYEE|PASSENGER|WORKMEN/i.test(joined)) continue;
      const sanitized = joined.replace(/(?:CSI|SUM\s+INSURED)[^|]{0,80}/gi, " ").replace(/\b(?:5|9|18|28|100)\s*%/g, " ");
      const values = moneyValues(sanitized).filter((value) => value >= 0 && value <= 5000 && !isYear(value));
      const premium = values.find((value) => value > 0) ?? (values.includes(0) ? 0 : null);
      if (premium !== null) return { value: premium, opted: premium > 0, page: table.page, evidence: safe(joined) };
    }
  }
  return null;
}

function findTax(tables: StructuredPolicyTable[], pages: string[], net: MoneyHit | null, text: string, maxPage = 8): MoneyHit | null {
  const total = findMoney(tables, pages, /Total\s+(?:GST|IGST)|GST\s+Amount|Tax\s+Amount/i, 1, 1_000_000, "last", maxPage);
  if (total) return total;
  const cgst = findMoney(tables, pages, /\bCGST\b/i, 1, 1_000_000, "last", maxPage);
  const sgst = findMoney(tables, pages, /\b(?:SGST|UTGST)\b/i, 1, 1_000_000, "last", maxPage);
  if (cgst && sgst) return { value: round2(cgst.value + sgst.value), page: cgst.page, evidence: `${cgst.evidence} | ${sgst.evidence}` };
  const igst = findMoney(tables, pages, /\bIGST\b/i, 1, 1_000_000, "last", maxPage);
  if (igst && ![5, 9, 18].includes(igst.value)) return igst;
  if (net && /(?:GST|IGST)[^\n|]{0,30}18\s*%|18\s*%[^\n|]{0,30}(?:GST|IGST)/i.test(text)) {
    return { value: round4(net.value * .18), page: net.page, evidence: "Printed net × explicit 18% GST rate" };
  }
  return null;
}

function reconciledGross(net: MoneyHit | null, tax: MoneyHit | null): MoneyHit | null {
  if (!net || !tax) return null;
  return { value: round4(net.value + tax.value), page: net.page, evidence: "Printed net + GST reconciliation" };
}

function applyRegistrationRto(fields: Fields, registration?: string) {
  if (!registration) return;
  const normalized = compact(registration);
  const match = normalized.match(/^([A-Z]{2})(\d{2})/);
  if (!match) return;
  set(fields, "vehicle_rto_name", `${match[1]}${match[2]}`, .97, fields.get("vehicle_registration_number")?.page ?? 1, "Derived from registration series");
  set(fields, "vehicle_rto_state", match[1], .97, fields.get("vehicle_registration_number")?.page ?? 1, "Derived from registration series");
}

function trimRegistration(fields: Fields) {
  const field = fields.get("vehicle_registration_number");
  if (!field) return;
  const compacted = compact(field.value);
  const match = compacted.match(/^([A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4})/);
  if (match) fields.set("vehicle_registration_number", { ...field, value: match[1] });
}

function financialSanity(fields: Fields) {
  const od = numericField(fields, "od_premium");
  const tp = numericField(fields, "tp_premium");
  const cpa = numericField(fields, "cpa_premium");
  const net = numericField(fields, "total_premium");
  const tax = numericField(fields, "tax_amount");
  const gross = numericField(fields, "gross_premium");
  if (od !== null && od < 0) fields.delete("od_premium");
  if (tp !== null && tp < 0) fields.delete("tp_premium");
  if (cpa !== null && cpa < 0) fields.delete("cpa_premium");
  if (net !== null && tp !== null && tp > net * 1.05) fields.delete("tp_premium");
  if (net !== null && od !== null && od > net * 1.05) fields.delete("od_premium");
  if (net !== null && tax !== null && gross !== null && Math.abs(net + tax - gross) > Math.max(2, gross * .03)) {
    fields.delete("gross_premium");
  }
}

function explicitCpaOptOut(text: string) {
  return /(?:REASON\s+FOR\s+)?NOT\s+OPT(?:ED|ING).*?(?:PA|CPA)|(?:PA|CPA).*?(?:NOT\s+OPTED|REMOVED|DELETED|NOT\s+APPLICABLE)|DO\s+NOT\s+HOLD\s+A\s+VALID\s+DRIVING\s+LICEN[CS]E/i.test(text);
}

function validVehicleText(value: string) {
  const v = clean(value);
  return v.length >= 2 && v.length <= 90 && /[A-Z0-9]/i.test(v) && !headingGarbage(v);
}
function validChassis(value: string) {
  const v = compact(value);
  return v.length >= 10 && v.length <= 24 && /[A-Z]/.test(v) && /\d/.test(v) && !/^(?:MP|DL|HR|UP|RJ)\d{2}[A-Z]{1,3}\d{4}$/.test(v);
}
function validEngine(value: string) {
  const v = compact(value);
  return v.length >= 6 && v.length <= 22 && /[A-Z]/.test(v) && /\d/.test(v) && !/PROTECT|COVER|POLICY/.test(v);
}
function validCapacity(value: string) {
  const v = clean(value);
  return /\d/.test(v) && v.length <= 20 && !/%/.test(v);
}
function headingGarbage(value: string) {
  return /^(?:OF\s+VEHICLE|MODEL|MODEL\s*\/\s*VEHICLE\s+VARIANT|VEHICLE\s+VARIANT|MAKE|MAKE\s*\/\s*MODEL|LOCATION|NO\.?|PROTECT|S\s*-\s*CLASS\s+D|MAKEMODELTYPEOFBODY|TYPE\s+OF\s+BODY|YEAR\s+OF\s+MFG)$/i.test(clean(value))
    || /COMMENCEMENT\s+OF\s+INSURANCE|WITHIN\s+60\s+DAYS/i.test(value);
}
function canonicalMake(value: string) {
  const v = clean(value);
  if (/MAHINDRA(?:\s+AND\s+MAHINDRA)?/i.test(v)) return "Mahindra";
  if (/MARUTI(?:\s+SUZUKI)?/i.test(v)) return "Maruti Suzuki";
  if (/\bTATA(?:\s+MOTORS?)?\b/i.test(v)) return "Tata";
  if (/\bJCB\b/i.test(v)) return "JCB";
  if (/\bHERO\b/i.test(v)) return "Hero";
  return v;
}
function canonicalModel(value: string) {
  return clean(value)
    .replace(/^\/?\s*(?:MODEL\s*\/\s*)?VEHICLE\s+VARIANT\s*[:/-]?\s*/i, "")
    .replace(/^(?:MAHINDRA(?:\s+AND\s+MAHINDRA)?|MARUTI(?:\s+SUZUKI)?|TATA(?:\s+MOTORS?)?|JCB|HERO)\s*[-/:]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
function canonicalFuel(value: string) {
  const v = value.toUpperCase();
  if (/CNG/.test(v)) return "CNG";
  if (/DIESEL/.test(v)) return "Diesel";
  if (/PETROL/.test(v)) return "Petrol";
  if (/ELECTRIC|BATTERY/.test(v)) return "Electric";
  if (/HYBRID/.test(v)) return "Hybrid";
  if (/LPG/.test(v)) return "LPG";
  return clean(value);
}

function deleteKeys(fields: Fields, keys: string[]) { for (const key of keys) fields.delete(key); }
function numericField(fields: Fields, key: string): number | null {
  const value = fields.get(key)?.value;
  if (!value) return null;
  const parsed = Number(value.replace(/[₹,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
function putMoney(fields: Fields, key: string, hit: MoneyHit) { set(fields, key, money(hit.value), .99, hit.page, hit.evidence); }
function set(fields: Fields, key: string, value: string, confidence: number, page: number | null, evidence: string) {
  const normalized = clean(value);
  if (!normalized) return;
  fields.set(key, { key, label: LABELS[key] ?? key, value: normalized, confidence, page, evidence: safe(evidence) });
}
function moneyValues(value: string) {
  return [...value.matchAll(/\d[\d,]*(?:\.\d{1,4})?/g)]
    .map((match) => Number(match[0].replace(/,/g, "")))
    .filter(Number.isFinite);
}
function percentLike(value: number, source: string) {
  return [5, 9, 18, 28, 100].includes(value) && new RegExp(`\\b${value}\\s*%`, "i").test(source);
}
function isYear(value: number) { return Number.isInteger(value) && value >= 1900 && value <= 2100; }
function pick(values: number[], mode: "first" | "last" | "largest") { return mode === "first" ? values[0] : mode === "largest" ? Math.max(...values) : values[values.length - 1]; }
function chooseMoney(values: MoneyHit[], mode: "first" | "last" | "largest") {
  if (!values.length) return null;
  return mode === "first" ? values[0] : mode === "largest" ? values.reduce((best, value) => value.value > best.value ? value : best) : values[values.length - 1];
}
function test(regex: RegExp, value: string) { regex.lastIndex = 0; const result = regex.test(value); regex.lastIndex = 0; return result; }
function clean(value: string) { return value.replace(/\s+/g, " ").trim().replace(/^[:|\-\s]+|[:|\-\s]+$/g, ""); }
function normalize(value: string) { return value.replace(/\s+/g, " ").trim(); }
function compact(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
function currentHeader(pages: string[]) { return normalize((pages[0] ?? "").split(/\r?\n/).slice(0, 55).join(" ")).slice(0, 8000); }
function safe(value: string) { return normalize(value).slice(0, 400); }
function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function round4(value: number) { return Math.round((value + Number.EPSILON) * 10000) / 10000; }
function money(value: number) { const rounded = round4(value); return String(rounded).replace(/\.0+$/, ""); }
