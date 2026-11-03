import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const enhancement = read("../components/portal-route-enhancements.tsx");
const branchOnboarding = read("../app/intermediaries/groups/branches/new/page.tsx");
const loginAccess = read("../app/intermediaries/groups/login-access/page.tsx");
const groups = read("../app/intermediaries/groups/business-group-workspace.tsx");
const associate = read("../app/intermediaries/applications/[id]/associate-accounts/page.tsx");

assert.match(enhancement, /hasPageSpecificBranchError = searchParams\.has\("error"\)/, "Suppress only branch error popups, not success feedback.");
for (const path of ["/intermediaries/groups/branches/new", "/intermediaries/groups/login-access", "/intermediaries/groups"]) {
  assert.ok(enhancement.includes('pathname === "' + path + '"'), `Branch route ${path} must be covered.`);
}
assert.match(enhancement, /!hasPageSpecificAssociateError && !hasPageSpecificBranchError/, "Keep existing Associate Accounts popup isolation and additional Branch isolation.");
assert.match(branchOnboarding, /query\.error/, "Branch onboarding inline error must remain.");
assert.match(loginAccess, /query\.error \? <Notice tone="error">/, "Branch login-access inline error must remain.");
assert.match(groups, /error \? <Notice tone="error"/, "Group/Branch workspace inline error must remain.");
assert.match(associate, /<AssociateAccountResultToast/, "Associate Accounts dialog must remain untouched.");
console.log("Branch management duplicate error popup isolation regression passed.");
