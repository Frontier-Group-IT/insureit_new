import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = new URL("../app/intermediaries/applications/[id]/associate-accounts/", import.meta.url);
const menu = readFileSync(fileURLToPath(new URL("associate-account-actions-menu.tsx", base)), "utf8");
const page = readFileSync(fileURLToPath(new URL("page.tsx", base)), "utf8");
const actions = readFileSync(fileURLToPath(new URL("actions.ts", base)), "utf8");

assert.match(menu, /event\.composedPath\(\)/, "Outside handling must include portal event path");
assert.match(menu, /document\.addEventListener\("pointerdown", closeOnOutsideClick\)/);
assert.match(menu, /onPointerDown=\{\(event\) => \{[\s\S]*?event\.stopPropagation\(\)/);
for (const action of [
  "updatePartnerAssociateAccount",
  "togglePartnerAssociateAccountStatus",
  "deletePartnerAssociateAccount",
  "resendPartnerAssociateInvite",
]) {
  assert.ok(menu.includes(action), `Missing associate action: ${action}`);
  assert.ok(actions.includes(`export async function ${action}`), `Missing server action: ${action}`);
}
for (const name of ["setEditOpen(true)", "setStatusOpen(true)", "setDeleteOpen(true)"]) {
  assert.ok(menu.includes(name), `Missing dialog transition: ${name}`);
}
assert.ok(page.includes("canManageAssociates ? ("), "Edit permission gate must remain");
assert.match(menu, /onPointerDown=\\{\\(event\\) => \\{[\\s\\S]*?showDialog\\("edit"\\)/);
assert.match(menu, /onPointerDown=\\{\\(event\\) => \\{[\\s\\S]*?showDialog\\("status"\\)/);
assert.match(menu, /onPointerDown=\\{\\(event\\) => \\{[\\s\\S]*?showDialog\\("delete"\\)/);
assert.match(menu, /onPointerUp=\\{\\(event\\) => \\{[\\s\\S]*?requestSubmit\\(\\)/);
console.log("Associate action menu interaction contract: OK");
