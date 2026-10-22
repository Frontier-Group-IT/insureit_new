import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = new URL("../app/intermediaries/applications/[id]/associate-accounts/", import.meta.url);
const menu = readFileSync(fileURLToPath(new URL("associate-account-actions-menu.tsx", base)), "utf8");
const actions = readFileSync(fileURLToPath(new URL("actions.ts", base)), "utf8");

assert.ok(!menu.includes("MoreVertical"), "Three-dot button removed");
assert.ok(!menu.includes('role="menu"'), "Dropdown removed");
assert.ok(!menu.includes("menuPosition"), "Floating menu placement removed");
assert.ok(!menu.includes("Close actions menu"), "Backdrop removed");
for (const action of ["edit", "status", "delete"]) {
  assert.ok(menu.includes('onClick={() => showDialog("' + action + '")}'), action + " direct handler missing");
}
for (const icon of ["Pencil", "Ban", "Send", "Trash2"]) {
  assert.ok(menu.includes("<" + icon + " "), icon + " missing");
}
assert.ok(menu.includes("<form action={resendPartnerAssociateInvite}"), "Resend form must remain");
assert.ok(menu.includes('aria-label={`Edit'), "Edit requires accessible label");
assert.ok(menu.includes('aria-label={`Delete'), "Delete requires accessible label");
for (const fn of [
  "updatePartnerAssociateAccount",
  "togglePartnerAssociateAccountStatus",
  "deletePartnerAssociateAccount",
  "resendPartnerAssociateInvite",
]) {
  assert.ok(actions.includes("export async function " + fn), fn + " must remain available");
}
console.log("Inline associate action contract passed");
