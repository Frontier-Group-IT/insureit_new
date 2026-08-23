import assert from "node:assert/strict";
// @ts-expect-error -- Node regression runner executes TypeScript directly.
import { refineProductionBenchmarkPolicy } from "../lib/policy-ocr-production-benchmark-refiner.ts";
// @ts-expect-error -- Node regression runner executes TypeScript directly.
import { proposalFieldValue } from "../app/system/policy-ocr-training/benchmark-truth.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

function parsed(parserId: string, fields: ParsedPolicyResult["fields"] = []): ParsedPolicyResult {
  return { parserId, parserVersion: `${parserId}.1.0`, fields, warnings: [] };
}
function values(result: ParsedPolicyResult) {
  return Object.fromEntries(result.fields.map((field) => [field.key, field.value]));
}
function field(key: string, value: string): ParsedPolicyResult["fields"][number] {
  return { key, label: key, value, confidence: .8, page: 1, evidence: "sanitized baseline" };
}
function run(
  name: string,
  pages: string[],
  tables: StructuredPolicyTable[],
  baseline: ParsedPolicyResult,
  expected: Record<string, string>,
) {
  const result = refineProductionBenchmarkPolicy(pages, tables, baseline);
  const actual = values(result);
  for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value, `${name}: ${key}`);
  assert.match(result.parserVersion, /\+prod-r1-/);
  console.log("PASS", name, result.parserVersion);
}

run(
  "Digit MISD package sibling",
  ["Go Digit General Insurance Limited\nCOMMERCIAL VEHICLE PACKAGE POLICY - CASH VAN\nPolicy No D-SAFE-001"],
  [{ page: 1, rows: [
    ["Vehicle Make", "TATA"], ["Vehicle Model / Vehicle Variant", "YODHA / CASH VAN"], ["Fuel Type", "DIESEL"],
    ["Year of Manufacture", "2022"], ["GVW", "2850"], ["Chassis No", "SYNCHASSISDIGIT001"], ["Engine No", "SYNENGDIGIT001"],
    ["Total OD Premium", "1230.59"], ["Total TP Premium", "7847"], ["Net Premium", "9077.59"],
    ["CGST", "816.9831"], ["SGST", "816.9831"], ["Final Premium", "10711.5562"],
  ] }],
  parsed("digit_commercial_motor_v1", [field("total_premium", "1230.59"), field("cpa_opted", "No"), field("cpa_premium", "0")]),
  { insurer_name: "Go Digit General Insurance Limited", policy_product: "Package", vehicle_class: "MISD", vehicle_make: "Tata", vehicle_model: "YODHA / CASH VAN", vehicle_fuel_type: "Diesel", vehicle_manufacturing_year: "2022", vehicle_capacity: "2850KG", od_premium: "1230.59", tp_premium: "7847", total_premium: "9077.59", tax_amount: "1633.97", gross_premium: "10711.56", cpa_opted: "No", cpa_premium: "0" },
);

run(
  "IFFCO MISD structured sibling",
  ["IFFCO-TOKIO General Insurance Company Limited\nCOMMERCIAL VEHICLE PACKAGE POLICY\nJCB BACKHOE LOADER"],
  [{ page: 1, rows: [
    ["Make of Vehicle", "JCB"], ["Model of Vehicle", "3DX PLUS"], ["Fuel Type", "DIESEL"], ["Year of Manufacture", "2026"],
    ["Chassis Number", "SYNCHASSISIFFCO001"], ["Engine Number", "SYNENGIFFCO001"],
    ["Basic TP Premium", "7267"], ["Legal Liability to Paid Driver", "50"], ["P.A. Owner-Driver", "0"],
    ["Taxable Value", "12362"], ["GST Amount", "2225.16"], ["Gross Premium Payable", "14587.16"],
  ] }],
  parsed("iffco_tokio_commercial_motor_v1", [field("total_premium", "12362")]),
  { insurer_name: "IFFCO-TOKIO General Insurance Company Limited", policy_product: "Package", vehicle_class: "MISD", vehicle_make: "JCB", vehicle_model: "3DX PLUS", vehicle_fuel_type: "Diesel", vehicle_manufacturing_year: "2026", tp_premium: "7317", od_premium: "5045", cpa_opted: "No", cpa_premium: "0", total_premium: "12362", tax_amount: "2225.16", gross_premium: "14587.16" },
);

run(
  "Magma PCP fresh failure sibling",
  ["MAGMA GENERAL INSURANCE LIMITED\nPRIVATE CAR PACKAGE POLICY\nReason for not opting PA Cover of Owner Driver : Do not hold a valid driving license"],
  [{ page: 1, rows: [
    ["Vehicle Make", "MARUTI SUZUKI"], ["Vehicle Model", "BALENO ZETA"], ["Fuel Type", "PETROL"], ["Year of Manufacture", "2020"],
    ["Registration No", "HR30SAFE01"], ["Chassis No", "SYNCHASSISMAGMA001"], ["Engine No", "SYNENGMAGMA001"],
  ] }],
  parsed("magma_motor_v1", [field("vehicle_make", "/Model"), field("od_premium", "4478"), field("total_premium", "8379"), field("tax_amount", "1508.22"), field("gross_premium", "9887")]),
  { insurer_name: "Magma General Insurance Limited", policy_product: "Package", vehicle_class: "PCP", vehicle_make: "Maruti Suzuki", vehicle_model: "BALENO ZETA", vehicle_fuel_type: "Petrol", vehicle_manufacturing_year: "2020", od_premium: "4478", tp_premium: "3901", cpa_opted: "No", cpa_premium: "0", total_premium: "8379" },
);

run(
  "National Package TWP routing failure sibling",
  ["NATIONAL INSURANCE COMPANY LIMITED\nMOTOR CYCLE PACKAGE POLICY\nNEW VEHICLE\nOwner Driver PA cover not opted"],
  [{ page: 1, rows: [
    ["Make", "HERO"], ["Model", "SUPER SPLENDOR"], ["Fuel Type", "PETROL"], ["Year of Manufacture", "2026"],
    ["Chassis No", "SYNCHASSISNATIONAL001"], ["Engine No", "SYNENGNATIONAL001"],
    ["Own Damage Cover Premium", "337"], ["Legal Liability Cover", "3851"], ["Net Premium", "4188"], ["GST Amount", "753.84"], ["Gross Premium", "4941.84"],
  ] }],
  parsed("oriental_motor_v1", [field("insurer_name", "The Oriental Insurance Company Limited"), field("policy_product", "Bundled"), field("vehicle_make", "Model -"), field("vehicle_model", "No.")]),
  { insurer_name: "National Insurance Company Limited", policy_product: "Package", vehicle_class: "TWP", vehicle_make: "Hero", vehicle_model: "SUPER SPLENDOR", vehicle_fuel_type: "Petrol", vehicle_manufacturing_year: "2026", vehicle_registration_status: "registration_pending", od_premium: "337", tp_premium: "3851", total_premium: "4188", tax_amount: "753.84", gross_premium: "4941.84", cpa_opted: "No", cpa_premium: "0" },
);

const aliasedProposal = {
  fields: {
    total_premium: { value: "12345.67" },
    tax_amount: { value: "2222.22" },
    gross_premium: { value: "14567.89" },
  },
};
assert.equal(proposalFieldValue(aliasedProposal, "printed_net_premium"), "12345.67");
assert.equal(proposalFieldValue(aliasedProposal, "printed_gst"), "2222.22");
assert.equal(proposalFieldValue(aliasedProposal, "printed_gross_premium"), "14567.89");

console.log("Production benchmark OCR regression: 4 layout siblings + evaluator aliases passed.");
