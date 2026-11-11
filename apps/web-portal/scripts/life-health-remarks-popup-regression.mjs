import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const create = read("components/life-health-policy-form.tsx");
const detail = read("components/life-health-case-detail.tsx");
const editor = read("components/life-health-remarks-editor.tsx");
const register = read("components/life-health-case-register.tsx");
const registerPage = read("app/policies/life-health-cases/page.tsx");
const newAction = read("app/policies/life-health-policy-actions.ts");
const editAction = read("app/policies/life-health-case-edit-actions.ts");

assert.match(create, /<LifeHealthRemarksEditor value=\{form\.remarks\}/, "Create Case uses remarks popup");
assert.doesNotMatch(create, /<textarea value=\{form\.remarks\}/, "No inline remarks textarea in Create Case");
assert.match(detail, /<LifeHealthRemarksEditor value=\{form\.remarks\}/, "Case Details uses remarks popup");
assert.doesNotMatch(detail, /aria-expanded=\{remarksOpen\}/, "Remove duplicate legacy remarks accordion");
assert.match(editor, /role="dialog" aria-modal="true"/, "Accessible modal dialog");
assert.match(editor, /onChange\(draft\.trim\(\)\)/, "Modal Add Remark copies draft to form");
assert.match(editor, /\{value\}<\/p>/, "Committed remarks preview is visible in its column");
assert.match(editor, /setDraft\(value\); setOpen\(true\)/, "Open starts with saved input");
assert.match(editor, /setOpen\(false\)/, "Cancel dismisses without changing committed remarks");
assert.match(newAction, /remarks:remarks\|\|null/, "Create Case still persists remarks");
assert.match(editAction, /remarks: clean\(formData\.get\("remarks"\)\) \|\| null/, "Edit Case still persists remarks");
assert.match(registerPage, /lead_source,remarks,final_policy_id/, "Register loads authorized saved remarks");
assert.match(registerPage, /remarks: row\.remarks \|\| ""/, "Register mapping retains remarks");
assert.match(register, /<th className="px-3 py-3">Remarks<\/th>/, "Case Register includes remarks column");
assert.match(register, /setRemarksToView\(row\)/, "Case Register opens full remarks popup");
assert.match(register, /Edit in Case Details/, "Pending cases can edit saved remarks through existing form");
console.log("Life/Health remarks popup and Case Register regression passed");
