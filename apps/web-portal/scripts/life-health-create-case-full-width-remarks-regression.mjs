import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const form = readFileSync(new URL("../components/life-health-policy-form.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("../components/life-health-remarks-editor.tsx", import.meta.url), "utf8");
const action = readFileSync(new URL("../app/policies/life-health-policy-actions.ts", import.meta.url), "utf8");

const editorTag = '<LifeHealthRemarksEditor value={form.remarks} onChange={(value) => update("remarks", value)} disabled={isPending} />';
const remarksIndex = form.indexOf('id="life-health-onboarding-remarks"');
const actionIndex = form.indexOf('<div className="w-full min-w-0 self-stretch">{bottomSection}</div>');
const footerIndex = form.indexOf('id="life-health-onboarding-footer"');
assert(footerIndex > 0 && footerIndex < remarksIndex && remarksIndex < actionIndex, "Remarks must be the first block inside the shared full-width footer");
assert.match(form.slice(footerIndex, remarksIndex), /flex w-full min-w-0 flex-col gap-3/, "Footer stacks both blocks full width");
assert.match(form.slice(remarksIndex, actionIndex), /self-stretch/, "Remarks stretches to the same width as the actions");
assert(remarksIndex > 0 && actionIndex > remarksIndex, "Full-width Remarks section must be directly above the final action area");
assert(form.slice(remarksIndex, actionIndex).includes(editorTag), "Existing remarks editor and form binding are preserved");
assert.equal(form.split(editorTag).length - 1, 1, "Remarks editor is rendered only once");
assert.match(form.slice(remarksIndex - 100, remarksIndex + 200), /w-full min-w-0/, "Remarks section occupies full width");
assert.doesNotMatch(form.slice(form.indexOf('<Section number="04" title="Premium & payment"'), remarksIndex), /LifeHealthRemarksEditor/, "Remarks are removed from Premium & payment");
assert.match(editor, /justify-between gap-2/, "The Remarks status and Add Remark button retain their positions");
assert.match(editor, /aria-label="Add Remark"/, "Add Remark button remains unchanged");
assert.match(editor, /aria-label="Added remarks"/, "Added remarks appear below the editor field");
assert.match(editor, /whitespace-pre-wrap break-words/, "Added remarks retain multiline readability");
assert.match(editor, /onChange\(previous \?/, "New remarks are appended, never replace existing draft remarks");
assert.match(action, /remarks:remarks\|\|null/, "Case creation still persists remarks");
console.log("Life/Health Create Case full-width remarks layout and appended preview regression passed.");
