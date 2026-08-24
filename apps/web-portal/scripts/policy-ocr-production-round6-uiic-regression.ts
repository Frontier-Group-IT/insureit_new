import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineApprovedMotorPolicyLayout } from "../lib/policy-ocr-approved-layout-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";

function field(result: ParsedPolicyResult, key: string): string | undefined {
  return result.fields.find((entry) => entry.key === key)?.value;
}

const broken: ParsedPolicyResult = {
  parserId: "united_india_motor_v1",
  parserVersion: "united_india_motor_v1.1.0+layout-uiic_gcv_3w_tp-v6+prod-r4-uiic_gcv_package+prod-r5-uiic_precision",
  fields: [
    { key: "total_premium", label: "Net premium", value: "16448", confidence: .99, page: 2, evidence: "existing" },
    { key: "tax_amount", label: "Printed GST", value: "33", confidence: .99, page: 2, evidence: "failure" },
    { key: "gross_premium", label: "Printed gross", value: "188.77", confidence: .99, page: 2, evidence: "failure" },
    { key: "od_premium", label: "OD", value: "2706", confidence: .99, page: 2, evidence: "existing" },
    { key: "tp_premium", label: "TP", value: "13642", confidence: .99, page: 2, evidence: "existing" },
    { key: "vehicle_capacity", label: "Capacity", value: "2026", confidence: .99, page: 2, evidence: "failure" },
    { key: "vehicle_engine_number", label: "Engine", value: "SYNTHVIN000000001", confidence: .99, page: 1, evidence: "failure" },
  ],
  warnings: [],
};

const pages = [
  `UNITED INDIA INSURANCE COMPANY LIMITED
MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY`,
  `MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY SCHEDULE
VEHICLE DETAILS
Registration Number NEW
Obsolete Vehicle & Chassis Number
No & SYNTHVIN000000001 Gross vehicle Weight
2300
RTA Name RJ14 TEST Vehicle Make & Model
EULER
MOTORS_NONGICOUNCIL /
TURBO EV 1000 MAXX FB
Type Of Body GOODS CARRIER
Engine Number
SYNTHMTR0000000000001
Year Of Manufacture 2026
INSURED DECLARED VALUE
SCHEDULE OF PREMIUM
Gross OD(A)
2,706.00
B. Basic - TP
13,642.00
Premium(A+B)
16,448.00
CGST-Others(9%) 267.00
SGST-Others(9%) 267.00
CGST-Basic TP(2.50%) 327.00
SGST-Basic TP(2.50%) 327.00
TOTAL PAYABLE PREMIUM
17,636.00
TERMS & CONDITIONS`,
];

const result = refineApprovedMotorPolicyLayout(pages, [], broken);
assert.equal(field(result, "printed_net_premium") ?? field(result, "total_premium"), "16448");
assert.equal(field(result, "tax_amount"), "1188");
assert.equal(field(result, "gross_premium"), "17636");
assert.equal(field(result, "vehicle_make"), "EULER MOTORS_NONGICOUNCIL");
assert.equal(field(result, "vehicle_model"), "TURBO EV 1000 MAXX FB");
assert.equal(field(result, "vehicle_fuel_type"), "Electric");
assert.equal(field(result, "vehicle_capacity"), "2300");
assert.equal(field(result, "vehicle_engine_number"), "SYNTHMTR0000000000001");
assert.equal(field(result, "vehicle_chassis_number"), "SYNTHVIN000000001");
assert.match(result.parserVersion, /prod-r6-uiic_residual/);

const second: ParsedPolicyResult = {
  ...broken,
  fields: broken.fields.map((entry) => entry.key === "total_premium" ? { ...entry, value: "21484" } : entry),
};
const secondPages = [pages[0], `MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY SCHEDULE
VEHICLE DETAILS
Chassis Number TESTVIN0000000002
Gross vehicle Weight 1610
Vehicle Make & Model Tata Motors / ACE PRO EV CLB
Type Of Body Closed
Engine Number TESTMTR0000000000002
Year Of Manufacture 2026
INSURED DECLARED VALUE
SCHEDULE OF PREMIUM
Gross OD(A) 7,467.00
B. Basic - TP 13,642.00
Premium(A+B) 21,484.00
IGST-Others(18%) 1,412.00
IGST-Basic TP(5%) 682.00
Total(Rounded Off): 23,578.00
TERMS & CONDITIONS`];
const secondResult = refineApprovedMotorPolicyLayout(secondPages, [], second);
assert.equal(field(secondResult, "tax_amount"), "2094");
assert.equal(field(secondResult, "gross_premium"), "23578");
assert.equal(field(secondResult, "vehicle_make"), "Tata Motors");
assert.equal(field(secondResult, "vehicle_model"), "ACE PRO EV CLB");
assert.equal(field(secondResult, "vehicle_engine_number"), "TESTMTR0000000000002");
assert.equal(field(secondResult, "vehicle_chassis_number"), "TESTVIN0000000002");

console.log("Round 6 UIIC residual regression passed.");
