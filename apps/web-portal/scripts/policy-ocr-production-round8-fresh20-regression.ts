import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineProductionRound8Fresh20Precision } from "../lib/policy-ocr-production-round8-fresh20-precision-guard.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";

function field(result: ParsedPolicyResult, key: string): string | undefined {
  return result.fields.find((entry) => entry.key === key)?.value;
}

const noisy: ParsedPolicyResult = {
  parserId: "universal_sompo_motor_v1",
  parserVersion: "universal_sompo_motor_v1.1.0",
  fields: [
    { key: "policy_product", label: "Product", value: "Package", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "vehicle_class", label: "Class", value: "/category of the vehicle is different than what is mentioned", confidence: 1, page: 4, evidence: "synthetic" },
    { key: "vehicle_make", label: "Make", value: "your insurance experience seamless, we have introd", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "vehicle_model", label: "Model", value: "CUBIC", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "vehicle_capacity", label: "Capacity", value: "2021", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "vehicle_rto_name", label: "RTO", value: "LOCATION", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "vehicle_engine_number", label: "Engine", value: "CHASSIS", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "total_premium", label: "Net", value: "8250", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "gross_premium", label: "Gross", value: "8250", confidence: 1, page: 2, evidence: "synthetic" },
    { key: "tax_amount", label: "GST", value: "18", confidence: 1, page: 2, evidence: "synthetic" },
  ],
  warnings: [],
};
const guarded = refineProductionRound8Fresh20Precision(["UNIVERSAL SOMPO GENERAL INSURANCE"], [], noisy);
for (const key of ["vehicle_class", "vehicle_make", "vehicle_model", "vehicle_capacity", "vehicle_rto_name", "vehicle_engine_number", "gross_premium", "tax_amount"]) assert.equal(field(guarded, key), undefined);
assert.match(guarded.parserVersion, /prod-r8-fresh20_precision/);

const national: ParsedPolicyResult = {
  parserId: "national_motor_v1", parserVersion: "national_motor_v1.1.0+prod-r2-national", fields: [
    { key: "policy_product", label: "Product", value: "Package", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "tax_amount", label: "GST", value: "14", confidence: 1, page: 1, evidence: "synthetic" },
  ], warnings: [],
};
const nationalFixed = refineProductionRound8Fresh20Precision(["National Insurance Co. Ltd.\nLong Term Two Wheelers Bundled Policy\nPremium ₹ 4,096.00\nIGST ₹ 737.00\nTotal Amount ₹ 4,833.00"], [], national);
assert.equal(field(nationalFixed, "policy_product"), "Bundled");
assert.equal(field(nationalFixed, "total_premium"), "4096");
assert.equal(field(nationalFixed, "tax_amount"), "737");
assert.equal(field(nationalFixed, "gross_premium"), "4833");

const uiic: ParsedPolicyResult = {
  parserId: "united_india_motor_v1", parserVersion: "united_india_motor_v1.1.0+prod-r7-uiic_precision_guard", fields: [
    { key: "total_premium", label: "Net", value: "16667", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "cpa_opted", label: "CPA", value: "No", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "cpa_premium", label: "CPA Premium", value: "0", confidence: 1, page: 1, evidence: "synthetic" },
  ], warnings: [],
};
const uiicFixed = refineProductionRound8Fresh20Precision(["UNITED INDIA INSURANCE COMPANY LIMITED\nCGST-Others(9%): 272.00\nSGST-Others(9%): 272.00\nCGST-Basic TP(2.50%): 341.00\nSGST-Basic TP(2.50%): 341.00\nCompulsory PA for Owner Driver 275.00"], [], uiic);
assert.equal(field(uiicFixed, "cpa_opted"), "Yes");
assert.equal(field(uiicFixed, "cpa_premium"), "275");
assert.equal(field(uiicFixed, "tax_amount"), "1226");
assert.equal(field(uiicFixed, "gross_premium"), "17893");

console.log("Round 8 fresh20 precision regression passed.");
