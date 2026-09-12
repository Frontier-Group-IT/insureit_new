import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineProductionRound12UiicGcvMakeModel } from "../lib/policy-ocr-production-round12-uiic-gcv-make-model-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

function base(fields: ParsedPolicyResult["fields"] = []): ParsedPolicyResult {
  return {
    parserId: "united_india_motor_v1",
    parserVersion: "united_india_motor_v1.1.0+prod-r11-uiic_gcv_live_residuals",
    fields,
    warnings: [],
  };
}

function field(result: ParsedPolicyResult, key: string): string | undefined {
  return result.fields.find((entry) => entry.key === key)?.value;
}

const header = `UNITED INDIA INSURANCE COMPANY LIMITED\nMOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER - PACKAGE POLICY`;

// Reproduce the live failure shape: Google table geometry keeps the label but
// shifts the actual value one column because neighboring header cells are merged.
const shiftedPages = [
  header,
  `GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY SCHEDULE
VEHICLE DETAILS
Chassis Number Gross Vehicle Weight RTA Name Vehicle Make & Model Type Of Body / Fuel Type
ZX8CV34B567890123 11990 MP00 SYNTH
SYNTH MOTORS LTD / CARGO 1200 TEST
OPEN BODY / Diesel
Registration Date Cubic Capacity / Seating Capacity Engine Number Year Of Manufacture
01/01/2025 3300 / 3 AB9CD12E345678901 2025
INSURED DECLARED VALUE`,
];
const shiftedTables: StructuredPolicyTable[] = [{
  page: 2,
  rows: [
    ["Chassis Number", "Gross Vehicle Weight", "RTA Name", "Vehicle Make & Model", "Type Of Body / Fuel Type"],
    ["ZX8CV34B567890123", "11990", "MP00 SYNTH", "", "SYNTH MOTORS LTD / CARGO 1200 TEST"],
    ["Registration Date", "Cubic Capacity / Seating Capacity", "Engine Number", "Year Of Manufacture"],
    ["01/01/2025", "3300 / 3", "AB9CD12E345678901", "2025"],
  ],
}];
const shifted = refineProductionRound12UiicGcvMakeModel(shiftedPages, shiftedTables, base());
assert.equal(field(shifted, "vehicle_make"), "SYNTH MOTORS LTD");
assert.equal(field(shifted, "vehicle_model"), "CARGO 1200 TEST");
assert.match(shifted.parserVersion, /prod-r12-uiic_gcv_make_model/);

// Labels-first flattened OCR shape: several table headings appear before their
// values, so "next text after label" is not reliable. The bounded scan must
// skip the Body/Fuel slash and recover the vehicle make/model pair.
const flattenedPages = [
  header,
  `GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY SCHEDULE
VEHICLE DETAILS
Chassis Number
Gross Vehicle Weight
RTA Name
Vehicle Make & Model
Type Of Body / Fuel Type
Registration Date
Cubic Capacity / Seating Capacity
Engine Number
Year Of Manufacture
ZX8CV34B567890123
11990
MP00 SYNTH
ALPHA COMMERCIAL VEHICLES LTD / ROADSTAR 1618 X
OPEN BODY / CNG
01/01/2025
3300 / 3
AB9CD12E345678901
2025
INSURED DECLARED VALUE`,
];
const flattened = refineProductionRound12UiicGcvMakeModel(flattenedPages, [], base());
assert.equal(field(flattened, "vehicle_make"), "ALPHA COMMERCIAL VEHICLES LTD");
assert.equal(field(flattened, "vehicle_model"), "ROADSTAR 1618 X");

// Do not mistake the adjacent Body/Fuel slash for Make/Model.
const bodyFuelOnlyPages = [
  header,
  `GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY SCHEDULE
VEHICLE DETAILS
Vehicle Make & Model
Type Of Body / Fuel Type
OPEN BODY / Diesel
Engine Number AB9CD12E345678901
INSURED DECLARED VALUE`,
];
const bodyFuelOnly = refineProductionRound12UiicGcvMakeModel(bodyFuelOnlyPages, [], base());
assert.equal(field(bodyFuelOnly, "vehicle_make"), undefined);
assert.equal(field(bodyFuelOnly, "vehicle_model"), undefined);

// Preserve an already verified Make/Model pair; this training is recovery-only.
const alreadyCorrect = base([
  { key: "vehicle_make", label: "Vehicle make", value: "VERIFIED MOTORS LTD", confidence: 1, page: 2, evidence: "verified" },
  { key: "vehicle_model", label: "Vehicle model", value: "TRUCK 1916", confidence: 1, page: 2, evidence: "verified" },
]);
const preserved = refineProductionRound12UiicGcvMakeModel(shiftedPages, shiftedTables, alreadyCorrect);
assert.equal(field(preserved, "vehicle_make"), "VERIFIED MOTORS LTD");
assert.equal(field(preserved, "vehicle_model"), "TRUCK 1916");
assert.equal(preserved.parserVersion, alreadyCorrect.parserVersion);

// Other UIIC layouts must remain untouched.
const unrelatedPages = ["UNITED INDIA INSURANCE COMPANY LIMITED\nPRIVATE CAR PACKAGE POLICY", "VEHICLE DETAILS\nVehicle Make & Model\nOTHER MOTORS / SEDAN 1.5"];
const unrelated = base();
assert.deepEqual(refineProductionRound12UiicGcvMakeModel(unrelatedPages, [], unrelated), unrelated);

console.log("Round 12 UIIC GCV Make/Model regression passed.");
