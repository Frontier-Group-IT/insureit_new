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
    menu.includes(`if (event.button === 0) showDialog("${action}")`),
    `Missing pointer-first dialog activation: ${action}`
  );
  assert.ok(
    menu.includes(`onClick={() => showDialog("${action}")}`),
    `Missing keyboard/click fallback: ${action}`
  );
}

assert.match(menu, /onPointerUp=\{\(event\) => \{/,
  "Resend must have pointer completion handling");
assert.ok(
  menu.includes("event.currentTarget.form?.requestSubmit()"),
  "Resend must explicitly submit its existing form after a valid pointer activation"
);
assert.match(menu, /submittedByPointerRef/, "Resend must de-duplicate the following click");
assert.match(menu, /recordResendAttempt/, "Resend cooldown must be recorded once");
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

console.log("Associate action menu pointer activation contract: OK");
