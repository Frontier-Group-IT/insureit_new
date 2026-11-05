import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePolicyIdentifier, normalizePolicyIdentifierFields } from "../lib/policy-identifier-normalization.ts";

const form = readFileSync(new URL("../components/policy-unified-form.tsx", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../../../.github/workflows/verify-web-portal.yml", import.meta.url), "utf8");

for (const [value, expected] of [
  ["ABC 123 456", "ABC123456"],
  ["MA1 2AB 3456", "MA12AB3456"],
  ["6201962526 02 00", "62019625260200"],
  ["eng\t123\n45", "ENG12345"],
  [" ab-12 / 34 ", "AB-12/34"],
  ["", ""],
]) assert.equal(normalizePolicyIdentifier(value), expected);
assert.deepEqual(normalizePolicyIdentifierFields({policyNo:"abc 123",chassisNo:"ma1 2ab",engineNo:"eng 01",other:"Keep spaces"}), {policyNo:"ABC123",chassisNo:"MA12AB",engineNo:"ENG01",other:"Keep spaces"});
assert.match(form, /key==="policyNo"\|\|key==="chassisNo"\|\|key==="engineNo"/, "Change handler must clean all three fields");
assert.match(form, /typeof value==="string"\?normalizePolicyIdentifier\(value\):value/, "Typing/paste must clean immediately");
for(const key of ["policyNo","chassisNo","engineNo"]) assert.ok(form.includes('onChange={e=>update("'+key+'",e.target.value)}'), key+" must use the shared handler");
for(const key of ["policyNo","chassisNo","engineNo"]) assert.ok(form.includes(key+': normalizePolicyIdentifier(values?.'+key+' ?? "")'), key+" initial value must clean");
assert.match(form, /setForm\(normalizePolicyIdentifierFields\(\{/, "Saved drafts must clean");
assert.match(form, /chassisNo:normalizePolicyIdentifier\(applyGroups\.technical/, "RC chassis must clean");
assert.match(form, /engineNo:normalizePolicyIdentifier\(applyGroups\.technical/, "RC engine must clean");
assert.match(form, /chassisNo:normalizePolicyIdentifier\(selected\.chassisNo\)/, "Existing vehicle chassis must clean");
assert.match(form, /engineNo:normalizePolicyIdentifier\(selected\.engineNo\)/, "Existing vehicle engine must clean");
assert.match(form, /setForm\(current=>normalizePolicyIdentifierFields\(\{\.\.\.current,\.\.\.result\.next\}\)\)/, "OCR import must clean");
assert.ok(workflow.includes("node --experimental-strip-types scripts/policy-identifier-normalization-regression.mjs"), "CI must run regression");
console.log("Policy identifier whitespace normalization regression passed.");
