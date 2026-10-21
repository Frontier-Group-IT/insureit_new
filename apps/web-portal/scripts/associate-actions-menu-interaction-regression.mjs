import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = new URL("../app/intermediaries/applications/[id]/associate-accounts/", import.meta.url);
const menu = readFileSync(fileURLToPath(new URL("associate-account-actions-menu.tsx", base)), "utf8");
const page = readFileSync(fileURLToPath(new URL("page.tsx", base)), "utf8");
const actions = readFileSync(fileURLToPath(new URL("actions.ts", base)), "utf8");

assert.match(menu, /event\.composedPath\(\)/, "Outside handling must include portal event path");
assert.match(menu, /document\.addEventListener\("pointerdown", closeOnOutsideClick\)/);
for (const action of ["edit", "status", "delete"]) {
  assert.ok(menu.includes(`onClick={() => showDialog("${action}")}`),
    `Missing completed-click action activation: ${action}`);
  assert.ok(!menu.includes(`if (event.button === 0) showDialog("${action}")`),
    `Premature pointerdown unmount could suppress click: ${action}`);
}
assert.doesNotMatch(menu, /onPointerUp=\{\(event\) => \{/,
  "Resend must not submit before native click completes");
assert.doesNotMatch(menu, /event\.currentTarget\.form\?\.requestSubmit\(\)/,
  "Resend must use its native form submission without duplicate requests");
assert.match(menu, /<form action=\{resendPartnerAssociateInvite\} onSubmit=/);
assert.match(menu, /associate-resend-cooldown/, "Resend cooldown must be recorded on submit");
assert.match(menu, /type="submit"/);
assert.match(menu, /withinTrigger && !withinMenu/, "Outside dismissal must check the actual portal menu");
assert.match(menu, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/, "Portal menu clicks must not bubble into page handlers");
assert.match(menu, /z-\[9999\] pointer-events-auto/, "Actions must stay above overlapping page UI");
assert.match(menu, /z-\[10000\]/, "Confirmation dialogs must be above the action menu");
console.log("Associate action menu interaction contract: OK");