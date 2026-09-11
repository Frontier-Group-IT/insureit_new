import assert from "node:assert/strict";
// @ts-expect-error -- regression runs directly under Node with stripped TypeScript types.
import { refineTataAigStructuredLayout } from "../lib/policy-ocr-tata-aig-structured-refiner.ts";
import type { ParsedPolicyResult } from "../lib/policy-ocr-parsers.ts";
import type { StructuredPolicyTable } from "../lib/policy-ocr-iffco-structured-refiner.ts";

const pages = [
  `TATA AIG GENERAL INSURANCE COMPANY LIMITED
Bundled Auto Secure - Two Wheeler Policy (1 Year Term for Own Damage & 5 Years for Third Party)`,
  `Certificate of Insurance Cum Policy Schedule`,
  `Schedule of Premium`,
];

const tables: StructuredPolicyTable[] = [
  {
    page: 2,
    rows: [
      ["Registration No.", "NEW", "Body Type", "SCOOTER"],
      ["RTO Location", "BARAN", "Zone", "B"],
    ],
  },
  {
    page: 3,
    rows: [
      ["Total Own Damage Premium (A)", "₹ 1,976.83", "Basic TP Premium", "₹ 3,273.00"],
      ["Add: Depreciation Allowance (TA 16)", "₹ 589.75", "Compulsory Personal Accident Cover for Owner Driver ₹ 1,500,000", "₹ 375.00"],
      ["Add: Return to Invoice (TA 17)", "₹ 271.28", "Total Liability Premium (B)", "₹ 3,648.00"],
      ["Total Add-On Premium (C)", "₹ 1,639.41", "Net Premium (A+B+C)", "₹ 7,264.00"],
    ],
  },
];

const contaminated: ParsedPolicyResult = {
  parserId: "tata_aig_motor_v1",
  parserVersion: "tata_aig_tw_bundled_v1.0.0",
  warnings: ["TATA AIG OD/TP/CPA fields were withheld because the premium components did not reconcile to printed net premium."],
  fields: [
    { key: "cpa_premium", label: "CPA amount", value: "589.75", confidence: .99, page: 3, evidence: "flattened row contamination" },
    { key: "cpa_opted", label: "CPA opted", value: "Yes", confidence: .99, page: 3, evidence: "flattened row contamination" },
  ],
};

const refined = refineTataAigStructuredLayout(pages, tables, contaminated);
const field = (key: string) => refined.fields.find((item) => item.key === key)?.value;

assert.equal(field("vehicle_registration_status"), "registration_pending");
assert.equal(field("vehicle_registration_number"), undefined);
assert.equal(field("vehicle_rto_name"), "BARAN");
assert.equal(field("cpa_premium"), "375", "side-by-side TA16 value must not become CPA");
assert.equal(field("tp_premium"), "3273");
assert.equal(field("od_premium"), "3616.24");
assert.equal(field("cpa_opted"), "Yes");
assert.match(refined.parserVersion, /tata-structured-v1\.1/);

const derivedCpaTables: StructuredPolicyTable[] = [
  {
    page: 3,
    rows: [
      ["Total Own Damage Premium (A)", "1976.83"],
      ["Total Add-On Premium (C)", "1639.41"],
      ["Basic TP Premium", "3273.00"],
      ["Compulsory Personal Accident Cover for Owner Driver", "₹ 1,500,000"],
      ["Total Liability Premium (B)", "3648.00"],
      ["Net Premium (A+B+C)", "7264.00"],
    ],
  },
];
const derived = refineTataAigStructuredLayout(pages, derivedCpaTables, contaminated);
const derivedField = (key: string) => derived.fields.find((item) => item.key === key)?.value;
assert.equal(derivedField("cpa_premium"), "375", "CPA should safely derive from Total Liability - Basic TP when premium cell is unavailable");
assert.equal(derivedField("od_premium"), "3616.24");
assert.equal(derivedField("tp_premium"), "3273");

console.log("TATA AIG structured OCR regression passed: NEW registration, RTO, side-by-side premium table and CPA isolation.");
