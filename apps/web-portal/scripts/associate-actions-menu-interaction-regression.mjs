import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = new URL("../app/intermediaries/applications/[id]/associate-accounts/", import.meta.url);
const menu = readFileSync(fileURLToPath(new URL("associate-account-actions-menu.tsx", base)), "utf8");
const actions = readFileSync(fileURLToPath(new URL("actions.ts", base)), "utf8");

assert.match(menu, /event\.composedPath\(\)/, "Outside handling must include portal event path");
assert.match(menu, /document\.addEventListener\("pointerdown", closeOnOutsideClick\)/);
assert.match(menu, /withinTrigger && !withinMenu/, "Outside dismissal must check the actual portal menu");
assert.match(menu, /z-\[9999\] pointer-events-auto/, "Actions must stay above overlapping page UI");
assert.match(menu, /z-\[10000\]/, "Confirmation dialogs must be above the action menu");

for (const action of ["edit", "status", "delete"]) {
  assert.ok(
    menu.includes(`onClick={() => showDialog("${action}")}`),
    `Missing accessible click/keyboard activation: ${action}`
  );
}
assert.doesNotMatch(menu, /onPointerDown=\\{\\(event\\) => \\{/,
  "Dialog buttons should not unmount the menu during pointerdown");
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
