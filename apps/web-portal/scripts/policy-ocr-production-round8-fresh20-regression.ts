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
const nationalFixed = refineProductionRound8Fresh20Precision(["National Insurance Co. Ltd.\nLong Term Two Wheelers Bundled Policy\nPremium ₹ 4,096.00\nIGST ₹ 737.00\nTotal Amount ₹ 4,833.00", "Schedule of Premium\nLegal Liability Cover 3,851.00"], [], national);
assert.equal(field(nationalFixed, "policy_product"), "Bundled");
assert.equal(field(nationalFixed, "total_premium"), "4096");
assert.equal(field(nationalFixed, "tax_amount"), "737");
assert.equal(field(nationalFixed, "gross_premium"), "4833");
assert.equal(field(nationalFixed, "od_premium"), "245");
assert.equal(field(nationalFixed, "tp_premium"), "3851");
assert.equal(field(nationalFixed, "cpa_opted"), "No");

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

const iffco: ParsedPolicyResult = {
  parserId: "iffco_tokio_commercial_motor_v2", parserVersion: "iffco_tokio_commercial_motor_v2.3.0", fields: [], warnings: [],
};
const iffcoFixed = refineProductionRound8Fresh20Precision([
  "IFFCO-TOKIO GENERAL INSURANCE CO.LTD\nBasic TP Premium 7267.00\nNet (A) 2068.00 Net (B) 7317.00\nTotal 9385.00 1689.30 11074.30",
], [], iffco);
assert.equal(field(iffcoFixed, "od_premium"), "2068");
assert.equal(field(iffcoFixed, "tp_premium"), "7267");
assert.equal(field(iffcoFixed, "cpa_premium"), "0");
assert.equal(field(iffcoFixed, "total_premium"), "9385");
assert.equal(field(iffcoFixed, "tax_amount"), "1689.3");
assert.equal(field(iffcoFixed, "gross_premium"), "11074.3");

const magma: ParsedPolicyResult = {
  parserId: "magma_motor_v1", parserVersion: "magma_motor_v1.1.0+layout-magma_pcp_package-v6", fields: [
    { key: "vehicle_registration_number", label: "Registration", value: "HR30R853923062017", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "cpa_opted", label: "CPA", value: "No", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "cpa_premium", label: "CPA premium", value: "30", confidence: 1, page: 1, evidence: "synthetic" },
  ], warnings: [],
};
const magmaFixed = refineProductionRound8Fresh20Precision([
  "MAGMA GENERAL INSURANCE LIMITED\nBasic - TP 2,094.00\nPA Owner Driver -SI Rs.1500000 Tenure 1 Year(s) 375.00\nLL to Paid Driver IMT 28 50.00",
], [], magma);
assert.equal(field(magmaFixed, "vehicle_registration_number"), "HR30R8539");
assert.equal(field(magmaFixed, "tp_premium"), "2144");
assert.equal(field(magmaFixed, "cpa_opted"), "Yes");
assert.equal(field(magmaFixed, "cpa_premium"), "375");

const hdfc: ParsedPolicyResult = {
  parserId: "hdfc_ergo_motor_v1", parserVersion: "hdfc_ergo_motor_v1.1.0+layout-hdfc_twp_tp-v6", fields: [
    { key: "tax_amount", label: "GST", value: "1010", confidence: 1, page: 1, evidence: "synthetic" },
    { key: "gross_premium", label: "Gross", value: "3814", confidence: 1, page: 1, evidence: "synthetic" },
  ], warnings: [],
};
const hdfcFixed = refineProductionRound8Fresh20Precision([
  "HDFC ERGO GENERAL INSURANCE COMPANY LIMITED\nPolicy No. 2301 2087 3966 4700 000\nGST 18% : Central Tax 9% (252.5) + State Tax 9% (252.5) 505\nTotal Premium 3309",
], [{ page: 1, rows: [["GST 18%", "505"], ["Total Premium", "3309"]] }], hdfc);
assert.equal(field(hdfcFixed, "policy_number"), "2301208739664700000");
assert.equal(field(hdfcFixed, "tax_amount"), "505");
assert.equal(field(hdfcFixed, "gross_premium"), "3309");

console.log("Round 8 fresh20 precision regression passed.");
