import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { parsePolicyDocument } from "../lib/policy-ocr-parsers.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineNewIndiaCommercialPolicy } from "../lib/policy-ocr-new-india-refiner.ts";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineApprovedMotorPolicyLayout } from "../lib/policy-ocr-approved-layout-refiner.ts";

function field(result: ReturnType<typeof parsePolicyDocument>, key: string) {
  return result.fields.find((entry) => entry.key === key)?.value;
}

const pages = [
  `THE NEW INDIA ASSURANCE CO. LTD.
POLICY SCHEDULE CUM CERTIFICATE OF INSURANCE
Commercial Vehicle Package Policy - Enhanced Covers
POLICY DETAILS
Period of cover 12/09/2026 04:35:13 PM to 11/09/2027 11:59:59 PM
VEHICLE DETAILS
Geographical Area / Zone India/C
Year of manufacture
2026
Type of Commercial Vehicles A - Goods Carrying
Sub Type Other than 3 wheeler - Public Carrier
Chassis no./Engine no.
ENG9TEST001234
MEC7TEST0TP106204
Type of fuel Diesel
Gross Vehicle Weight (GVW) 55000
Make/Model SYNTHETIC MOTORS/5532
Registration no. RJ-45
Name of registration authority RAJASTHAN
INSURED DECLARED VALUE (Rs)
Vehicle Total Value
5558450 5558450`,
  `THE NEW INDIA ASSURANCE CO. LTD.
SCHEDULE OF PREMIUM
Compulsory PA Premium for Owner Driver 275
Total OD Premium (Rs) 41397 Total TP Premium (Rs) 44667
Net Premium (Rs) 86064
GST (Rs) 9740
Total Payable (Rs) 95804`,
];

const tables = [{
  page: 1,
  rows: [
    ["Geographical Area / Zone:", "India/C", "Year of manufacture:", "2026"],
    ["Type of Commercial Vehicles:", "A - Goods Carrying", "Sub Type:", "Other than 3 wheeler - Public Carrier"],
    ["Name of the Financier:", "SYNTHETIC FINANCE COMPANY", "Chassis no./Engine no.:", "ENG9TEST001234/MEC7TEST0TP106204"],
    ["Type of fuel:", "Diesel", "Gross Vehicle Weight (GVW):", "55000"],
    ["Make/Model:", "SYNTHETIC MOTORS/5532", "Registration no.", "RJ-45"],
    ["Name of registration authority:", "RAJASTHAN"],
  ],
}];

const base = parsePolicyDocument(pages);
assert.equal(base.parserId, "new_india_motor_v1");
const text = refineNewIndiaCommercialPolicy(pages, base);
const result = refineApprovedMotorPolicyLayout(pages, tables, text);

assert.equal(field(result, "vehicle_manufacturing_year"), "2026");
assert.equal(field(result, "vehicle_chassis_number"), "MEC7TEST0TP106204");
assert.equal(field(result, "vehicle_engine_number"), "ENG9TEST001234");
assert.equal(field(result, "vehicle_registration_number"), undefined);
assert.equal(field(result, "tp_premium"), "44667");
assert.equal(field(result, "od_premium"), "41397");
assert.match(result.parserVersion, /new-india-separated-vehicle-evidence-v5/);

const wrappedPages = [
  pages[0].replace(
    "Chassis no./Engine no.\nENG9TEST001234\nMEC7TEST0TP106204",
    "Chassis no./Engine no.: ENG9TEST001234/MEC7TEST\n0TP106204",
  ),
  pages[1],
];
const wrappedBase = parsePolicyDocument(wrappedPages);
const wrapped = refineApprovedMotorPolicyLayout(
  wrappedPages,
  [],
  refineNewIndiaCommercialPolicy(wrappedPages, wrappedBase),
);
assert.equal(field(wrapped, "vehicle_chassis_number"), "MEC7TEST0TP106204", "wrapped VIN after slash must remain chassis");
assert.equal(field(wrapped, "vehicle_engine_number"), "ENG9TEST001234", "engine-like identifier before slash must remain engine");

const ambiguousYearPages = [
  pages[0].replace("Year of manufacture\n2026", "Year of manufacture\n2025\nReference year 2026"),
  pages[1],
];
const ambiguousBase = parsePolicyDocument(ambiguousYearPages);
const ambiguous = refineApprovedMotorPolicyLayout(
  ambiguousYearPages,
  [],
  refineNewIndiaCommercialPolicy(ambiguousYearPages, ambiguousBase),
);
assert.notEqual(field(ambiguous, "vehicle_manufacturing_year"), "2025", "flat fallback must not guess when multiple years exist in Vehicle Details");

const structuredWinsBase = parsePolicyDocument(ambiguousYearPages);
const structuredWins = refineApprovedMotorPolicyLayout(
  ambiguousYearPages,
  tables,
  refineNewIndiaCommercialPolicy(ambiguousYearPages, structuredWinsBase),
);
assert.equal(field(structuredWins, "vehicle_manufacturing_year"), "2026", "explicit structured Year cell must override ambiguous flattened year evidence");

console.log("New India structured + flattened separated identifier regression passed.");
