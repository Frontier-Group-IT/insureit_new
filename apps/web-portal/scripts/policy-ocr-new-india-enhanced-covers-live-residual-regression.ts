import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineNewIndiaEnhancedCoversLiveResiduals } from "../lib/policy-ocr-new-india-enhanced-covers-live-residual-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

function field(result: ParsedPolicyResult, key: string) {
  return result.fields.find((entry) => entry.key === key)?.value;
}

function base(fields: ParsedPolicyResult["fields"] = []): ParsedPolicyResult {
  return { parserId: "new_india_motor_v1", parserVersion: "new_india_motor_v1+new-india-enhanced-covers-v1", fields, warnings: [] };
}

const pages = [
  `THE NEW INDIA ASSURANCE CO. LTD.\nCommercial Vehicle Package Policy - Enhanced Covers\nVEHICLE DETAILS`,
  `SCHEDULE OF PREMIUM`,
];

const alreadyImproved = base([
  { key: "vehicle_make", label: "Vehicle make", value: "SYNTH TRUCKS", confidence: 1, page: 1, evidence: "prior pass" },
  { key: "vehicle_model", label: "Vehicle model", value: "5532", confidence: 1, page: 1, evidence: "prior pass" },
  { key: "vehicle_capacity", label: "Vehicle capacity", value: "55000", confidence: 1, page: 1, evidence: "prior pass" },
  { key: "vehicle_rto_state", label: "RTO state", value: "Rajasthan", confidence: 1, page: 1, evidence: "prior pass" },
  { key: "vehicle_class", label: "Vehicle class", value: "GCV", confidence: 1, page: 1, evidence: "prior pass" },
  { key: "tp_premium", label: "Third party premium", value: "44667", confidence: 1, page: 2, evidence: "prior pass" },
]);

const tables: StructuredPolicyTable[] = [{
  page: 1,
  rows: [
    ["Geographical Area / Zone", "India/C", "Year of manufacture", "2026"],
    ["Chassis no./Engine no.", "ZXCVBNM1234567 / ENG 55 TEST 998877"],
    ["Type of fuel", "Diesel", "Gross Vehicle Weight (GVW)", "55000"],
    ["Make/Model", "SYNTH TRUCKS/5532", "Registration no.", "RJ-45"],
  ],
}];

const repaired = refineNewIndiaEnhancedCoversLiveResiduals(pages, tables, alreadyImproved);
assert.equal(field(repaired, "vehicle_manufacturing_year"), "2026");
assert.equal(field(repaired, "vehicle_chassis_number"), "ZXCVBNM1234567");
assert.equal(field(repaired, "vehicle_engine_number"), "ENG55TEST998877");
assert.equal(field(repaired, "vehicle_make"), "SYNTH TRUCKS");
assert.equal(field(repaired, "vehicle_model"), "5532");
assert.equal(field(repaired, "tp_premium"), "44667");
assert.match(repaired.parserVersion, /live-residual-v1/);

const sibling = refineNewIndiaEnhancedCoversLiveResiduals(
  pages,
  [{ page: 1, rows: [["Year of manufacture", "2024"], ["Chassis no./Engine no.", "QWERTY123456789/AB 12 CD 34567890"]] }],
  base(),
);
assert.equal(field(sibling, "vehicle_manufacturing_year"), "2024");
assert.equal(field(sibling, "vehicle_chassis_number"), "QWERTY123456789");
assert.equal(field(sibling, "vehicle_engine_number"), "AB12CD34567890");

const preserved = refineNewIndiaEnhancedCoversLiveResiduals(
  pages,
  tables,
  base([
    { key: "vehicle_manufacturing_year", label: "Manufacturing year", value: "2025", confidence: 1, page: 1, evidence: "already proven" },
    { key: "vehicle_chassis_number", label: "Chassis", value: "KEEPEXISTING123", confidence: 1, page: 1, evidence: "already proven" },
    { key: "vehicle_engine_number", label: "Engine", value: "KEEPENGINE456", confidence: 1, page: 1, evidence: "already proven" },
  ]),
);
assert.equal(field(preserved, "vehicle_manufacturing_year"), "2025");
assert.equal(field(preserved, "vehicle_chassis_number"), "KEEPEXISTING123");
assert.equal(field(preserved, "vehicle_engine_number"), "KEEPENGINE456");

const unrelated = base();
assert.deepEqual(
  refineNewIndiaEnhancedCoversLiveResiduals(["THE NEW INDIA ASSURANCE CO. LTD.\nGOODS CARRYING VEHICLE PACKAGE POLICY"], tables, unrelated),
  unrelated,
);

console.log("New India Enhanced Covers live residual regression passed.");
