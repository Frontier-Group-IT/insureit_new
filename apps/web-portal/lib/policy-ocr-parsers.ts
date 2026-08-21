export type ParsedPolicyField = {
  key: string;
  label: string;
  value: string;
  confidence: number | null;
  page: number | null;
  evidence: string;
};

export type ParsedPolicyResult = {
  parserId: string;
  parserVersion: string;
  fields: ParsedPolicyField[];
  warnings: string[];
};

const LABELS: Record<string, string> = {
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

const REQUIRED = new Set([
  "policy_product", "idv", "od_premium", "tp_premium",
  "policy_number", "insurer_name", "policy_start_date", "policy_end_date",
]);

const MONEY = "(?:₹|Rs\\.?|INR)?\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)";
const DATE = "([0-9]{1,2}[-/](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|[0-9]{1,2})[-/][0-9]{2,4}|[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2})";

type InsurerFamily =
  | "digit"
  | "iffco"
  | "new_india"
  | "shriram"
  | "oriental"
  | "national"
  | "universal_sompo"
  | "united_india"
  | "generic";

export function parsePolicyDocument(pages: string[]): ParsedPolicyResult {
  const cleanPages = pages.map(sanitizeText).filter(Boolean);
  const family = detectInsurerFamily(cleanPages);

  let result: ParsedPolicyResult;
  if (family === "digit") {
    result = parseDigit(cleanPages);
  } else if (family === "iffco") {
    result = parseIffco(cleanPages);
  } else if (family === "new_india") {
    result = parseNewIndia(cleanPages);
  } else if (family === "shriram" || family === "oriental" || family === "national" || family === "universal_sompo" || family === "united_india") {
    result = parseKnownInsurer(cleanPages, family);
  } else {
    result = parseGeneric(cleanPages);
  }

  const present = new Set(result.fields.map((field) => field.key));
  for (const field of extractVehicleFields(cleanPages)) {
    if (!present.has(field.key)) {
      result.fields.push(field);
      present.add(field.key);
    }
  }
  const missing = [...REQUIRED].filter((key) => !present.has(key));
  if (missing.length) result.warnings.push(`Review required. Missing or uncertain fields: ${missing.join(", ")}.`);
  return result;
}

export function extractVehicleFields(pages: string[]): ParsedPolicyField[] {
  const add = fieldCollector();
  const labeledRegistration = find(pages, [
    /(?:Registration|Regn\.?)\s*(?:No\.?|Number)\s*[:\-]?\s*([A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4})/i,
  ]);
  const registration = labeledRegistration ?? find(pages, [
    /\b([A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4})\b/i,
  ]);
  const registrationConfidence = labeledRegistration ? .96 : .72;
  const pending = findEvidence(pages, /\b(?:registration\s+pending|unregistered|new\s+vehicle)\b/i);
  if (pending) add("vehicle_registration_status", "registration_pending", .96, pending.evidence, pending.page);
  else if (registration) add("vehicle_registration_status", "registered", registrationConfidence, registration.evidence, registration.page);
  if (registration) add("vehicle_registration_number", compactVehicleId(registration.value), registrationConfidence, registration.evidence, registration.page);

  addFound(add, "vehicle_chassis_number", find(pages, [
    /(?:Chassis|Chasis)\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{7,29})/i,
  ]), .96, compactVehicleId);
  addFound(add, "vehicle_engine_number", find(pages, [
    /Engine\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-/]{5,29})/i,
  ]), .96, compactVehicleId);
  addFound(add, "vehicle_manufacturing_year", find(pages, [
    /(?:Year\s+of\s+Manufacture|Manufactur(?:ing|e)\s+Year|Mfg\.?\s*Year)\s*[:\-]?\s*((?:19|20)\d{2})/i,
  ]), .94);
  addFound(add, "vehicle_fuel_type", find(pages, [
    /Fuel\s*(?:Type)?\s*[:\-]?\s*(PETROL|DIESEL|CNG|LPG|ELECTRIC|HYBRID|BATTERY)/i,
  ]), .94, titleCase);
  addFound(add, "vehicle_class", find(pages, [
    /(?:Class\s+of\s+Vehicle|Vehicle\s+Class|Type\s+of\s+Vehicle)\s*[:\-]?\s*([^\n|]{2,60})/i,
  ]), .9, cleanVehicleText);
  addFound(add, "vehicle_make", find(pages, [
    /(?:Vehicle\s+)?Make\s*[:\-]?\s*([^\n|]{2,50})/i,
    /Make\s*\/\s*Model\s*[:\-]?\s*([A-Z0-9 .&()\-]{2,35})\s*\/\s*[A-Z0-9]/i,
  ]), .9, cleanVehicleText);
  addFound(add, "vehicle_model", find(pages, [
    /(?:Vehicle\s+)?Model\s*[:\-]?\s*([^\n|]{2,60})/i,
    /Make\s*\/\s*Model\s*[:\-]?\s*[A-Z0-9 .&()\-]{2,35}\s*\/\s*([A-Z0-9 .&()\-]{2,45})/i,
  ]), .9, cleanVehicleText);
  addFound(add, "vehicle_capacity", find(pages, [
    /(?:Gross\s+Vehicle\s+Weight|GVW)\s*[:\-]?\s*([0-9,]+\s*(?:KG|KGS)?)/i,
    /(?:Cubic\s+Capacity|Engine\s+Capacity|CC)\s*[:\-]?\s*([0-9,]+\s*(?:CC)?)\b/i,
    /(?:Seating\s+Capacity|Seating\s+Cap)\s*[:\-]?\s*([0-9]+(?:\s*\+\s*[0-9]+)?)/i,
  ]), .92, cleanVehicleText);
  addFound(add, "vehicle_rto_name", find(pages, [
    /(?:Registering\s+Authority|RTO\s+Name|RTO(?!\s+State))\s*[:\-]?\s*([^\n|]{2,60})/i,
  ]), .86, cleanVehicleText);
  addFound(add, "vehicle_rto_state", find(pages, [
    /RTO\s+State\s*[:\-]?\s*([^\n|]{2,40})/i,
  ]), .9, cleanVehicleText);
  return add.fields;
}

