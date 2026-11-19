import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page = readFileSync(new URL("../app/policies/page.tsx", import.meta.url), "utf8");
const resolver = readFileSync(new URL("../lib/rm-partner-hierarchy.ts", import.meta.url), "utf8");
const ui = readFileSync(new URL("../app/policies/policy-workspace.tsx", import.meta.url), "utf8");
assert.match(resolver, /from\("partner_branch_policy_links"\)/);
assert.match(page, /resolveRmPartnerPolicyAttribution\(rows\.map/);
assert.match(resolver, /branchParents\.get\(link\.branch_id\) === link\.parent_partner_id/);
assert.match(page, /parentByPolicy\.get\(policy\.id\)\?\.code/);
assert.match(page, /intermediary_code: sourceCode/);
assert.match(page, /branch_source_code: attribution\?\.branchCode/);
assert.match(ui, /branch_source_code\?: string \| null/);
assert.match(ui, /Branch \$\{policy\.branch_source_code\}/);
assert.doesNotMatch(page, /\.from\("policies"\)\.update\(/);
// Life/Health have no vehicle requirement. Risk / Asset must show policy number
// on both desktop and mobile, without changing Motor and Non Motor display.
assert.match(ui, /businessLine === "life" \|\| businessLine === "health"\) return policy\.policy_no\?\.trim\(\)/);
assert.match(ui, /businessLine !== "non motor"\) return policy\.vehicles\?\.vehicle_no\?\.trim\(\) \|\| "Vehicle not linked"/);
assert.match(ui, /detail\?\.risk_title/);
assert.match(ui, /<RiskAssetCell policy=\{policy\}/);
assert.match(ui, /\{riskAssetPrimary\(policy\)\}/);
console.log("Operations Partner/Branch policy register attribution contract passed.");
