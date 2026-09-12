import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineProductionRound10UiicGcvPackage } from "../lib/policy-ocr-production-round10-uiic-gcv-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

function field(result: ParsedPolicyResult, key: string): string | undefined {
  return result.fields.find((entry) => entry.key === key)?.value;
}

function base(fields: ParsedPolicyResult["fields"]): ParsedPolicyResult {
  return {
    parserId: "united_india_motor_v1",
    parserVersion: "united_india_motor_v1.1.0+prod-r9-fresh20_recovery",
    fields,
    warnings: [],
  };
}

const pages = [
  `UNITED INDIA INSURANCE COMPANY LIMITED
MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER - PACKAGE POLICY`,
  `MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER - PACKAGE POLICY SCHEDULE
VEHICLE DETAILS
Registration Number SYNTH-REG-01
Chassis Number
SYNTHENGINE987654321
Gross vehicle Weight 11990
RTA Name MP00 SYNTH Vehicle Make & Model
SYNTH MOTORS LTD / CARGO 1200 TEST
Type Of Body / Fuel Type
TILT_CAB_TEST / Diesel
Registration Date 01/01/2025
Cubic Capacity / Seating Capacity 3300 / 3
Engine Number
SYNTHENGINE987654321
Year Of Manufacture 2025
INSURED DECLARED VALUE
SCHEDULE OF PREMIUM
Gross OD(A)
17,330.00
B. Basic - TP
27,186.00
LL to Paid Driver IMT 28
100.00
Gross TP(B)
27,286.00
Premium(A+B)
44,616.00
IGST-Others(18%) 3,137.00
IGST-Basic TP(5%) 1,359.00
TOTAL PAYABLE PREMIUM
49,112.00
TERMS & CONDITIONS`,
];

// The flattened OCR intentionally makes Chassis look like Engine. The layout
// table carries the authoritative column association and must repair the swap.
const tables: StructuredPolicyTable[] = [{
  page: 2,
  rows: [
    ["Chassis Number", "Gross vehicle Weight", "RTA Name", "Vehicle Make & Model"],
    ["SYNTHCHASSIS1234567", "11990", "MP00 SYNTH", "SYNTH MOTORS LTD / CARGO 1200 TEST"],
    ["Type Of Body / Fuel Type", "Registration Date", "Cubic Capacity / Seating Capacity", "Engine Number"],
    ["TILT_CAB_TEST / Diesel", "01/01/2025", "3300 / 3", "SYNTHENGINE987654321"],
    ["Gross OD(A)", "Gross TP(B)", "Premium(A+B)", "TOTAL PAYABLE PREMIUM"],
    ["17,330.00", "27,286.00", "44,616.00", "49,112.00"],
  ],
}];

const broken = base([
  { key: "policy_product", label: "Product", value: "Package", confidence: 1, page: 1, evidence: "synthetic" },
  { key: "vehicle_class", label: "Class", value: "GCV", confidence: 1, page: 1, evidence: "synthetic" },
  { key: "total_premium", label: "Net premium", value: "44616", confidence: 1, page: 2, evidence: "synthetic" },
  { key: "od_premium", label: "OD", value: "4487.60", confidence: 1, page: 2, evidence: "basic OD contamination" },
  { key: "tp_premium", label: "TP", value: "27186", confidence: 1, page: 2, evidence: "basic TP contamination" },
  { key: "cpa_premium", label: "CPA", value: "0", confidence: 1, page: 2, evidence: "synthetic" },
  { key: "vehicle_chassis_number", label: "Chassis", value: "SYNTHENGINE987654321", confidence: 1, page: 2, evidence: "cross-associated" },
]);

const repaired = refineProductionRound10UiicGcvPackage(pages, tables, broken);
assert.equal(field(repaired, "vehicle_engine_number"), "SYNTHENGINE987654321");
assert.equal(field(repaired, "vehicle_chassis_number"), "SYNTHCHASSIS1234567");
assert.equal(field(repaired, "vehicle_fuel_type"), "Diesel");
assert.equal(field(repaired, "od_premium"), "17330");
assert.equal(field(repaired, "tp_premium"), "27286");
assert.equal(field(repaired, "cpa_premium"), "0");
assert.match(repaired.parserVersion, /prod-r10-uiic_gcv_package/);

