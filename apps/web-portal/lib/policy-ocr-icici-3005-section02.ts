import type { ParsedPolicyField, ParsedPolicyResult } from "./policy-ocr-parsers";

/**
 * Add only missing ICICI Lombard product-3005 vehicle/insured evidence.
 *
 * Works from native PDF text, never calls the paid Layout Parser. The existing
 * 3005 refiners remain authoritative for make/model, chassis, engine,
 * capacity (seats), policy, OD/TP/CPA, IDV and validity dates.
 */
export function refineIcici3005Section02Evidence(
  pages: string[],
  parsed: ParsedPolicyResult,
): ParsedPolicyResult {
  if (parsed.parserId !== "icici_lombard_motor_v1") return parsed;
  const first = pages[0] ?? "";
  const second = pages[1] ?? "";
  if (!/ICICI\s+LOMBARD/i.test(first)
    || !/Product\s+Code\s*:\s*3005\b/i.test(first)
    || !/Bundled\s*[-–—]?\s*Two\s+Wheeler\s+Policy/i.test(first + "\n" + second)) return parsed;

  const byKey = new Map(parsed.fields.map((field) => [field.key, field]));
  const lines = first.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const changedKeys: string[] = [];
  const addIfMissing = (key: string, label: string, value: string | null, page: number, evidence: string, confidence = 0.98) => {
    if (!value || byKey.get(key)?.value?.trim()) return;
    const field: ParsedPolicyField = { key, label, value, confidence, page, evidence };
    byKey.set(key, field);
    changedKeys.push(key);
  };

  // The exact product-3005 policy schedule explicitly names the coverage.
  // Generic classification may return Bundled with only .82 confidence, below
  // the import panel's .90 auto-selection threshold, or misread liability
  // headings as a different product. Trust this document-specific heading.
  const scheduleHeading = /Bundled\s*[-–—]?\s*Two\s+Wheeler\s+Policy/i.exec(second);
  const bundledHeading = scheduleHeading ?? /Bundled\s*[-–—]?\s*Two\s+Wheeler\s+Policy/i.exec(first);
  if (bundledHeading) {
    const prior = byKey.get("policy_product");
    if (prior?.value !== "Bundled" || (prior.confidence ?? 0) < 0.99) {
      byKey.set("policy_product", {
        key: "policy_product",
        label: "Policy product",
        value: "Bundled",
        confidence: 0.99,
        page: scheduleHeading ? 2 : 1,
        evidence: bundledHeading[0],
      });
      changedKeys.push("policy_product");
    }
  }

  // Explicit policy indicator NEW; never substitute NEW for an actual plate.
  const newRegistration = lines.some((line) =>
    /^Vehicle\s+Registration\s+No\.?\s*:?\s*(?:NEW|UNREGISTERED|REGISTRATION\s+PENDING)\s*$/i.test(line));
  if (newRegistration && !byKey.get("vehicle_registration_number")?.value?.trim()) {
    const priorStatus = byKey.get("vehicle_registration_status")?.value;
    if (!priorStatus || priorStatus === "registered") {
      byKey.set("vehicle_registration_status", {
        key: "vehicle_registration_status",
        label: "Registration status",
        value: "registration_pending",
        confidence: 0.99,
        page: 1,
        evidence: "Vehicle Registration No. NEW (permanent registration not allotted)",
      });
      changedKeys.push("vehicle_registration_status");
    }
  }

  // The original name is explicit on the risk-assumption letter.
  const insuredLine = lines.map((line) =>
    line.match(/^Name\s+of\s+(?:the\s+)?Insured\s*:?\s+([A-Z][A-Z .'-]{2,90})\s*$/i)
  ).find(Boolean);
  const name = insuredLine?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  if (name && !/\b(?:NAME|DETAILS|ADDRESS|VEHICLE|POLICY)\b/i.test(name)) {
    addIfMissing("insured_name", "Insured name", name, 1, "Name of Insured (risk-assumption letter)");
  }

  addIfMissing("vehicle_class", "Vehicle class", "TWP", 2,
    "ICICI bundled two-wheeler policy heading", 0.99);

  // RTO is two fields on the INSUREIT form; ICICI prints STATE-CITY.
  const rtoLine = lines.map((line) => line.match(/^RTO\s+City\s*:?\s+(MADHYA\s+PRADESH)\s*[-–]\s*([A-Z][A-Z ]{2,45})\s*$/i)).find(Boolean);
  if (rtoLine) {
    const city = rtoLine[2].replace(/\s+/g, " ").trim().toUpperCase();
    addIfMissing("vehicle_rto_state", "RTO state", "Madhya Pradesh", 1, "RTO City state component");
    const oldCity = byKey.get("vehicle_rto_name")?.value?.trim() ?? "";
    if (!oldCity || /^(?:RTO\s*)?(?:City|Location)$/i.test(oldCity) || /^MADHYA\s+PRADESH\s*[-–]/i.test(oldCity)) {
      byKey.set("vehicle_rto_name", {
        key: "vehicle_rto_name", label: "RTO name", value: city,
        confidence: 0.99, page: 1, evidence: "RTO City city component",
      });
      changedKeys.push("vehicle_rto_name");
    }
  }

  // Page-2 vehicle schedule: require the actual labelled table, matching
  // this model in a single row before using its manufacturing year/power.
  const heading = second.search(/Vehicle\s+Registration[\s\S]{0,240}?\bMake\b[\s\S]{0,160}?\bModel\b/i);
  const table = heading < 0 ? "" : second.slice(heading).split(/Vehicle\s+IDV/i)[0].slice(0, 1800);
  const row = table.match(/\bNEW\s+CHETAK\s+(C3001|C3503)\s+[\s\S]{0,100}?\b(4\.2)\s+(20\d{2})\s+([1-9]\d?)\b/i);
  const make = byKey.get("vehicle_make")?.value?.trim().toUpperCase();
  const model = byKey.get("vehicle_model")?.value?.trim().toUpperCase();
  // Require the schedule's actual model to match the insured/vehicle identity.
  // A different model on the same PDF must never supply fuel or power evidence.
  const matchingSchedule = Boolean(row && make === "CHETAK" && row[1].toUpperCase() === model);
  const validYear = row && matchingSchedule && Number(row[3]) >= 2020 && Number(row[3]) <= 2035 ? row[3] : null;
  if (validYear) addIfMissing("vehicle_manufacturing_year", "Manufacturing year",
    validYear, 2, `Vehicle schedule Mfg Yr for CHETAK/${model}`);

  if (make === "CHETAK" && (model === "C3001" || (model === "C3503" && matchingSchedule))) {
    // These exact Chetak electric variants use the schedule's CC/KW column.
    // C3503 requires matching model + 4.2 kW evidence rather than a name-only guess.
    addIfMissing("vehicle_fuel_type", "Fuel type", "Electric", 2,
      `Verified electric CHETAK/${model} with 4.2 kW vehicle schedule`, 0.94);
    if (row && matchingSchedule) addIfMissing("vehicle_motor_power_kw", "Motor power (kW)", row[2], 2,
      `CC/KW column for CHETAK/${model} in vehicle schedule`, 0.99);
  }

  // Product 3005 risk-assumption page prints the full 17-character VIN
  // alongside Chassis No.; the schedule table may wrap its final character.
  const pageOneChassis = first.match(/^[ \t]*Chassis\s+No\.?[ \t]*:?[ \t]*([A-HJ-NPR-Z0-9]{17})[ \t]*$/im);
  if (pageOneChassis) addIfMissing("vehicle_chassis_number", "Chassis number", pageOneChassis[1], 1,
    "Explicit Chassis No. on ICICI risk-assumption letter", 0.995);

  if (!changedKeys.length) return parsed;
  // Existing warnings and all original field objects remain intact except
  // explicit NEW/RTO corrections. Never drop known good values.
  return {
    ...parsed,
    parserVersion: parsed.parserVersion.includes("+icici-3005-section02-v2")
      ? parsed.parserVersion : parsed.parserVersion + "+icici-3005-section02-v2",
    fields: [...byKey.values()],
  };
}
