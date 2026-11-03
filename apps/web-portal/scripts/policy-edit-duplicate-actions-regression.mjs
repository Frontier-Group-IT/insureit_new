import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const unified = read("../components/policy-unified-form.tsx");
const footer = read("../components/policy-edit-action-footer.tsx");
const page = read("../app/policies/[id]/edit/policy-edit-standard.tsx");

assert.match(unified, /data-policy-edit-original-actions=\{isEdit \? "" : undefined\}/, "Only Edit Policy must mark its original action row.");
assert.match(footer, /\[data-policy-edit-form\] \[data-policy-edit-original-actions\] \{ display: none !important; \}/, "Original action row must be hidden on standard Edit Policy.");
assert.match(footer, /const original = findOriginalSaveButton\(\);[\s\S]*?original\.click\(\)/, "Bottom Save must still delegate to the actual form handler.");
assert.match(footer, /observer\.observe\(original/, "Loading and disabled state must remain synced from the actual form.");
assert.match(page, /<PolicyEditActionFooter \/>/, "Standard Edit Policy must keep the bottom action footer.");
assert.match(unified, /onClick=\{\(\)=>submitPolicy\(\)\}/, "The original validated save handler must remain intact through its approval-aware wrapper.");
console.log("Policy Edit single action-row regression passed.");
