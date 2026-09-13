import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { parsePolicyDocument } from "../lib/policy-ocr-parsers.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineNewIndiaCommercialPolicy } from "../lib/policy-ocr-new-india-refiner.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineNewIndiaStructuredPolicy } from "../lib/policy-ocr-new-india-structured-refiner.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineApprovedMotorPolicyLayout } from "../lib/policy-ocr-approved-layout-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";

function field(result: ParsedPolicyResult, key: string) {
  return result.fields.find((entry) => entry.key === key)?.value;
}

const pages = [
  `THE NEW INDIA ASSURANCE CO. LTD.
(Government of India Undertaking)
POLICY SCHEDULE CUM CERTIFICATE OF INSURANCE
Commercial Vehicle Package Policy ? Enhanced Covers
UIN Number - IRDAN190RP0044V01100001
Policy Number :31280031260300009991
POLICY DETAILS
Period of cover 12/09/2026 04:35:13 PM to 11/09/2027 11:59:59 PM
Previous Insurer Not applicable Previous Policy Number NA
VEHICLE DETAILS
Geographical Area / Zone: India/C Year of manufacture: 2026
Type of Commercial
Vehicles:
A - Goods Carrying Sub Type: Other than 3 wheeler -
Public Carrier
Name of the Financier: SYNTHETIC FINANCE COMPANY LTD
Chassis no./Engine no.: EN9G2695D01234/MEC7TEST
0TP106204
Type of fuel: Diesel Cubic
capacity(cc)/Wattage(kW):
0cc
Type of body: Open Gross Vehicle Weight
(GVW):
55000
Make/Model: BHARATBENZ/5532 Registration no. RJ-45
Seating capacity including
Driver:
3 Variant: 5532T 4X2
Name of registration
authority:
RAJASTHAN
INSURED DECLARED VALUE (Rs)
Vehicle Trailer Non-Elec Acc Electrical Acc Bi-fuel/CNG/LPG kit Total Value
5558450 0 0 0 5558450`,
  `THE NEW INDIA ASSURANCE CO. LTD.
SCHEDULE OF PREMIUM
Own Damage Liability
Basic OD Premium 14391
Basic TP Premium 44242
(+)Compulsory PA Premium for Owner Driver(Sum Insured Rs 1500000) 275
(+)LL to paid driver conductor cleaner employed for oprn 150
Calculated OD Premium 41397 Calculated TP Premium 44667
Total OD Premium (Rs) 41397 Total TP Premium (Rs) 44667
Net Premium (Rs) 86,064
GST (Rs) 9,740
Total Payable (Rs) 95,804`,
];

const base = parsePolicyDocument(pages);
assert.equal(base.parserId, "new_india_motor_v1");
const text = refineNewIndiaCommercialPolicy(pages, base);
const structured = refineNewIndiaStructuredPolicy([], text);
const result = refineApprovedMotorPolicyLayout(pages, [], structured);

assert.equal(field(result, "vehicle_manufacturing_year"), "2026");
assert.equal(field(result, "vehicle_engine_number"), "EN9G2695D01234");
assert.equal(field(result, "vehicle_chassis_number"), "MEC7TEST0TP106204");
assert.equal(field(result, "vehicle_make"), "BHARATBENZ");
assert.equal(field(result, "vehicle_model"), "5532");
assert.equal(field(result, "vehicle_capacity"), "55000");
assert.equal(field(result, "vehicle_rto_state"), "Rajasthan");
assert.equal(field(result, "vehicle_registration_number"), undefined);
assert.equal(field(result, "od_premium"), "41397");
assert.equal(field(result, "tp_premium"), "44667");
assert.equal(field(result, "cpa_premium"), "275");
assert.match(result.parserVersion, /new-india-enhanced-covers-live-residual-v3/);

console.log("New India Enhanced Covers exact live-shape regression passed.");