function detectInsurerFamily(pages: string[]): InsurerFamily {
  const text = pages.join("\n");
  const upper = text.toUpperCase();
  const firstPage = (pages[0] ?? "").slice(0, 12000).toUpperCase();

  let digit = 0;
  let iffco = 0;
  let newIndia = 0;
  let shriram = 0;
  let oriental = 0;
  let national = 0;
  let universalSompo = 0;
  let unitedIndia = 0;

  // Insurer names near the beginning of page 1 are the strongest evidence.
  if (/GO\s+DIGIT\s+GENERAL\s+INSURANCE/.test(firstPage)) digit += 12;
  if (/IFFCO[-\s]*TOKIO\s+GENERAL\s+INSURANCE/.test(firstPage)) iffco += 12;
  if (/THE\s+NEW\s+INDIA\s+ASSURANCE|NEW\s+INDIA\s+ASSURANCE\s+COMPANY/.test(firstPage)) newIndia += 12;
  if (/SHRIRAM\s+GENERAL\s+INSURANCE/.test(firstPage)) shriram += 12;
  if (/THE\s+ORIENTAL\s+INSURANCE\s+COMPANY|ORIENTAL\s+INSURANCE/.test(firstPage)) oriental += 12;
  if (/NATIONAL\s+INSURANCE(?:\s+COMPANY)?|customer\.support@nic\.co\.in/i.test(firstPage)) national += 12;
  if (/UNIVERSAL\s+SOMPO\s+GENERAL\s+INSURANCE/.test(firstPage)) universalSompo += 12;
  if (/UNITED\s+INDIA\s+INSURANCE/.test(firstPage)) unitedIndia += 12;

  // Family-specific schedule structure is more reliable than one stray insurer phrase.
  if (/DIGIT\s+COMMERCIAL\s+VEHICLE\s+(?:COMPREHENSIVE|PACKAGE)\s+POLICY/i.test(text)) digit += 8;
  if (/\bPolicy\s*No\.?\s*[:\-]?\s*D\d{6,15}\b/i.test(text)) digit += 5;
  if (/Invoice\s+Number\s+Invoice\s+Date\s+Net\s+Premium\s+Igst/i.test(text)) digit += 3;

  if (/P400\s*Policy\s*#\s*N\d{6,15}/i.test(text)) iffco += 10;
  if (/COMMERCIAL\s+VEHICLE\s+CERTIFICATE\s+OF\s+INSURANCE\s+cum\s+SCHEDULE\s*&\s*TAX\s+INVOICE/i.test(text)) iffco += 6;
  if (/Net\s*\(A\)[^\n]{0,120}Net\s*\(B\)/i.test(text)) iffco += 3;

  if (/GOODS\s+CARRYING\s+VEHICLE\s+PACKAGE\s+POLICY|COMMERCIAL\s+VEHICLE\s+PACKAGE\s+POLICY/i.test(text)) newIndia += 7;
  if (/Net\s+Own\s+Damage\s+Premium\s*\(A\)/i.test(text) && /Net\s+Liability\s+Premium\s*\(B\)/i.test(text)) newIndia += 5;
  if (/\b\d{18,25}\b/.test(text) && /Own\s+Damage\s+Period|Motor\s+Liability\s+Period/i.test(text)) newIndia += 3;

  if (/MOTOR\s+GOODS\s+VEHICLE\s+\(PACKAGE\s+POLICY\)|SCHEDULE\s+OF\s+PREMIUM[\s\S]{0,500}?OD\s+TOTAL/i.test(text)) shriram += 7;
  if (/GOODS\s+CARRIERS\s+OTHER\s+THAN\s+THREE\s+WHEELERS\s+PACKAGE\s+POLICY|MOTOR\s+INSURANCE\s+CERTIFICATE\s+CUM\s+POLICY\s+SCHEDULE/i.test(text)) oriental += 7;
  if (/Policy\s+Schedule-Motor\s+-\s+Goods\s+Carrying\s+Vehicle\s+-\s+Package|customer\.support@nic\.co\.in|Vehicle\s+IDV\s*₹/i.test(text)) national += 8;
  if (/Motor\s+Private\s+Car\s+-\s+Bundled|Certificate\s+of\s+Insurance\s+cum\s+Policy\s+Schedule|TOTAL\s+PACKAGE\s+PREMIUM/i.test(text)) universalSompo += 8;
  if (/PCV\s+4\s+WHEELER[\s\S]{0,120}?PACKAGE|MOTOR\s+INSURANCE\s+-\s+PCV|Gross\s+OD\s*&\s*TP/i.test(text)) unitedIndia += 8;

  // Full-document legal-name evidence is useful, but intentionally weaker than page-1/header evidence.
  if (/GO\s+DIGIT\s+GENERAL\s+INSURANCE/.test(upper)) digit += 2;
  if (/IFFCO[-\s]*TOKIO\s+GENERAL\s+INSURANCE/.test(upper)) iffco += 2;
  if (/THE\s+NEW\s+INDIA\s+ASSURANCE|NEW\s+INDIA\s+ASSURANCE\s+COMPANY/.test(upper)) newIndia += 2;
  if (/SHRIRAM\s+GENERAL\s+INSURANCE/.test(upper)) shriram += 2;
  if (/THE\s+ORIENTAL\s+INSURANCE\s+COMPANY|ORIENTAL\s+INSURANCE/.test(upper)) oriental += 2;
  if (/NATIONAL\s+INSURANCE(?:\s+COMPANY)?/.test(upper)) national += 2;
  if (/UNIVERSAL\s+SOMPO\s+GENERAL\s+INSURANCE/.test(upper)) universalSompo += 2;
  if (/UNITED\s+INDIA\s+INSURANCE/.test(upper)) unitedIndia += 2;

  const ranked = [
    { family: "digit" as const, score: digit },
    { family: "iffco" as const, score: iffco },
    { family: "new_india" as const, score: newIndia },
    { family: "shriram" as const, score: shriram },
    { family: "oriental" as const, score: oriental },
    { family: "national" as const, score: national },
    { family: "universal_sompo" as const, score: universalSompo },
    { family: "united_india" as const, score: unitedIndia },
  ].sort((a, b) => b.score - a.score);

  if (ranked[0].score < 5) return "generic";
  if (ranked[0].score === ranked[1].score) return "generic";
  return ranked[0].family;
}

function parseDigit(pages: string[]): ParsedPolicyResult {
  const add = fieldCollector();
  const text = pages.join("\n");
  add("insurer_name", "Digit General Insurance Limited", .99, "Go Digit General Insurance Ltd.", 1);
  add("policy_product", "Package", .99, firstLine(text, ["COMPREHENSIVE", "PACKAGE"]), 1);

  const policy = find(pages, [/Policy\s*No\.?\s*[:\-]?\s*(D\d{6,15})/i, /\b(D\d{6,15})\b/i]);
  if (policy) add("policy_number", policy.value, .99, policy.evidence, policy.page);

  const period = findPeriod(pages, [
    new RegExp(`Period\\s*of\\s*Policy[\\s\\S]{0,220}?From\\s*${DATE}[\\s\\S]{0,120}?To\\s*${DATE}`, "i"),
    new RegExp(`From\\s*${DATE}\\s+[0-9]{1,2}:[0-9]{2}:[0-9]{2}[\\s\\S]{0,100}?To\\s*${DATE}`, "i"),
    new RegExp(`\\b${DATE}\\s+${DATE}\\s+Digit\\s+Commercial\\s+Vehicle\\s+Comprehensive\\s+Policy`, "i"),
  ]);
  addPeriod(add, period, .99);

  const idv = moneyNear(pages, ["Total IDV", "Vehicle IDV"], true);
  if (idv) add("idv", formatMoney(idv.value), .99, idv.evidence, idv.page);

  const od = moneyPattern(pages, [new RegExp(`Own\\s*Damage\\s*Premium[^\\n]{0,80}?${MONEY}`, "i"), new RegExp(`Total\\s*OD\\s*Premium[^\\n]{0,80}?${MONEY}`, "i")]);
  const tp = moneyPattern(pages, [new RegExp(`Basic\\s*Third[-\\s]*Party\\s*Liability[^\\n]{0,80}?${MONEY}`, "i"), new RegExp(`Total\\s*Act\\s*Premium[^\\n]{0,80}?${MONEY}`, "i")]);
  if (od) add("od_premium", formatMoney(od.value), .99, od.evidence, od.page);
  if (tp) add("tp_premium", formatMoney(tp.value), .99, tp.evidence, tp.page);

  const cpa = moneyPattern(pages, [new RegExp(`PA\\s*cover\\s*for\\s*Owner[-\\s]*Driver[^\\n]{0,80}?${MONEY}\\s*$`, "im")]);
  if (cpa && cpa.value > 0) {
    add("cpa_premium", formatMoney(cpa.value), .98, cpa.evidence, cpa.page);
    add("cpa_opted", "Yes", .99, cpa.evidence, cpa.page);
  } else {
    add("cpa_premium", "0", .99, "PA cover for Owner-Driver: --", 1);
    add("cpa_opted", "No", .99, "PA cover for Owner-Driver: --", 1);
  }

  const invoice = text.match(/Invoice\s+Number\s+Invoice\s+Date\s+Net\s+Premium\s+Igst[\s\S]{0,180}?\b[A-Z0-9]+\s+\d{4}-\d{2}-\d{2}\s+([0-9,.]+)\s+([0-9,.]+)(?:\s+[0-9,.]+){4}\s+([0-9,.]+)/i);
  if (invoice) {
    add("total_premium", normalizeMoney(invoice[1]), .99, invoice[0], 2);
    add("tax_amount", normalizeMoney(invoice[2]), .99, invoice[0], 2);
    add("gross_premium", normalizeMoney(invoice[3]), .99, invoice[0], 2);
  } else {
    addPremiumTotals(add, pages);
  }

  return { parserId: "digit_commercial_motor_v1", parserVersion: "digit_commercial_motor_v1.2.0", fields: add.fields, warnings: [] };
}

function parseIffco(pages: string[]): ParsedPolicyResult {
  const add = fieldCollector();
  const text = pages.join("\n");
  add("insurer_name", "IFFCO-Tokio General Insurance Co. Ltd.", .99, "IFFCO-Tokio General Insurance Co. Ltd.", 1);
  add("policy_product", "Package", .99, firstLine(text, ["PACKAGE", "COVERAGE"]), 1);

  const policy = find(pages, [/P400\s*Policy\s*#\s*([A-Z0-9\-/]{6,30})/i, /Policy\s*#\s*(N\d{6,15})/i]);
  if (policy) add("policy_number", compact(policy.value), .99, policy.evidence, policy.page);

  const period = findPeriod(pages, [
    new RegExp(`Period\\s*of\\s*Insurance\\s*From\\s*:?\\s*${DATE}[\\s\\S]{0,140}?To\\s*:?\\s*(?:Midnight\\s*On\\s*)?${DATE}`, "i"),
    new RegExp(`From\\s*:?\\s*${DATE}[\\s\\S]{0,100}?To\\s*:?\\s*(?:Midnight\\s*On\\s*)?${DATE}`, "i"),
  ]);
  addPeriod(add, period, .99);

  const idv = moneyPattern(pages, [new RegExp(`Package\\s+${MONEY}\\b`, "i"), new RegExp(`IDV\\s*in\\s*Rs\\.?[\\s\\S]{0,140}?${MONEY}`, "i")]) ?? moneyNear(pages, ["Total Value", "IDV in Rs"], true);
  if (idv) add("idv", formatMoney(idv.value), .99, idv.evidence, idv.page);

  const od = moneyPattern(pages, [new RegExp(`Net\\s*\\(A\\)\\s*${MONEY}`, "i")]);
  const tp = moneyPattern(pages, [new RegExp(`Net\\s*\\(B\\)\\s*${MONEY}`, "i")]);
  if (od) add("od_premium", formatMoney(od.value), .99, od.evidence, od.page);
  if (tp) add("tp_premium", formatMoney(tp.value), .99, tp.evidence, tp.page);

  const cpa = moneyPattern(pages, [new RegExp(`PA\\s*Owner\\s*Driver\\s*CSI\\s*Rs\\s*[0-9,.]+\\s+${MONEY}`, "i"), new RegExp(`PA\\s*Owner\\s*Driver[^\\n]{0,100}?${MONEY}\\s*$`, "im")]);
  if (cpa && cpa.value > 0 && cpa.value <= 100000) {
    add("cpa_premium", formatMoney(cpa.value), .99, cpa.evidence, cpa.page);
    add("cpa_opted", "Yes", .99, cpa.evidence, cpa.page);
  } else {
    add("cpa_premium", "0", .86, "No payable CPA premium identified", null);
    add("cpa_opted", "No", .86, "Derived from CPA amount", null);
  }

  const net = moneyPattern(pages, [new RegExp(`Premium/Taxable\\s*Value\\s*RS\\.?\\s*${MONEY}`, "i"), new RegExp(`Taxable\\s*Value\\(Rs\\.\\)[\\s\\S]{0,180}?${MONEY}`, "i")]);
  const tax = moneyPattern(pages, [new RegExp(`GST\\s*Amount\\(Rs\\.\\)\\s*${MONEY}`, "i"), new RegExp(`GST\\s*Amount\\(Rs\\.\\)[\\s\\S]{0,180}?${MONEY}`, "i")]);
  const gross = moneyPattern(pages, [new RegExp(`Gross\\s*Premium\\s*Payable(?:\\(Rs\\.\\)|\\s*Rs\\.?)?\\s*${MONEY}`, "i")]);
  if (net) add("total_premium", formatMoney(net.value), .99, net.evidence, net.page);
  if (tax) add("tax_amount", formatMoney(tax.value), .99, tax.evidence, tax.page);
  if (gross) add("gross_premium", formatMoney(gross.value), .99, gross.evidence, gross.page);

  return { parserId: "iffco_tokio_commercial_motor_v1", parserVersion: "iffco_tokio_commercial_motor_v1.2.0", fields: add.fields, warnings: [] };
}

function parseNewIndia(pages: string[]): ParsedPolicyResult {
  return parseGeneric(pages, true);
}

function parseKnownInsurer(pages: string[], family: Exclude<InsurerFamily, "digit" | "iffco" | "new_india" | "generic">): ParsedPolicyResult {
  const base = parseGeneric(pages);
  const config: Record<typeof family, { insurer: string; parserId: string; version: string }> = {
    shriram: {
      insurer: "Shriram General Insurance Company Limited",
      parserId: "shriram_motor_v1",
      version: "shriram_motor_v1.0.0",
    },
    oriental: {
      insurer: "The Oriental Insurance Company Limited",
      parserId: "oriental_motor_v1",
      version: "oriental_motor_v1.0.0",
    },
    national: {
      insurer: "National Insurance Company Limited",
      parserId: "national_motor_v1",
      version: "national_motor_v1.0.0",
    },
    universal_sompo: {
      insurer: "Universal Sompo General Insurance Company Limited",
      parserId: "universal_sompo_motor_v1",
      version: "universal_sompo_motor_v1.0.0",
    },
    united_india: {
      insurer: "United India Insurance Company Limited",
      parserId: "united_india_motor_v1",
      version: "united_india_motor_v1.0.0",
    },
  };
  const selected = config[family];
  const fields = [
    {
      key: "insurer_name",
      label: LABELS.insurer_name,
      value: selected.insurer,
      confidence: .99,
      page: 1,
      evidence: selected.insurer,
    },
    ...base.fields.filter((field) => field.key !== "insurer_name"),
  ];
  return {
    parserId: selected.parserId,
    parserVersion: selected.version,
    fields,
    warnings: base.warnings.filter((warning) => !/not fully supported/i.test(warning)),
  };
}

function parseGeneric(pages: string[], newIndia = false): ParsedPolicyResult {
  const add = fieldCollector();
  const text = pages.join("\n");
  const upper = text.toUpperCase();

  if (newIndia) add("insurer_name", "The New India Assurance Co. Ltd.", .99, "The New India Assurance Co. Ltd.", 1);
  const product = classifyProduct(upper);
  if (product) add("policy_product", product, newIndia ? .98 : .82, firstLine(text, ["PACKAGE", "COMPREHENSIVE", "LIABILITY", "THIRD PARTY", "SAOD", "BUNDLED"]), 1);

  const policy = find(pages, [/Policy\s*No\.?\s*[:\-]?\s*([A-Z0-9\-/]{8,30})/i, /Policy\s*Number\s*[:\-]?\s*([A-Z0-9\-/]{8,30})/i]);
  if (policy) add("policy_number", compact(policy.value), .98, policy.evidence, policy.page);

  const period = findPeriod(pages, [
    new RegExp(`Own\\s*Damage\\s*Period\\s*:?\\s*${DATE}[\\s\\S]{0,120}?To\\s*${DATE}`, "i"),
    new RegExp(`Period\\s*of\\s*Insurance[\\s\\S]{0,80}?From\\s*${DATE}[\\s\\S]{0,140}?To\\s*(?:Midnight\\s*(?:On|of)?\\s*)?${DATE}`, "i"),
    new RegExp(`Policy\\s*Period\\s*:?\\s*${DATE}[\\s\\S]{0,140}?To\\s*${DATE}`, "i"),
  ]);
  addPeriod(add, period, .98);

  const idv = moneyNear(pages, ["Total IDV", "Total Insured Declared Value", "Insured Declared Value"], true);
  const od = moneyNear(pages, ["Net Own Damage Premium (A)", "Net Own Damage Premium", "OD Premium"]);
  const tp = moneyNear(pages, ["Net Liability Premium (B)", "Net Liability Premium", "Third Party Premium"]);
  if (idv) add("idv", formatMoney(idv.value), .98, idv.evidence, idv.page);
  if (od) add("od_premium", formatMoney(od.value), .98, od.evidence, od.page);
  if (tp) add("tp_premium", formatMoney(tp.value), .98, tp.evidence, tp.page);

  const cpa = moneyNear(pages, ["Compulsory Personal Accident", "CPA Cover", "Owner Driver", "PA Cover for Owner Driver"]);
  if (cpa && cpa.value > 0 && cpa.value <= 100000) {
    add("cpa_premium", formatMoney(cpa.value), .96, cpa.evidence, cpa.page);
    add("cpa_opted", "Yes", .97, cpa.evidence, cpa.page);
  } else {
    add("cpa_premium", "0", .86, "No payable CPA premium identified", null);
    add("cpa_opted", "No", .88, "Derived from CPA amount", null);
  }
  addPremiumTotals(add, pages);

  return {
    parserId: newIndia ? "new_india_motor_v1" : "generic_motor_v1",
    parserVersion: newIndia ? "new_india_motor_v1.2.0" : "generic_motor_v1.2.0",
    fields: add.fields,
    warnings: newIndia ? [] : ["This insurer format is not fully supported yet. Verify every value manually."],
  };
}

function addPremiumTotals(add: ReturnType<typeof fieldCollector>, pages: string[]) {
  const net = moneyNear(pages, ["Total Premium (A+B)", "Net Premium"]);
  const tax = moneyNear(pages, ["IGST", "CGST", "SGST", "GST"]);
  const gross = moneyNear(pages, ["Gross Premium Paid", "Gross Premium", "Total Premium Payable"]);
  if (net) add("total_premium", formatMoney(net.value), .96, net.evidence, net.page);
  if (tax) add("tax_amount", formatMoney(tax.value), .94, tax.evidence, tax.page);
  if (gross) add("gross_premium", formatMoney(gross.value), .97, gross.evidence, gross.page);
}

function addPeriod(add: ReturnType<typeof fieldCollector>, period: Period | null, confidence: number) {
  if (!period) return;
  const start = isoDate(period.start);
  const end = isoDate(period.end);
  if (start) add("policy_start_date", start, confidence, period.evidence, period.page);
  if (end) add("policy_end_date", end, confidence, period.evidence, period.page);
}

type Found = { value: string; page: number; evidence: string };
type MoneyFound = { value: number; page: number; evidence: string };
type Period = { start: string; end: string; page: number; evidence: string };

function addFound(
  add: ReturnType<typeof fieldCollector>,
  key: string,
  found: Found | null,
  confidence: number,
  transform: (value: string) => string = (value) => value.trim(),
) {
  if (found) add(key, transform(found.value), confidence, found.evidence, found.page);
}

function findEvidence(pages: string[], pattern: RegExp): { page: number; evidence: string } | null {
  for (let index = 0; index < pages.length; index += 1) {
    const match = pages[index].match(pattern);
    if (match) return { page: index + 1, evidence: match[0] };
  }
  return null;
}

function fieldCollector() {
  const fields: ParsedPolicyField[] = [];
  const seen = new Set<string>();
  const add = ((key: string, value: string | null | undefined, confidence: number, evidence = "", page: number | null = null) => {
    const clean = value?.trim();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    fields.push({ key, label: LABELS[key] ?? key, value: clean, confidence, page, evidence: sanitizeText(evidence).slice(0, 500) });
  }) as ((key: string, value: string | null | undefined, confidence: number, evidence?: string, page?: number | null) => void) & { fields: ParsedPolicyField[] };
  add.fields = fields;
  return add;
}

function find(pages: string[], patterns: RegExp[]): Found | null {
  for (let index = 0; index < pages.length; index += 1) {
    for (const pattern of patterns) {
      const match = pages[index].match(pattern);
      if (match?.[1]) return { value: match[1].trim(), page: index + 1, evidence: match[0] };
    }
  }
  return null;
}

function findPeriod(pages: string[], patterns: RegExp[]): Period | null {
  for (let index = 0; index < pages.length; index += 1) {
    for (const pattern of patterns) {
      const match = pages[index].match(pattern);
      if (match?.[1] && match?.[2]) return { start: match[1], end: match[2], page: index + 1, evidence: match[0] };
    }
  }
  return coverageDatePair(pages);
}

function coverageDatePair(pages: string[]): Period | null {
  const token = new RegExp(DATE, "gi");
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const candidates = [...page.matchAll(token)].map((match) => ({ raw: match[1], index: match.index ?? 0, date: parseDate(match[1]) })).filter((item) => item.date);
    let best: { score: number; a: typeof candidates[number]; b: typeof candidates[number] } | null = null;
    for (let a = 0; a < candidates.length; a += 1) {
      for (let b = a + 1; b < candidates.length; b += 1) {
        const first = candidates[a].date!;
        const second = candidates[b].date!;
        const days = Math.round((second.getTime() - first.getTime()) / 86400000);
        if (days < 300 || days > 370) continue;
        const window = page.slice(Math.max(0, candidates[a].index - 140), Math.min(page.length, candidates[b].index + 140));
        let score = 1000 - Math.abs(365 - days) - Math.min(300, Math.abs(candidates[b].index - candidates[a].index));
        if (/period|policy|insurance|valid|from|to/i.test(window)) score += 250;
        if (/invoice|issue|receipt/i.test(window)) score -= 150;
        if (!best || score > best.score) best = { score, a: candidates[a], b: candidates[b] };
      }
    }
    if (best) return { start: best.a.raw, end: best.b.raw, page: index + 1, evidence: page.slice(Math.max(0, best.a.index - 100), Math.min(page.length, best.b.index + 100)) };
  }
  return null;
}

function moneyPattern(pages: string[], patterns: RegExp[]): MoneyFound | null {
  for (let index = 0; index < pages.length; index += 1) {
    for (const pattern of patterns) {
      const match = pages[index].match(pattern);
      const value = parseMoney(match?.[1]);
      if (value !== null) return { value, page: index + 1, evidence: match?.[0] ?? "" };
    }
  }
  return null;
}

function moneyNear(pages: string[], labels: string[], preferLargest = false): MoneyFound | null {
  const normalizedLabels = labels.map(normalizeLabel);
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (!normalizedLabels.some((label) => normalizeLabel(lines[index]).includes(label))) continue;
      const evidence = lines.slice(index, index + 4).join(" | ");
      const values = [...evidence.matchAll(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/g)].map((match) => parseMoney(match[0])).filter((value): value is number => value !== null && value > 0);
      if (!values.length) continue;
      const plausible = values.filter((value) => value <= 100000000 && (!preferLargest || value >= 1000));
      if (!plausible.length) continue;
      return { value: preferLargest ? Math.max(...plausible) : plausible[plausible.length - 1], page: pageIndex + 1, evidence };
    }
  }
  return null;
}

