import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "../components/policy-ocr-import-panel.tsx"), "utf8");

const checks = [
  ["Section 02 field contract", /const SECTION_02_FIELDS = new Set\(\[[\s\S]*vehicle_registration_number[\s\S]*vehicle_chassis_number[\s\S]*vehicle_engine_number/],
  ["Section 03 field contract", /const SECTION_03_FIELDS = new Set\(\[[\s\S]*policy_product[\s\S]*idv[\s\S]*od_premium[\s\S]*tp_premium[\s\S]*policy_end_date/],
  ["CPA opted remains verification-only", /const VERIFICATION_FIELDS = new Set\(\["cpa_opted"/],
  ["Current-vs-extracted review", /Current<\/span>[\s\S]*Extracted<\/span>[\s\S]*Status<\/span>/],
  ["Conflicts are explicit", /reviewState: protectedField \? "protected" : conflict \? "conflict"/],
  ["Protected disabled controls are not written", /if\(!value\|\|control\.disabled\)return false/],
  ["Dependency-aware apply order", /"vehicle_registration_status"[\s\S]*"vehicle_class"[\s\S]*"vehicle_capacity"[\s\S]*"policy_product"[\s\S]*"policy_start_date"[\s\S]*"policy_end_date"/],
  ["Separate Section 02 review group", /number="02" title="Vehicle identification"/],
  ["Separate Section 03 review group", /number="03" title="Policy, premium & validity"/],
  ["Verification totals are not copied", /Policy totals & CPA evidence[\s\S]*Comparison only/],
];

for (const [name, pattern] of checks) {
  if (!pattern.test(source)) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

if (/control\.disabled = false/.test(source)) {
  throw new Error("FAIL: importer must never temporarily enable protected controls");
}

console.log(`Policy OCR onboarding import regression: ${checks.length}/${checks.length} checks passed.`);
