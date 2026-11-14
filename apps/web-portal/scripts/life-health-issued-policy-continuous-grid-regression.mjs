import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/life-health-issued-policy-edit-form.tsx", import.meta.url), "utf8");
const section = source.match(/<Section number="04" title="Issued policy details">([\s\S]*?)<\/Section>/)?.[1];
assert.ok(section, "The issued policy details section must exist.");
const labels = ["Policy number", "Policy start date", "Policy end / maturity date", "PPT end date", "Next installment date", "Final premium", "Sum assured / insured", "Case premium amount", "Payment mode", "Remarks"];
let previous = -1;
for (const label of labels) {
  const position = section.indexOf(label);
  assert.ok(position > previous, `${label} must follow the preceding field without reordering`);
  previous = position;
}
// The second row is completed by Case Premium Amount after Sum Assured; the next row begins with Payment Mode and Remarks.
assert.doesNotMatch(section, /md:grid-cols-3 xl:col-span-4 xl:grid-cols-3/, "Do not nest premium fields inside a separate three-column row.");
assert.doesNotMatch(section, /xl:col-span-4|md:col-span-2|xl:grid-cols-4/, "Issued policy fields use the shared continuous section grid without explicit spans.");
const columnOrder = ["Next installment date", "Final premium", "Sum assured / insured", "Case premium amount", "Payment mode", "Remarks"];
let last = -1;
for (const label of columnOrder) {
  const index = section.indexOf(label);
  assert.ok(index > last, `${label} must appear in order in the shared four-column section grid.`);
  last = index;
}
assert.match(source, /function Section\(/, "Use the existing shared responsive Section grid.");
assert.match(source, /md:grid-cols-2 xl:grid-cols-4/, "Existing Section layout stays responsive.");
console.log("Life/Health issued policy continuous field grid regression passed.");