// Fresh sibling: prove the text fallback generalizes without structured tables.
const siblingPages = [
  `UNITED INDIA INSURANCE COMPANY LIMITED
GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY`,
  `GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY SCHEDULE
VEHICLE DETAILS
Chassis Number
FRESHCASIS76543210
Gross vehicle Weight 16200
Vehicle Make & Model
EXAMPLE VEHICLES / HAULER 16
Type Of Body / Fuel Type
OPEN BODY / CNG
Engine Number
FRESHENGINE123456789
Year Of Manufacture 2024
INSURED DECLARED VALUE
SCHEDULE OF PREMIUM
Gross OD(A)
8,250.00
Gross TP(B)
31,750.00
Premium(A+B)
40,000.00
TOTAL PAYABLE PREMIUM
44,500.00
TERMS & CONDITIONS`,
];
const sibling = base([
  { key: "policy_product", label: "Product", value: "Package", confidence: 1, page: 1, evidence: "synthetic" },
  { key: "vehicle_class", label: "Class", value: "GCV", confidence: 1, page: 1, evidence: "synthetic" },
  { key: "total_premium", label: "Net", value: "40000", confidence: 1, page: 2, evidence: "synthetic" },
]);
const siblingResult = refineProductionRound10UiicGcvPackage(siblingPages, [], sibling);
assert.equal(field(siblingResult, "vehicle_engine_number"), "FRESHENGINE123456789");
assert.equal(field(siblingResult, "vehicle_chassis_number"), "FRESHCASIS76543210");
assert.equal(field(siblingResult, "vehicle_fuel_type"), "CNG");
assert.equal(field(siblingResult, "od_premium"), "8250");
assert.equal(field(siblingResult, "tp_premium"), "31750");

// Financial rows that do not reconcile must be withheld rather than guessed.
const mismatch = base([
  { key: "total_premium", label: "Net", value: "39990", confidence: 1, page: 2, evidence: "synthetic" },
  { key: "od_premium", label: "OD", value: "111", confidence: 1, page: 2, evidence: "unsafe" },
  { key: "tp_premium", label: "TP", value: "222", confidence: 1, page: 2, evidence: "unsafe" },
]);
const mismatchResult = refineProductionRound10UiicGcvPackage(siblingPages, [], mismatch);
assert.equal(field(mismatchResult, "od_premium"), undefined);
assert.equal(field(mismatchResult, "tp_premium"), undefined);
assert.match(mismatchResult.warnings.join(" "), /did not reconcile/i);

// Missing Chassis evidence must never cause Engine to be copied into Chassis.
const engineOnlyPages = [
  siblingPages[0],
  siblingPages[1].replace(/Chassis Number\nFRESHCASIS76543210\n/, ""),
];
const engineOnly = refineProductionRound10UiicGcvPackage(engineOnlyPages, [], base([
  { key: "total_premium", label: "Net", value: "40000", confidence: 1, page: 2, evidence: "synthetic" },
]));
assert.equal(field(engineOnly, "vehicle_engine_number"), "FRESHENGINE123456789");
assert.equal(field(engineOnly, "vehicle_chassis_number"), undefined);

// Other United India layouts must remain untouched by this refinement.
const unrelated = base([{ key: "od_premium", label: "OD", value: "999", confidence: 1, page: 1, evidence: "synthetic" }]);
const unrelatedPages = ["UNITED INDIA INSURANCE COMPANY LIMITED\nPRIVATE CAR PACKAGE POLICY", "SCHEDULE"];
assert.deepEqual(refineProductionRound10UiicGcvPackage(unrelatedPages, [], unrelated), unrelated);

console.log("Round 10 UIIC GCV Package regression passed.");
