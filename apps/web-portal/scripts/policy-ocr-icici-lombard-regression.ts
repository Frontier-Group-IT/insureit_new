import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineIciciLombardMotorPolicy } from "../lib/policy-ocr-icici-lombard-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

function field(result: ParsedPolicyResult, key: string) {
  return result.fields.find((entry) => entry.key === key)?.value;
}

const pages = [
  `ICICI Lombard General Insurance Company Limited
Product Code: 3003 UIN: IRDAN115RP0013V01200203
Reference No.: W593925251
SHREE TRANSPORT COMPANY
Sub: Risk Assumption Letter
Please find enclosed Policy No. 3003/455441342/00/000
Insured & Vehicle Details
Name of the Insured
SHREE TRANSPORT COMPANY
Period of Insurance
Sep 27, 2026 to Sep 26, 2027
Vehicle Make / Model
BHARATBENZ / 5532 TRAILER
RTO City
RAJASTHAN-CHITTORGARH
Vehicle Registration No.
RJ09GE3578
Vehicle Registration Date
Sep 28, 2024
Engine No.
926956D0176887
Chassis No.
MEC862HCHRP168735
Current Year NCB(%)
25%
Vehicle Usage
CONSTRUCTION GOODS TRANSPORTATION
Previous Policy Details
Previous Policy No.
106020/31/26/010847
The Compulsory Personal Accident cover has not been opted in this policy on account that, the vehicle to be insured is not owned by an individual.`,
  `CERTIFICATE OF INSURANCE CUM POLICY SCHEDULE
Goods Carrying Vehicles Package Policy
Name of the Insured : SHREE TRANSPORT COMPANY Policy No. : 3003/455441342/00/000
Period of Insurance : Sep 27, 2026 00:00 to Midnight of Sep 26, 2027
RTO Location : RAJASTHAN-CHITTORGARH
Vehicle Class : Public Carrier
Vehicle Registration No. Make Vehicle SubClass Model Model Build Type of Body GVW Mfg Yr Carrying Capacity Chassis No. Engine No. Trailer Chassis No.
RJ09GE3578 BHARATBENZ TRAILERS 5532 TRAILER PARTIALLY BUILT Open 55000 2024 2 MEC862HCHRP168735 926956D0176887 0
Trailer Registration No. Body IDV (₹) Chassis IDV (₹) Trailer (₹) Electrical / Electronic Accessories (₹) Non Electrical Accessories (₹) CNG / LPG Unit (₹) Total IDV (₹)
12,00,000.00 34,59,750.00 0.00 0.00 0.00 0.00 46,59,750.00
Premium Details
OWN DAMAGE(A) (₹) LIABILITY(B) (₹)
Total Own Damage Premium(A) 50,751.00 Total Liability Premium(B) 44,392.00
Total Package Premium (A+B) 95,143.00
Total Tax Payable in ₹ 11,374.00
Total Premium Payable in ₹ 1,06,517.00
Limits of Liability: PA Cover for Owner-Driver under Section III: CSI 0.00/-.`,
];

const tables: StructuredPolicyTable[] = [
  {
    page: 2,
    rows: [
      ["Vehicle Registration No.", "Make", "Vehicle SubClass", "Model", "Model Build", "Type of Body", "GVW", "Mfg Yr", "Carrying Capacity", "Chassis No.", "Engine No.", "Trailer Chassis No."],
      ["RJ09GE3578", "BHARATBENZ", "TRAILERS", "5532 TRAILER", "PARTIALLY BUILT", "Open", "55000", "2024", "2", "MEC862HCHRP168735", "926956D0176887", "0"],
      ["Trailer Registration No.", "Body IDV (₹)", "Chassis IDV (₹)", "Trailer (₹)", "Electrical / Electronic Accessories (₹)", "Non Electrical Accessories (₹)", "CNG / LPG Unit (₹)", "Total IDV (₹)"],
      ["", "12,00,000.00", "34,59,750.00", "0.00", "0.00", "0.00", "0.00", "46,59,750.00"],
    ],
  },
];

