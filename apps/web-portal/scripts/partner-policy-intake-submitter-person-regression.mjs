import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route=readFileSync("app/api/partner/policy-intakes/route.ts","utf8");
const list=readFileSync("components/partner-portal/partner-policy-intake-list-client.tsx","utf8");
for(const key of ["partner_branch_login_links","portal_access_identities","partner_branch_profiles","partner_branches","contact_name","branchContactByProfile","submitted_by_profile_id","submitted_by_portal_account_id"])assert.ok(route.includes(key),key);
assert.match(route,/associatesResult\.data/);
assert.match(list,/row\.submitted_by_name/);
console.log("Partner Policy Intake submitter identity regression passed");