function classifyProduct(upper: string): string | null {
  if (/(LONG\s+TERM|MULTI\s*YEAR)\s+(THIRD\s+PARTY|LIABILITY)/.test(upper)) return "Long Term Third Party";
  if (/(LONG\s+TERM|MULTI\s*YEAR)\s+(PACKAGE|COMPREHENSIVE)/.test(upper)) return "Long Term Package";
  if (upper.includes("BUNDLED")) return "Bundled";
  if (/(STANDALONE|STAND\s+ALONE)\s+(OWN\s+DAMAGE|OD)|\bSAOD\b/.test(upper)) return "SAOD";
  if (/\b(LIABILITY\s+ONLY|ACT\s+ONLY|THIRD\s+PARTY)\b/.test(upper)) return "Third Party";
  if (/\bPACKAGE\s+POLICY\b|\bCOMPREHENSIVE\b/.test(upper)) return "Package";
  return null;
}

function sanitizeText(value: string) {
  return value.replace(/\u00ad/g, "").replace(/[–—]/g, "-").replace(/\r/g, "").split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
}

function firstLine(text: string, tokens: string[]) {
  return text.split("\n").find((line) => tokens.some((token) => line.toUpperCase().includes(token))) ?? "Policy product classification";
}

function normalizeLabel(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function compact(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9\-/.]/g, "");
}

function compactVehicleId(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanVehicleText(value: string) {
  return value.replace(/\s+/g, " ").replace(/[;,]+$/, "").trim().slice(0, 80);
}

function titleCase(value: string) {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function parseMoney(value: string | undefined): number | null {
  if (!value) return null;
  const number = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function normalizeMoney(value: string) {
  const number = parseMoney(value);
  return number === null ? "" : formatMoney(number);
}

function formatMoney(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function parseDate(value: string): Date | null {
  const clean = value.trim().toUpperCase();
  const iso = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const match = clean.match(/^(\d{1,2})[-/]([A-Z]{3}|\d{1,2})[-/](\d{2,4})$/);
  if (!match) return null;
  const months: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  const month = months[match[2]] ?? Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  return validDate(year, month, Number(match[1]));
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function isoDate(value: string) {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}