const contaminated: ParsedPolicyResult = {
  parserId: "universal_sompo_motor_v1",
  parserVersion: "universal_sompo_motor_v1.0.0",
  fields: [
    { key: "insurer_name", label: "Insurance company", value: "Universal Sompo General Insurance Company Limited", confidence: .99, page: 1, evidence: "bad routing" },
    { key: "vehicle_registration_status", label: "Registration status", value: "registration_pending", confidence: .9, page: 1, evidence: "bad generic inference" },
    { key: "vehicle_class", label: "Vehicle class", value: "Category", confidence: .9, page: 2, evidence: "header contamination" },
    { key: "vehicle_make", label: "Vehicle make", value: "/ Model", confidence: .9, page: 2, evidence: "header contamination" },
    { key: "vehicle_model", label: "Vehicle model", value: "RTO City", confidence: .9, page: 2, evidence: "header contamination" },
    { key: "vehicle_rto_name", label: "RTO name", value: "City", confidence: .9, page: 2, evidence: "header contamination" },
    { key: "idv", label: "IDV", value: "7519436", confidence: .9, page: 2, evidence: "wrong money candidate" },
  ],
  warnings: ["This insurer format is not fully supported yet. Verify every value manually."],
};

const result = refineIciciLombardMotorPolicy(pages, tables, contaminated);

assert.equal(result.parserId, "icici_lombard_motor_v1");
assert.equal(field(result, "insurer_name"), "ICICI Lombard General Insurance Company Limited");
assert.equal(field(result, "policy_number"), "3003/455441342/00/000");
assert.equal(field(result, "policy_product"), "Package");
assert.equal(field(result, "policy_start_date"), "2026-09-27");
assert.equal(field(result, "policy_end_date"), "2027-09-26");
assert.equal(field(result, "vehicle_registration_status"), "registered");
assert.equal(field(result, "vehicle_registration_number"), "RJ09GE3578");
assert.equal(field(result, "vehicle_class"), "Public Carrier");
assert.equal(field(result, "vehicle_make"), "BHARATBENZ");
assert.equal(field(result, "vehicle_model"), "5532 TRAILER");
assert.equal(field(result, "vehicle_manufacturing_year"), "2024");
assert.equal(field(result, "vehicle_chassis_number"), "MEC862HCHRP168735");
assert.equal(field(result, "vehicle_engine_number"), "926956D0176887");
assert.equal(field(result, "vehicle_rto_name"), "RAJASTHAN-CHITTORGARH");
assert.equal(field(result, "idv"), "4659750");
assert.equal(field(result, "od_premium"), "50751");
assert.equal(field(result, "tp_premium"), "44392");
assert.equal(field(result, "total_premium"), "95143");
assert.equal(field(result, "tax_amount"), "11374");
assert.equal(field(result, "gross_premium"), "106517");
assert.equal(field(result, "cpa_premium"), "0");
assert.equal(field(result, "cpa_opted"), "No");
assert.ok(!result.warnings.some((warning) => /not fully supported/i.test(warning)));

const unsafe = refineIciciLombardMotorPolicy(
  [pages[0], pages[1].replace("Total Liability Premium(B) 44,392.00", "Total Liability Premium(B) 40,000.00")],
  tables,
  contaminated,
);
assert.equal(field(unsafe, "od_premium"), undefined);
assert.equal(field(unsafe, "tp_premium"), undefined);
assert.match(unsafe.warnings.join(" "), /did not reconcile/i);

const unrelated: ParsedPolicyResult = {
  parserId: "generic_motor_v1",
  parserVersion: "generic_motor_v1.0.0",
  fields: [],
  warnings: [],
};
assert.deepEqual(
  refineIciciLombardMotorPolicy(["SOME OTHER INSURER\nGoods Carrying Vehicles Package Policy"], [], unrelated),
  unrelated,
);

console.log("ICICI Lombard GCV OCR regression passed.");
