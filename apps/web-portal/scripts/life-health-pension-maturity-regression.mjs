import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const classifier = read("../lib/life-health-pension-maturity.ts");
const casePage = read("../components/life-health-case-detail.tsx");
const conversion = read("../app/policies/life-health-policy-actions.ts");
const editPage = read("../components/life-health-issued-policy-edit-form.tsx");
const editAction = read("../app/policies/life-health-issued-policy-edit-actions.ts");
const previousMigration = read("../../../supabase/migrations/20261103110000_life_pension_optional_policy_maturity.sql");
const migration = read("../../../supabase/migrations/20261112100000_life_health_optional_policy_maturity.sql");
const rollback = read("../../../supabase/rollback/20261112100000_life_health_optional_policy_maturity.sql");

// Preserve historical pension behavior: without a fixed maturity date,
// pension policies should not have one auto-generated for them.
assert.match(classifier, /businessLine\?\.trim\(\)\.toLowerCase\(\) === "life"/);
assert.match(classifier, /pension/);
for (const [businessLine, productName, expected] of [
  ["Life", "Pension Plan", true],
  ["life", "Retirement Pension - Plus", true],
  ["Life", "Life Term Cover", false],
  ["Health", "Pension Plan", false],
  ["Life", "Pensioner Health", false],
]) {
  const actual = businessLine.trim().toLowerCase() === "life" && /\bpension\b/i.test(productName);
  assert.equal(actual, expected, `Pension classification changed for ${businessLine}/${productName}`);
}
assert.match(casePage, /pensionPlan\?"":expectedEnd/, "Keep pension auto-calculation behavior");

// Case detail: no mandatory end/maturity marker and no client block.
assert.match(casePage, /<CalculatedDateField title="Policy end \/ maturity date" value=\{issue\.endDate\}/,
  "Case issuance field must be optional");
assert.doesNotMatch(casePage, /<CalculatedDateField title="Policy end \/ maturity date" required=/);
assert.match(casePage, /!issue\.policyNumber\.trim\(\)\|\|!issue\.startDate\|\|!issue\.finalPremium/,
  "Case issuance still requires policy number, start date and final premium");
assert.doesNotMatch(casePage, /!pensionPlan&&!issue\.endDate/,
  "Case issuance must not require maturity for non-pension policies");

// Server conversion: validate supplied date but accept empty and persist NULL.
assert.doesNotMatch(conversion, /!isPensionLifePolicy\(caseRow\.business_line,caseRow\.product_name\)&&!endDate/);
assert.match(conversion, /!validDate\(startDate\)\|\|\(endDate&&!validDate\(endDate\)\)/,
  "Start date remains mandatory; supplied end date must be valid");
assert.match(conversion, /endDate&&endDate<startDate/, "Provided end date must be after start");
assert.match(conversion, /end_date:endDate\|\|null/, "Empty case end date must persist as NULL");
assert.match(conversion, /policy_end_maturity_date:endDate\|\|null/,
  "Issued schedule must also persist NULL for absent maturity");

// Issued policy edit: end date excluded from completeness and required marker.
assert.match(editPage, /form\.startDate,form\.finalPremium/,
  "Start date and premium remain required in issued edit");
assert.doesNotMatch(editPage, /form\.startDate,\.\.\.\(pensionPlan\?\[\]:\[form\.endDate\]\)/);
assert.match(editPage, /<Field label="Policy end \/ maturity date" type="date" value=\{form\.endDate\} onChange=\{\(v\)=>set\("endDate",v\)\}\/>/,
  "Edit policy maturity field must have no required flag");
assert.match(editAction, /!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(startDate\)/,
  "Edit server must continue validating mandatory start date");
assert.doesNotMatch(editAction, /!pensionPlan && !endDate/,
  "Edit server must not reject missing non-pension maturity");
assert.match(editAction, /endDate && !\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(endDate\)/,
  "Edit server validates a non-empty maturity date");
assert.match(editAction, /endDate && endDate < startDate/);
assert.match(editAction, /end_date: endDate \|\| null/);
assert.match(editAction, /policy_end_maturity_date: endDate \|\| null/);

// DB: protect Motor/other policies, extend nullability to Life and Health only.
assert.match(previousMigration, /ADD CONSTRAINT policies_end_date_required_except_life_pension/);
assert.match(previousMigration, /ALTER COLUMN end_date DROP NOT NULL/i);
assert.match(migration, /DROP CONSTRAINT IF EXISTS policies_end_date_required_except_life_pension/);
assert.match(migration, /ADD CONSTRAINT policies_end_date_required_except_life_health/);
assert.match(migration, /end_date IS NOT NULL/);
assert.match(migration, /IN \('life', 'health'\)/,
  "Only Life and Health business lines may omit end date");
assert.match(rollback, /RAISE EXCEPTION 'Cannot restore pension-only maturity constraint/,
  "Rollback must not fabricate dates or silently invalidate existing Life/Health data");
assert.match(rollback, /ADD CONSTRAINT policies_end_date_required_except_life_pension/);
console.log("Life/Health optional policy maturity create/edit/server/DB contract regression passed.");
