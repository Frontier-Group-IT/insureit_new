import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source=readFileSync(fileURLToPath(new URL("../app/intermediaries/applications/[id]/associate-accounts/associate-account-actions-menu.tsx",import.meta.url)),"utf8");
assert.match(source,/\{deleteOpen \? \(/);
assert.match(source,/<DeleteAssociateConfirmation/);
assert.match(source,/Permanently delete associate account\?/);
assert.match(source,/associateName/);
assert.match(source,/Protected business history may prevent deletion/);
assert.match(source,/dialog\.showModal\(\)/);\nassert.match(source,/<dialog/);
assert.match(source,/createPortal\(/);
assert.match(source,/<form action=\{deletePartnerAssociateAccount\}/);
assert.match(source,/\{hiddenFields\}/);
assert.match(source,/Delete permanently/);
assert.match(source,/onClick=\{onClose\}/);
console.log("Associate deletion confirmation regression passed");
