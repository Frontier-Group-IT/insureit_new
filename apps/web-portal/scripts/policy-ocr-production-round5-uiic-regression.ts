import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineApprovedMotorPolicyLayout } from "../lib/policy-ocr-approved-layout-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";

function field(result: ParsedPolicyResult, key: string): string | undefined {
  return result.fields.find((entry) => entry.key === key)?.value;
}

const broken: ParsedPolicyResult = {
  parserId: "united_india_motor_v1",
  parserVersion: "united_india_motor_v1.1.0+layout-uiic_gcv_3w_tp-v6+prod-r4-uiic_gcv_package",
  fields: [
    { key: "vehicle_make", label: "Vehicle make", value: "/Model", confidence: .9, page: 1, evidence: "failure" },
    { key: "vehicle_model", label: "Vehicle model", value: "Seating Capacity Year Of Manufacture EULER Weight MOTORS_NONGICOUNCIL /", confidence: .9, page: 2, evidence: "failure" },
    { key: "vehicle_engine_number", label: "Engine number", value: "SYNTHCHASSIS00001", confidence: .9, page: 1, evidence: "failure" },
    { key: "vehicle_chassis_number", label: "Chassis number", value: "HPCUBICCAPACITY", confidence: .9, page: 1, evidence: "failure" },
    { key: "cpa_opted", label: "CPA opted", value: "No", confidence: .9, page: 2, evidence: "failure" },
    { key: "cpa_premium", label: "CPA amount", value: "0", confidence: .9, page: 2, evidence: "failure" },
    { key: "tax_amount", label: "Printed GST", value: "682", confidence: .9, page: 2, evidence: "failure" },
    { key: "gross_premium", label: "Printed gross premium", value: "17414", confidence: .9, page: 2, evidence: "failure" },
  ],
  warnings: [],
};

const pages = [
  `UNITED INDIA INSURANCE COMPANY LIMITED
MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY
Policy No. SYNTHPOLICY000001
Particulars of Vehicle Insured
Registration No. Obsolete
Vehicle Engine No. Chassis No. Make/Model Type of Body Year of Mfg HP/Cubic Capacity GVW Vehicle Trailer
NEW No SYNTHENGINE0000000001SYNTHCHASSIS00001 EULER MOTORS_NONGICOUNCIL /
TURBO EV 1000 MAXX FB
GOODS CARRIER 2026 30.86 2300
Registration Authority Geographical Area Financier Seating Capacity Public / Private
RJ14 JAIPUR INDIA 2 Public
Premium: 16,723.00
CGST-Others(9%): 277.00
SGST-Others(9%): 277.00
CGST-Basic TP(2.50%): 341.00
SGST-Basic TP(2.50%): 341.00
Total(Rounded Off): 17,959.00`,
  `MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY SCHEDULE
Policy Number :SYNTHPOLICY000001 Previous Policy Number :
VEHICLE DETAILS
Registration Number NEW Obsolete Vehicle &
Chassis Number
No & SYNTHCHASSIS00001 Gross vehicle
Weight
2300
RTA Name RJ14 JAIPUR Vehicle Make & Model
EULER
MOTORS_NONGICOUNCIL /
TURBO EV 1000 MAXX FB
Type Of Body GOODS CARRIER
Registration Date 22/07/2026 Cubic Capacity/Seating Capacity 30.86/2
Engine Number SYNTHENGINE0000000001 Year Of Manufacture 2026
INSURED DECLARED VALUE
SCHEDULE OF PREMIUM
Gross OD(A) 2,706.00
B. Basic - TP 13,642.00
Compulsory PA for Owner Driver
275.00
LL to Paid Driver IMT 28 100.00
Gross TP(B) 14,017.00
Premium(A+B) 16,723.00
CGST-Others(9%)
277.00
SGST-Others(9%)
277.00
CGST-Basic TP(2.50%)
341.00
SGST-Basic TP(2.50%)
341.00
TOTAL PAYABLE PREMIUM
17,959.00
TERMS & CONDITIONS`,
];

const result = refineApprovedMotorPolicyLayout(pages, [], broken);
assert.equal(field(result, "policy_number"), "SYNTHPOLICY000001");
assert.equal(field(result, "vehicle_make"), "EULER MOTORS_NONGICOUNCIL");
assert.equal(field(result, "vehicle_model"), "TURBO EV 1000 MAXX FB");
assert.equal(field(result, "vehicle_fuel_type"), "Electric");
assert.equal(field(result, "vehicle_engine_number"), "SYNTHENGINE0000000001");
assert.equal(field(result, "vehicle_chassis_number"), "SYNTHCHASSIS00001");
assert.equal(field(result, "vehicle_manufacturing_year"), "2026");
assert.equal(field(result, "vehicle_capacity"), "2300");
assert.equal(field(result, "vehicle_rto_name"), "RJ14 JAIPUR");
assert.equal(field(result, "vehicle_rto_state"), "Rajasthan");
assert.equal(field(result, "cpa_opted"), "Yes");
assert.equal(field(result, "cpa_premium"), "275");
assert.equal(field(result, "tax_amount"), "1236");
assert.equal(field(result, "gross_premium"), "17959");
assert.match(result.parserVersion, /prod-r5-uiic_precision/);

const igstPages = [
  `UNITED INDIA INSURANCE COMPANY LIMITED
MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY`,
  `MOTOR INSURANCE - GCV PUBLIC CARRIER OTHER THAN 3 WHEELER PACKAGE POLICY SCHEDULE
VEHICLE DETAILS
Registration Number NEW Obsolete Vehicle & Chassis Number No & SYNTHCHASSIS00002 Gross vehicle Weight 1610
RTA Name MP20 JABALPUR Vehicle Make & Model Tata Motors / ACE PRO EV CLB Type Of Body Closed
Engine Number SYNTHENGINE0000000002 Year Of Manufacture 2026
INSURED DECLARED VALUE
SCHEDULE OF PREMIUM
Compulsory PA for Owner Driver 275.00
Premium(A+B) 21,484.00
IGST-Others(18%)
1,412.00
IGST-Basic TP(5%)
682.00
TOTAL PAYABLE PREMIUM
23,578.00
TERMS & CONDITIONS`,
];
const igst = refineApprovedMotorPolicyLayout(igstPages, [], broken);
assert.equal(field(igst, "vehicle_make"), "Tata Motors");
assert.equal(field(igst, "vehicle_model"), "ACE PRO EV CLB");
assert.equal(field(igst, "vehicle_rto_state"), "Madhya Pradesh");
assert.equal(field(igst, "tax_amount"), "2094");
assert.equal(field(igst, "gross_premium"), "23578");

console.log("Round 5 UIIC precision regression passed.");
