import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/customers/applications/intermediary-edit-actions.ts",import.meta.url),"utf8");
assert.match(source,/!validName\(dpFirst\)\|\|!validName\(dpLast\)/);
assert.match(source,/redirectField\(applicationId,!validName\(dpLast\)\?"dp_last_name"/);
assert.match(source,/if\(!storedExternalId\)redirectField\(applicationId,"external_onboarding_id",true\)/);
console.log("Intermediary primary validation parity checks passed");
