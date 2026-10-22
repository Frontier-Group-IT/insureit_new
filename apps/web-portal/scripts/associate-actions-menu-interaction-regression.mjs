import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = new URL("../app/intermediaries/applications/[id]/associate-accounts/", import.meta.url);
const menu = readFileSync(fileURLToPath(new URL("associate-account-actions-menu.tsx", base)), "utf8");
const actions = readFileSync(fileURLToPath(new URL("actions.ts", base)), "utf8");

assert.ok(!menu.includes('MoreVertical'), "Three-dot button is removed");
assert.ok(!menu.includes('role="menu"'), "No dropdown menu remains");
assert.ok(!menu.includes('Close actions menu'), "No overlay backdrop remains");
assert.ok(!menu.includes('menuPosition'), "No floating positioning remains");
for (const action of ["edit", "status", "delete"]) {
  assert.ok(menu.includes(`onClick={() => showDialog("${action}")}`), `Direct ${action} click handler missing`);
}
for (const icon of ["Pencil", "Ban", "Send", "Trash2"]) {
  assert.ok(menu.includes(`<${icon} `), `Inline icon missing: ${icon}`);
assert.ok(menu.includes("<form action={resendPartnerAssociateInvite}"),
assert.ok(menu.includes("<form action={resendPartnerAssociateInvite}"), "Resend server action remains available");
assert.match(menu, /aria-label=\\{`Delete/, "Delete has accessible name");

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
