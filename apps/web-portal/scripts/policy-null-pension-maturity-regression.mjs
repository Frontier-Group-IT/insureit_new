import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
const workspace = read("../app/policies/policy-workspace.tsx");
const backoffice = read("../components/backoffice-policy-register.tsx");
const policiesPage = read("../app/policies/page.tsx");
const detailPage = read("../app/policies/[id]/page.tsx");
const caseRegister = read("../components/life-health-case-register.tsx");

for (const [name, source] of [["Policy workspace", workspace], ["Backoffice register", backoffice]]) {
  assert.match(source, /end_date: string \| null/, `${name} must treat end_date as nullable.`);
  assert.match(source, /if \(!endDate\) return "No fixed maturity"/, `${name} must give undated policies a neutral status.`);
  assert.match(source, /if \(!endDate\) return null/, `${name} must not assign a numeric expiry to undated policies.`);
  assert.match(source, /if \(Number\.isNaN\(end\.getTime\(\)\)\) return null/, `${name} must not turn invalid dates into today.`);
  assert.match(source, /"No fixed maturity date"/, `${name} must show a usable empty-date label.`);
  assert.match(source, /if \(days === null\)/, `${name} must handle unknown expiry duration.`);
  assert.match(source, /tone="slate">No fixed maturity/, `${name} must show a neutral status instead of Active or Due.`);
  assert.match(source, /if \(!value\) return "—"/, `${name} must never split a null date.`);
}
assert.match(workspace, /policy\.end_date \? formatDate\(policy\.end_date\) : "No fixed maturity date"/);
assert.match(backoffice, /row\.end_date \? date\(row\.end_date\) : "No fixed maturity date"/);
assert.equal((policiesPage.match(/end_date: string \| null/g) ?? []).length, 2, "Both policy API row shapes must accept nullable end dates.");
assert.match(detailPage, /end_date: string \| null/, "Policy detail types must match the database.");
assert.match(detailPage, /if \(!value\) return "—"/, "Policy detail date formatter must accept a missing date.");
assert.match(caseRegister, /row\.customerName/, "Case proposer search must remain available.");
console.log("Nullable pension maturity policy search and register regression passed.");
