import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = new URL("../app/intermediaries/applications/[id]/associate-accounts/", import.meta.url);
const menu = readFileSync(fileURLToPath(new URL("associate-account-actions-menu.tsx", base)), "utf8");
const actions = readFileSync(fileURLToPath(new URL("actions.ts", base)), "utf8");

assert.match(menu, /if \(!dialog.open\) dialog.showModal\(\)/, "Menu must open in native top layer");
assert.match(menu, /<dialog/, "Menu must use top-layer dialog");
assert.match(menu, /role="menu"/, "Menu choices retain accessible menu semantics");
assert.doesNotMatch(menu, /document\.addEventListener\("pointerdown"/, "No document-level outside pointerdown dismissal");
assert.match(menu, /onCancel=\{\(event\)/, "Escape dismisses menu");
for (const action of ["edit", "status", "delete"]) {
  assert.ok(
    menu.includes(`onClick={() => showDialog("${action}")}`),
    `Missing accessible click/keyboard activation: ${action}`
  );
}
assert.ok(!menu.includes('if (event.button === 0) showDialog('), "No pointer-first dialog activation");
assert.ok(!menu.includes("requestSubmit("),
  "Resend should use the native submit once, without manual requestSubmit");
assert.doesNotMatch(menu, /recordResendAttempt/,
  "Cooldown should only reflect confirmed server invitation timestamp");
assert.match(menu, /<form action=\{resendPartnerAssociateInvite\}>/,
  "Resend must preserve the existing server action form");
assert.match(menu, /type="submit"/);

for (const serverAction of [
  "updatePartnerAssociateAccount",
  "togglePartnerAssociateAccountStatus",
  "deletePartnerAssociateAccount",
  "resendPartnerAssociateInvite",
]) {
  assert.match(actions, new RegExp(`export async function ${serverAction}`),
    `Server action must remain present: ${serverAction}`);
}

console.log("Associate action menu click activation contract: OK");
