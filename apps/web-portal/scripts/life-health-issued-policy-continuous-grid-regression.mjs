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
// The final three fields are an explicitly requested Premium / Payment Mode / Remarks row.
const finalRow = section.match(/<div className="grid gap-3 md:col-span-2 md:grid-cols-3 xl:col-span-4 xl:grid-cols-3">([\s\S]*?)<\/div>\s*$/);
assert.ok(finalRow, "Only the final Premium / Payment Mode / Remarks group should span the section grid.");
for (const label of ["Case premium amount", "Payment mode", "Remarks"]) {
  assert.ok(finalRow[1].includes(label), `Final grouped row must contain ${label}.`);
}
const precedingFields = section.slice(0, section.indexOf('<div className="grid gap-3 md:col-span-2'));
assert.doesNotMatch(precedingFields, /xl:col-span-4|md:col-span-2/, "Earlier issued policy fields must retain the continuous four-column grid.");
assert.doesNotMatch(precedingFields, /xl:grid-cols-4/, "Do not add an extra grid around earlier issued policy fields.");
assert.match(source, /function Section\(/, "Use the existing shared responsive Section grid.");
assert.match(source, /md:grid-cols-2 xl:grid-cols-4/, "Existing Section layout stays responsive.");
console.log("Life/Health issued policy continuous field grid regression passed.");
