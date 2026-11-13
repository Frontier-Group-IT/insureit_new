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
assert.doesNotMatch(section, /xl:col-span-4|md:col-span-2/, "Issued policy fields must not be forced to a new full-width grid row.");
assert.doesNotMatch(section, /xl:grid-cols-4/, "The inner four-column grid must not wrap remaining fields.");
assert.match(source, /function Section\(/, "Use the existing shared responsive Section grid.");
assert.match(source, /md:grid-cols-2 xl:grid-cols-4/, "Existing Section layout stays responsive.");
console.log("Life/Health issued policy continuous field grid regression passed.");
