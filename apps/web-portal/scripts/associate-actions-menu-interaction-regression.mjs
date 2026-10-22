import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = new URL("../app/intermediaries/applications/[id]/associate-accounts/", import.meta.url);
const menu = readFileSync(fileURLToPath(new URL("associate-account-actions-menu.tsx", base)), "utf8");
const actions = readFileSync(fileURLToPath(new URL("actions.ts", base)), "utf8");

assert.match(menu, /role="menu"/, "Dropdown must preserve menu semantics");
assert.match(menu, /Close actions menu/, "Backdrop must dismiss menu");
assert.ok(menu.includes("z-[9999] pointer-events-auto"), "Dropdown must have click-receiving layer above backdrop");
assert.ok(menu.includes('onPointerDownCapture={() => trace("menu:pointerdown:capture")}'), "Trace hit-testing inside menu");
assert.ok(!menu.includes('document.addEventListener("pointerdown"'), "No competing document pointer dismissal");
assert.ok(!menu.includes("if (!dialog.open) dialog.showModal()"), "Dropdown must not depend on native modal effect");
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
