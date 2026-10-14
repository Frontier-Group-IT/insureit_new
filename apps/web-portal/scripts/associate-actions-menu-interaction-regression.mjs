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
  assert.ok(
    menu.includes(`if (event.button === 0) showDialog("${action}")`),
    `Missing pointer-first dialog activation: ${action}`
  );
  assert.ok(menu.includes(`onClick={() => showDialog("${action}")}`),
    `Missing keyboard click fallback: ${action}`);
}
assert.match(menu, /onPointerUp=\{\(event\) => \{/);
assert.ok(menu.includes("event.currentTarget.form?.requestSubmit()"),
  "Resend must submit the existing form");
console.log("Associate action menu interaction contract: OK");