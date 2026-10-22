import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../app/intermediaries/applications/[id]/associate-accounts");
const menu = readFileSync(resolve(root, "associate-account-actions-menu.tsx"), "utf8");
const actions = readFileSync(resolve(root, "actions.ts"), "utf8");
const page = readFileSync(resolve(root, "page.tsx"), "utf8");

for (const [label, dialog] of [["Edit", "edit"], ["Disable", "status"], ["Delete", "delete"]]) {
  assert.match(menu, new RegExp('onClick=\\{\\(\\) => showDialog\\("'+dialog+'"\\)\\}'), label + " should open its dialog from a click");
}
assert.ok(!menu.includes('if (event.button === 0) showDialog('), "Do not open action dialogs during pointerdown");
assert.doesNotMatch(menu, /requestSubmit\(/, "Do not manually submit resend invitation twice");
assert.doesNotMatch(menu, /associate-resend-cooldown:/, "Do not store an optimistic cooldown for failed email requests");
assert.match(menu, /<form action=\{resendPartnerAssociateInvite\}/);
assert.match(menu, /<form action=\{updatePartnerAssociateAccount\}>/);
assert.match(menu, /<form action=\{togglePartnerAssociateAccountStatus\}>/);
assert.match(menu, /<form action=\{deletePartnerAssociateAccount\}/);
assert.match(actions, /await assertPartnerAccess\(reviewer, applicationId, intermediaryId, returnPath\)/);
assert.match(page, /canManageAssociates \? \(/);
console.log("Associate account action wiring and access guard regression checks passed.");
