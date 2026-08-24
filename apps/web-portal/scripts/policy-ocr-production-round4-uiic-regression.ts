import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineApprovedMotorPolicyLayout } from "../lib/policy-ocr-approved-layout-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";

function field(result: ParsedPolicyResult, key: string): string | undefined {
  return result.fields.find((entry) => entry.key === key)?.value;
}

const broken: ParsedPolicyResult = {
  parserId: "united_india_motor_v1",
  parserVersion: "united_india_motor_v1.1.0+layout-uiic_gcv_3w_tp-v6",
  fields: [
    { key: "policy_product", label: "Policy product", value: "Third Party", confidence: 1, page: 1, evidence: "old failure" },
    { key: "idv", label: "IDV / Sum insured", value: "0", confidence: 1, page: 1, evidence: "old failure" },
    { key: "od_premium", label: "OD premium", value: "0", confidence: 1, page: 1, evidence: "old failure" },
    { key: "vehicle_make", label: "Vehicle make", value: "/Model", confidence: .9, page: 1, evidence: "old failure" },
    { key: "vehicle_model", label: "Vehicle model", value: "Year", confidence: .9, page: 1, evidence: "old failure" },
  ],
  warnings: ["Review required. Missing or uncertain fields: policy_number."],
};

const cpaYesPages = [
  `UNITED INDIA INSURANCE COMPANY LIMITED
MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY
Policy No. TEST0001
Effective date of commencement of Insurance for the purpose of Act from 14:09 Hrs on 29/07/2026
Insured's Declared Value 731500
Date of Expiry of the Insurance Midnight on 28/07/2027
Registration No. Obsolete Vehicle Engine No. Chassis No. Make/Model Type of Body Year of Mfg HP/Cubic Capacity GVW
NEW No TESTENGINE00000000001 TESTCHASSIS000001 EULER MOTORS_NONGICOUNCIL / TURBO EV 1000 GOODS CARRIER 2026 30 2300`,
  `MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY SCHEDULE
Policy Number :TEST0001 Previous Policy Number :
Insurance Start Date & Time :29/07/2026 14:09 (hours)
Insurance expiry Date & Time :28/07/2027 midnight
VEHICLE DETAILS
Registration Number NEW Obsolete Vehicle & Chassis Number No & TESTCHASSIS000001 Gross vehicle Weight 2300
RTA Name RJ41 CHOMU (JAIPUR) Vehicle Make & Model EULER MOTORS_NONGICOUNCIL / TURBO EV 1000 null Type Of Body GOODS CARRIER
Engine Number TESTENGINE00000000001 Year Of Manufacture 2026
INSURED DECLARED VALUE 731500
SCHEDULE OF PREMIUM
Gross OD(A) 2,715.00
B. Basic - TP 13,642.00
Compulsory PA for Owner Driver 275.00
LL to Paid Driver IMT 28 100.00
Gross TP(B) 14,017.00
Premium(A+B) 16,732.00
CGST-Others(9%) 278.00
SGST-Others(9%) 278.00
CGST-Basic TP(2.50%) 341.00
SGST-Basic TP(2.50%) 341.00
TOTAL PAYABLE PREMIUM 17,970.00`,
];

const yes = refineApprovedMotorPolicyLayout(cpaYesPages, [], broken);
assert.equal(field(yes, "policy_product"), "Package");
assert.equal(field(yes, "policy_number"), "TEST0001");
assert.equal(field(yes, "policy_start_date"), "2026-07-29");
assert.equal(field(yes, "policy_end_date"), "2027-07-28");
assert.equal(field(yes, "idv"), "731500");
assert.equal(field(yes, "od_premium"), "2715");
assert.equal(field(yes, "tp_premium"), "13642");
assert.equal(field(yes, "cpa_opted"), "Yes");
assert.equal(field(yes, "cpa_premium"), "275");
assert.equal(field(yes, "total_premium"), "16732");
assert.equal(field(yes, "tax_amount"), "1238");
assert.equal(field(yes, "gross_premium"), "17970");
assert.equal(field(yes, "vehicle_make"), "EULER MOTORS_NONGICOUNCIL");
assert.equal(field(yes, "vehicle_model"), "TURBO EV 1000");
assert.equal(field(yes, "vehicle_fuel_type"), "Electric");
assert.equal(field(yes, "vehicle_manufacturing_year"), "2026");
assert.equal(field(yes, "vehicle_capacity"), "2300");
assert.equal(field(yes, "vehicle_rto_name"), "RJ41 CHOMU (JAIPUR)");
assert.equal(field(yes, "vehicle_rto_state"), "Rajasthan");
assert.equal(field(yes, "vehicle_engine_number"), "TESTENGINE00000000001");
assert.equal(field(yes, "vehicle_chassis_number"), "TESTCHASSIS000001");
assert.equal(field(yes, "vehicle_registration_status"), "registration_pending");
assert.match(yes.parserVersion, /prod-r4-uiic_gcv_package/);

const cpaNoPages = [
  `UNITED INDIA INSURANCE COMPANY LIMITED
MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY
Insured's Declared Value 722000`,
  `MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY SCHEDULE
Policy Number :TEST0002 Previous Policy Number :
Insurance Start Date & Time :29/07/2026 16:33 (hours)
Insurance expiry Date & Time :28/07/2027 midnight
Registration Number NEW Obsolete Vehicle & Chassis Number No & TESTCHASSIS000002 Gross vehicle Weight 2300
RTA Name RJ14 JAIPUR Vehicle Make & Model EULER MOTORS_NONGICOUNCIL / TURBO EV 1000 MAXX FB Type Of Body GOODS CARRIER
Engine Number TESTENGINE00000000002 Year Of Manufacture 2026
Gross OD(A) 2,706.00
B. Basic - TP 13,642.00
LL to Paid Driver IMT 28 100.00
Gross TP(B) 13,742.00
Premium(A+B) 16,448.00
CGST-Others(9%) 253.00
SGST-Others(9%) 253.00
CGST-Basic TP(2.50%) 341.00
SGST-Basic TP(2.50%) 341.00
TOTAL PAYABLE PREMIUM 17,636.00`,
];

const no = refineApprovedMotorPolicyLayout(cpaNoPages, [], broken);
assert.equal(field(no, "cpa_opted"), "No");
assert.equal(field(no, "cpa_premium"), "0");
assert.equal(field(no, "tp_premium"), "13642", "paid-driver liability must not become TP or CPA");
assert.equal(field(no, "tax_amount"), "1188");
assert.equal(field(no, "gross_premium"), "17636");

console.log("Round 4 UIIC GCV package regression passed.");
