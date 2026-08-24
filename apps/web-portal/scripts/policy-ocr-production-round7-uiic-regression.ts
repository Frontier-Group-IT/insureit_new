import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineProductionRound7UiicPrecision } from "../lib/policy-ocr-production-round7-uiic-precision-guard.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";

function field(result: ParsedPolicyResult, key: string): string | undefined {
  return result.fields.find((entry) => entry.key === key)?.value;
}

const broken: ParsedPolicyResult = {
  parserId: "united_india_motor_v1",
  parserVersion: "united_india_motor_v1.1.0+prod-r5-uiic_precision+prod-r6-uiic_residual",
  fields: [
    { key: "policy_product", label: "Product", value: "Package", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "vehicle_class", label: "Class", value: "GCV", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "idv", label: "IDV", value: "722000", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "total_premium", label: "Net", value: "16448", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "gross_premium", label: "Gross", value: "188.77", confidence: 1, page: 2, evidence: "synthetic failure" },
    { key: "tax_amount", label: "GST", value: "33", confidence: 1, page: 2, evidence: "synthetic failure" },
    { key: "od_premium", label: "OD", value: "0", confidence: 1, page: 1, evidence: "synthetic failure" },
    { key: "vehicle_capacity", label: "Capacity", value: "2026", confidence: 1, page: 2, evidence: "synthetic failure" },
    { key: "vehicle_engine_number", label: "Engine", value: "MD9AB12C3D4567890", confidence: 1, page: 1, evidence: "synthetic chassis misread" },
  ],
  warnings: [],
};

const repaired = refineProductionRound7UiicPrecision(broken);
assert.equal(field(repaired, "vehicle_chassis_number"), "MD9AB12C3D4567890");
assert.equal(field(repaired, "vehicle_engine_number"), undefined);
assert.equal(field(repaired, "gross_premium"), undefined);
assert.equal(field(repaired, "tax_amount"), undefined);
assert.equal(field(repaired, "od_premium"), undefined);
assert.equal(field(repaired, "vehicle_capacity"), undefined);
assert.match(repaired.parserVersion, /prod-r7-uiic_precision_guard/);

const valid: ParsedPolicyResult = {
  ...broken,
  fields: [
    { key: "policy_product", label: "Product", value: "Package", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "vehicle_class", label: "Class", value: "GCV", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "idv", label: "IDV", value: "661500", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "total_premium", label: "Net", value: "21484", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "gross_premium", label: "Gross", value: "23578", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "tax_amount", label: "GST", value: "2094", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "od_premium", label: "OD", value: "7467", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "vehicle_capacity", label: "Capacity", value: "1610", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "vehicle_engine_number", label: "Engine", value: "000FT741700026070394", confidence: 1, page: 1, evidence: "synthetic" },
  ],
};
const preserved = refineProductionRound7UiicPrecision(valid);
assert.equal(field(preserved, "gross_premium"), "23578");
assert.equal(field(preserved, "tax_amount"), "2094");
assert.equal(field(preserved, "od_premium"), "7467");
assert.equal(field(preserved, "vehicle_capacity"), "1610");
assert.equal(field(preserved, "vehicle_engine_number"), "000FT741700026070394");

const unrelated: ParsedPolicyResult = { ...broken, parserId: "digit_commercial_motor_v1" };
assert.deepEqual(refineProductionRound7UiicPrecision(unrelated), unrelated);

console.log("Round 7 UIIC precision guard regression passed.");
