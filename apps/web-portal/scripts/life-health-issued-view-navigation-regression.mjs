import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const button = read("../components/life-health-issued-policy-button.tsx");
const register = read("../components/life-health-case-register.tsx");
const detail = read("../components/life-health-case-detail.tsx");
const edit = read("../app/policies/[id]/edit/page.tsx");

assert.match(register, /<LifeHealthIssuedPolicyButton policyId=\{row\.finalPolicyId\}/, "Issued cases must pass the linked policy ID to the View control.");
assert.match(button, /policyId \}: \{ policyId: string \}/, "View popup must use the actual linked policy ID.");
assert.match(button, /href=\{\`\/policies\/\$\{encodeURIComponent\(policyId\)\}\/edit\`\}/, "View Policy must open the exact issued policy editor.");
assert.doesNotMatch(button, /<Link href="\/policies"/, "View Policy must not redirect to general Policy Register.");
assert.match(detail, /href=\{\`\/policies\/\$\{encodeURIComponent\(caseData\.finalPolicyId\)\}\/edit\`\}>View issued policy/, "Issued case read-only details must link to the exact issued policy editor.");
assert.match(edit, /requirePolicyEditor\(resolvedParams\.id\)/, "Editor authorization must remain enforced.");
assert.match(edit, /life_health_cases/, "Life and Health issued policies must retain the dedicated edit form.");
console.log("Issued Life/Health case View Policy direct editor regression passed.");
