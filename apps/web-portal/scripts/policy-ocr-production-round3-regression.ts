import assert from "node:assert/strict";
// @ts-expect-error -- raw Node regression intentionally imports TypeScript source.
import { refineProductionRound3Precision } from "../lib/policy-ocr-production-round3-precision-guard.ts";

function field(key: string, value: string) {
  return { key, label: key, value, confidence: 0.99, page: 1, evidence: "synthetic" };
}

const base = {
  parserId: "synthetic",
  extractionMethod: "synthetic",
  warnings: [] as string[],
  fields: [
    field("insurer_name", "Insurer"), field("policy_number", "P12345678"),
    field("od_premium", "999"), field("tp_premium", "888"), field("cpa_opted", "Yes"),
    field("cpa_premium", "100"), field("total_premium", "1987"), field("tax_amount", "357.66"),
    field("gross_premium", "2344.66"), field("vehicle_make", "Bad heading"),
    field("vehicle_model", "Bad model"), field("vehicle_fuel_type", "CNG"), field("vehicle_capacity", "5"),
  ],
};

const digit = refineProductionRound3Precision({ ...base, parserVersion: "digit+prod-r2-digit" });
const digitKeys = new Set(digit.fields.map((item) => item.key));
for (const key of ["od_premium","tp_premium","cpa_opted","cpa_premium","total_premium","tax_amount","gross_premium","vehicle_make","vehicle_model","vehicle_fuel_type","vehicle_capacity"]) {
  assert.equal(digitKeys.has(key), false, `Digit must withhold ${key}`);
}
assert.equal(digitKeys.has("policy_number"), true, "Digit must preserve stable identity fields");
assert.match(digit.parserVersion, /prod-r3-precision-digit/);

const iffco = refineProductionRound3Precision({ ...base, parserVersion: "iffco+prod-r2-iffco" });
const iffcoKeys = new Set(iffco.fields.map((item) => item.key));
for (const key of ["od_premium","tp_premium","cpa_premium","vehicle_make","vehicle_capacity"]) {
  assert.equal(iffcoKeys.has(key), false, `IFFCO must withhold ${key}`);
}
assert.equal(iffcoKeys.has("cpa_opted"), true, "IFFCO keeps the higher-precision CPA decision");
assert.equal(iffcoKeys.has("total_premium"), true, "IFFCO keeps printed net premium");
assert.match(iffco.parserVersion, /prod-r3-precision-iffco/);

const national = refineProductionRound3Precision({ ...base, parserVersion: "national+prod-r2-national" });
assert.deepEqual(national, { ...base, parserVersion: "national+prod-r2-national" }, "National must remain unchanged in Round 3");

const magma = refineProductionRound3Precision({ ...base, parserVersion: "magma+prod-r1-magma_pcp_package" });
assert.deepEqual(magma, { ...base, parserVersion: "magma+prod-r1-magma_pcp_package" }, "Magma must remain unchanged in Round 3");

console.log("Production OCR Round 3 precision regression passed.");
