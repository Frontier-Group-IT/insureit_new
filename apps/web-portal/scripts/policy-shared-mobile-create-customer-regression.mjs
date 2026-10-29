import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const form=readFileSync("components/policy-unified-form.tsx","utf8");
const action=readFileSync("app/policies/policy-onboarding-actions.ts","utf8");
assert.match(form,/hasPhoneMatch\?setConfirmSharedPhone\(true\):onChoose\(null\)/,"Shared mobile must ask confirmation instead of hiding create option");
assert.match(form,/Create Separate Customer/);
assert.match(form,/createNewCustomer:!id/,"New customer intent must reach backend");
assert.match(action,/if \(createNewCustomer && exactCustomerMatches\.length\)/,"Exact identity duplicate safeguard must remain");
assert.match(action,/const createNewCustomer = payload\.resolution\?\.createNewCustomer === true/);
console.log("Shared-mobile new-customer confirmation regression passed");
