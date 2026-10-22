import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = new URL("../app/intermediaries/applications/[id]/associate-accounts/", import.meta.url);
const source = readFileSync(fileURLToPath(new URL("associate-account-actions-menu.tsx", base)), "utf8");
const actions = readFileSync(fileURLToPath(new URL("actions.ts", base)), "utf8");

assert.match(source, /role="group"/, "Actions must render directly in the register row");
assert.doesNotMatch(source, /MoreVertical|role="menu"|Close actions menu|setMenuPosition|menuPosition|pointerdown:capture/,
  "Old three-dot dropdown, portal menu, and positioning logic must be gone");
for (const action of ["edit", "status", "delete"]) {
  assert.ok(source.includes(`onClick={() => showDialog("${action}")}`), `Missing direct button for ${action}`);
}
for (const action of ["Edit", "Enable", "Disable", "Delete"]) {
  assert.ok(source.includes(action), `Missing expected label ${action}`);
}
assert.match(source, /iconOnly associateName=\{associate.name\}/);
assert.ok(source.includes("<form action={resendPartnerAssociateInvite}"), "Resend must use existing server action");
for (const serverAction of [
  "updatePartnerAssociateAccount", "togglePartnerAssociateAccountStatus",
  "deletePartnerAssociateAccount", "resendPartnerAssociateInvite",
]) {
  assert.ok(actions.includes(`export async function ${serverAction}`), `Missing server action ${serverAction}`);
}
console.log("Associate inline action contract passed");
