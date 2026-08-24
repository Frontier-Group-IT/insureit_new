import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineProductionRound9Fresh20Recovery } from "../lib/policy-ocr-production-round9-fresh20-recovery.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";

function field(result: ParsedPolicyResult, key: string): string | undefined {
  return result.fields.find((entry) => entry.key === key)?.value;
}

function base(rtoName: string): ParsedPolicyResult {
  return {
    parserId: "digit_commercial_motor_v1",
    parserVersion: "digit_commercial_motor_v1.8.0+prod-r1-digit_misd+prod-r2-digit+prod-r3-precision-digit",
    fields: [
      { key: "policy_product", label: "Product", value: "Package", confidence: 1, page: 1, evidence: "synthetic" },
      { key: "vehicle_class", label: "Class", value: "MISD", confidence: 1, page: 1, evidence: "synthetic" },
      { key: "vehicle_rto_name", label: "RTO", value: rtoName, confidence: 1, page: 1, evidence: "synthetic" },
      { key: "vehicle_rto_state", label: "State", value: rtoName.slice(0, 2), confidence: 1, page: 1, evidence: "synthetic" },
    ],
    warnings: ["Review required. Missing or uncertain Digit fields: od_premium, tp_premium."],
  };
}

const cases = [
  {
    rto: "DL01",
    page1: `GO DIGIT GENERAL INSURANCE LTD.
YOUR VEHICLE DETAILS
Make SYNTHETIC MOTORS Trailer Reg. No. RTO Location New Delhi,DELHI
Model/Vehicle Variant SECURE MAX / CASH Year of Regn. / 2019 / 0001- Licensed Seating 5
(Sub-Type) VAN/CNG Manufacturing 01-01 Capacity
G01 Engine No. SYNENG1001 Chassis No. SYNCHASSIS100001 Cubic Capacity 2523 CC
Fuel Type CNG Gross Vehicle Weight 2880KG Vehicle Body Type Cash Van
P OWN DAMAGE PREMIUM [A] LIABILITY PREMIUM [B]
PA cover for Owner-Driver --`,
    page2: `Total OD 710.41 Total Act
Premium Premium 7907.00
Net Premium [A+B] 8617.41
CGST @ 9% = 775.57 + SGST/UTGST @ 9% = 775.57 1551.14
Total Premium 10168.55`,
    expected: { make: "SYNTHETIC MOTORS", model: "SECURE MAX / CASH VAN/CNG", fuel: "CNG", year: "2019", capacity: "2880KG", state: "Delhi", od: "710.41", tp: "7907", net: "8617.41", tax: "1551.14", gross: "10168.55" },
  },
  {
    rto: "KA03",
    page1: `Go Digit General Insurance Ltd.
YOUR VEHICLE DETAILS
Make EXAMPLE AUTOMOTIVE Trailer Reg. No. RTO Location Bengaluru,KARNATAKA
Model/Vehicle Variant CARRIER PRO / CASH Year of Regn. / 2021 / 0001- Licensed Seating 5
(Sub-Type) VAN Manufacturing 01-01 Capacity
G01 Engine No. SYNENG2002 Chassis No. SYNCHASSIS200002 Cubic Capacity 2523 CC
Fuel Type Diesel Gross Vehicle Weight 2880 KG Vehicle Body Type Cash Van
OWN DAMAGE PREMIUM [A] LIABILITY PREMIUM [B]
PA cover for Owner-Driver NIL`,
    page2: `Total OD Premium 872.57 Total Act Premium 7847.00
Net Premium [A+B] 8719.57
IGST @ 18% = 1569.52 1569.52
Total Premium 10289.09`,
    expected: { make: "EXAMPLE AUTOMOTIVE", model: "CARRIER PRO / CASH VAN", fuel: "DIESEL", year: "2021", capacity: "2880KG", state: "Karnataka", od: "872.57", tp: "7847", net: "8719.57", tax: "1569.52", gross: "10289.09" },
  },
  {
    rto: "JH01",
    page1: `GO DIGIT GENERAL INSURANCE
YOUR VEHICLE DETAILS
Make DEMO VEHICLES Trailer Reg. No. RTO Location Ranchi,JHARKHAND
Model/Vehicle Variant SENTINEL / CASH VAN Year of Regn. / 2022 / 0001- Licensed Seating 5
(Sub-Type) Manufacturing 01-01 Capacity
G01 Engine No. SYNENG3003 Chassis No. SYNCHASSIS300003 Cubic Capacity 2200 CC
Fuel Type Diesel Gross Vehicle Weight 2850KG Vehicle Body Type Cash Van
OWN DAMAGE PREMIUM [A] LIABILITY PREMIUM [B]
PA cover for Owner-Driver N/A`,
    page2: `Total OD 933.62 Total TP
Premium Premium 7847.00
Net Premium [A+B] 8780.62
IGST @ 18% = 1580.51 1580.51
Total Premium 10361.13`,
    expected: { make: "DEMO VEHICLES", model: "SENTINEL / CASH VAN", fuel: "DIESEL", year: "2022", capacity: "2850KG", state: "Jharkhand", od: "933.62", tp: "7847", net: "8780.62", tax: "1580.51", gross: "10361.13" },
  },
];

for (const testCase of cases) {
  const result = refineProductionRound9Fresh20Recovery([testCase.page1, testCase.page2], base(testCase.rto));
  assert.equal(field(result, "vehicle_make"), testCase.expected.make);
  assert.equal(field(result, "vehicle_model"), testCase.expected.model);
  assert.equal(field(result, "vehicle_fuel_type"), testCase.expected.fuel);
  assert.equal(field(result, "vehicle_manufacturing_year"), testCase.expected.year);
  assert.equal(field(result, "vehicle_capacity"), testCase.expected.capacity);
  assert.equal(field(result, "vehicle_rto_state"), testCase.expected.state);
  assert.equal(field(result, "vehicle_engine_number")?.startsWith("SYNENG"), true);
  assert.equal(field(result, "vehicle_chassis_number")?.startsWith("SYNCHASSIS"), true);
  assert.equal(field(result, "cpa_opted"), "No");
  assert.equal(field(result, "cpa_premium"), "0");
  assert.equal(field(result, "od_premium"), testCase.expected.od);
  assert.equal(field(result, "tp_premium"), testCase.expected.tp);
  assert.equal(field(result, "total_premium"), testCase.expected.net);
  assert.equal(field(result, "tax_amount"), testCase.expected.tax);
  assert.equal(field(result, "gross_premium"), testCase.expected.gross);
  assert.match(result.parserVersion, /prod-r9-digit_cash_van/);
}

const mismatch = refineProductionRound9Fresh20Recovery([
  cases[0].page1,
  cases[0].page2.replace("7907.00", "7999.00"),
], base("DL01"));
for (const key of ["od_premium", "tp_premium", "total_premium", "tax_amount", "gross_premium"]) {
  assert.equal(field(mismatch, key), undefined, `${key} must remain withheld when printed totals do not reconcile`);
}
assert.equal(field(mismatch, "cpa_opted"), "No");

const unrelated = refineProductionRound9Fresh20Recovery([
  "GO DIGIT GENERAL INSURANCE\nDigit Private Car Policy\nVehicle Body Type Sedan",
], base("MH01"));
assert.doesNotMatch(unrelated.parserVersion, /prod-r9/);
assert.equal(field(unrelated, "od_premium"), undefined);

console.log("Round 9 fresh20 Digit cash-van recovery regression passed.");
