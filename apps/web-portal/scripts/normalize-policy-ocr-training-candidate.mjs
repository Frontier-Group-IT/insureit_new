import { readFileSync, writeFileSync } from "node:fs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: node normalize-policy-ocr-training-candidate.mjs <input> <output>");
}

const candidate = JSON.parse(readFileSync(inputPath, "utf8"));
const expectedEvidence = {
  vehicle_registration_status: /registration status/i,
  vehicle_registration_number: /registration number|registration no|regn\.? no/i,
  vehicle_class: /vehicle class|class of vehicle/i,
  vehicle_make: /vehicle make|manufacturer/i,
  vehicle_model: /vehicle model/i,
  vehicle_fuel_type: /fuel type/i,
  vehicle_manufacturing_year: /manufacturing year|year of manufacture/i,
  vehicle_capacity: /capacity|cc|gvw|seating/i,
  vehicle_chassis_number: /chassis/i,
  vehicle_engine_number: /engine/i,
  vehicle_rto_name: /\brto\b/i,
  vehicle_rto_state: /\brto\b|\bstate\b/i,
  insurer_name: /insurance company|insurer|insurer header/i,
  policy_product: /policy product|package|bundled|standalone od|third party|liability only/i,
  policy_number: /policy number|policy no/i,
  policy_start_date: /policy period|period of cover|valid from|start date/i,
  policy_end_date: /policy period|period of cover|valid upto|valid up to|end date/i,
  idv: /idv|insured declared value|sum insured|total value/i,
  od_premium: /total od premium|od premium/i,
  tp_premium: /total tp premium|third.party premium|third party premium|liability premium|liability total|basic tp/i,
  cpa_opted: /compulsory pa|owner.driver|cpa/i,
  cpa_premium: /compulsory pa|owner.driver|cpa/i,
  total_premium: /net premium|total premium/i,
  tax_amount: /gst|tax/i,
  gross_premium: /total payable|gross premium|gross/i,
};

function pageSuffix(value) {
  const match = String(value ?? "").match(/·\s*Page\s+\d+$/i);
  return match ? ` ${match[0]}` : "";
}

for (const [key, value] of Object.entries(candidate.evidence_labels ?? {})) {
  const pattern = expectedEvidence[key];
  if (pattern && !pattern.test(String(value))) {
    candidate.evidence_labels[key] = `Insufficient evidence${pageSuffix(value)}`;
  }
}

writeFileSync(outputPath, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
