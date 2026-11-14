import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const form = readFileSync(new URL("../components/life-health-policy-form.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("../components/life-health-remarks-editor.tsx", import.meta.url), "utf8");
const action = readFileSync(new URL("../app/policies/life-health-policy-actions.ts", import.meta.url), "utf8");

const editorButtonTag = '<LifeHealthRemarksEditor mode="button" value={form.remarks} onChange={(value) => update("remarks", value)} disabled={isPending} />';
const editorDisplayTag = '<LifeHealthRemarksEditor mode="display" value={form.remarks} onChange={(value) => update("remarks", value)} />';
const premiumStart = form.indexOf('<Section number="04" title="Premium & payment" contentClassName="md:grid-cols-3">');
const footerIndex = form.indexOf('id="life-health-onboarding-footer"');
const remarksIndex = form.indexOf('id="life-health-onboarding-remarks"');
const actionIndex = form.indexOf('<div className="w-full min-w-0 self-stretch">{bottomSection}</div>');
assert(premiumStart > 0 && footerIndex > premiumStart && remarksIndex > footerIndex && actionIndex > remarksIndex, "Inline Premium row precedes conditional full-width Remarks preview and actions");
assert(form.slice(premiumStart,footerIndex).includes(editorButtonTag), "Add Remark control is the third Premium & payment column");
assert(form.slice(remarksIndex,actionIndex).includes(editorDisplayTag), "Full-width Remarks preview displays saved remarks without duplicate Add Remark control");
assert.equal(form.split(editorButtonTag).length - 1, 1, "Only one Add Remark trigger is rendered");
assert.equal(form.split(editorDisplayTag).length - 1, 1, "Only one read-only Remarks preview is rendered");
assert.match(form.slice(footerIndex, remarksIndex), /form\.remarks\.trim\(\) \?/, "Empty Remarks preview stays hidden");
assert.match(form.slice(remarksIndex-100,remarksIndex+200), /w-full min-w-0/, "Saved Remarks retain full-width styling");
assert.match(editor, /mode === "button"/, "Remarks trigger supports compact inline placement");
assert.match(editor, /mode === "display"/, "Read-only remarks preview supports separate placement");
assert.match(editor, /aria-label="Add Remark"/, "Add Remark button remains unchanged");
assert.match(editor, /aria-label="Added remarks"/, "Added remarks appear below the editor field");
assert.match(editor, /whitespace-pre-wrap break-words/, "Added remarks retain multiline readability");
assert.match(editor, /onChange\(previous \?/, "New remarks are appended, never replace existing draft remarks");
assert.match(action, /remarks:remarks\|\|null/, "Case creation still persists remarks");
console.log("Life/Health inline Add Remark and conditional full-width preview regression passed.");
