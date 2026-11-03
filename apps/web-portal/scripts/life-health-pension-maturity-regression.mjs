import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const classifier = read("../lib/life-health-pension-maturity.ts");
const casePage = read("../components/life-health-case-detail.tsx");
const conversion = read("../app/policies/life-health-policy-actions.ts");
const editPage = read("../components/life-health-issued-policy-edit-form.tsx");
const editAction = read("../app/policies/life-health-issued-policy-edit-actions.ts");
const migration = read("../../../supabase/migrations/20261103110000_life_pension_optional_policy_maturity.sql");

assert.match(classifier, /businessLine\?\.trim\(\)\.toLowerCase\(\) === "life"/, "Only Life products can qualify.");
assert.match(classifier, /pension/, "Pension product name must be checked.");
for (const [businessLine, productName, expected] of [
  ["Life", "Pension Plan", true], ["life", "Retirement Pension - Plus", true],
  ["Life", "Life Term Cover", false], ["Health", "Pension Plan", false],
  ["Life", "Pensioner Health", false],
]) {
  const actual = businessLine.trim().toLowerCase() === "life" && /\bpension\b/i.test(productName);
  assert.equal(actual, expected, `Pension classification failed for ${businessLine}/${productName}`);
}
assert.match(casePage, /pensionPlan\?"":expectedEnd/, "Pension case date must not be forcibly auto-filled.");
assert.match(casePage, /required=\{!pensionPlan\}/, "Case form must label non-pension maturity dates as required.");
assert.match(conversion, /isPensionLifePolicy\(caseRow\.business_line,caseRow\.product_name\)&&!endDate/, "Case conversion must validate actual stored policy classification.");
assert.match(conversion, /end_date:endDate\|\|null/, "Case conversion must write null, not a fake date.");
assert.match(editPage, /pensionPlan\?\[\]:\[form\.endDate\]/, "Policy editor completion must exclude pension maturity dates.");
assert.match(editAction, /!pensionPlan && !endDate/, "Non-pension edit must still require maturity dates.");
assert.match(editAction, /end_date: endDate \|\| null/, "Pension edit must allow clearing the date.");
assert.match(editAction, /policy_end_maturity_date: endDate \|\| null/, "Issued schedule metadata must match policy date.");
assert.match(migration, /ALTER COLUMN end_date DROP NOT NULL/i);
assert.match(migration, /ADD CONSTRAINT policies_end_date_required_except_life_pension/i);
assert.match(migration, /end_date IS NOT NULL/);
assert.match(migration, /policy_product/, "DB check must prevent unrelated policies from having null end dates.");
console.log("Life/Health pension-only optional maturity regression passed.");
