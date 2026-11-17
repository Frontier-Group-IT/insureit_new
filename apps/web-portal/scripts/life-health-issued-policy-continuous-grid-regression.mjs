import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/life-health-issued-policy-edit-form.tsx", import.meta.url), "utf8");
const section = source.match(/<Section number="04" title="Issued policy details">([\s\S]*?)<\/Section>/)?.[1];
assert.ok(section, "The issued policy details section must exist.");
const labels = ["Policy number", "Policy start date", "Policy end / maturity date", "PPT end date", "Next installment date", "Final premium", "Sum assured / insured", "Case premium amount", "Payment mode"];
let previous = -1;
for (const label of labels) {
  const position = section.indexOf(label);
  assert.ok(position > previous, `${label} must follow the preceding field without reordering`);
  previous = position;
}
// Preserve the original issued-policy input order; Remarks lives in its separate collapsible tab.
assert.doesNotMatch(section, /md:grid-cols-3 xl:col-span-4 xl:grid-cols-3/, "Do not nest premium fields inside a separate three-column row.");
assert.doesNotMatch(section, /xl:col-span-4|md:col-span-2|xl:grid-cols-4/, "Issued policy fields use the shared continuous section grid without explicit spans.");
const columnOrder = ["Next installment date", "Final premium", "Sum assured / insured", "Case premium amount", "Payment mode"];
let last = -1;
for (const label of columnOrder) {
  const index = section.indexOf(label);
  assert.ok(index > last, `${label} must appear in order in the shared responsive section grid.`);
  last = index;
}
assert.match(source, /function Section\(/, "Use the existing shared responsive Section grid.");
assert.match(source, /className="grid gap-2\.5 p-3 md:grid-cols-2 xl:grid-cols-4"/, "Shared Section keeps a continuous grid with two medium and four wide-screen columns.");
assert.doesNotMatch(section, /<label[^>]*>Remarks/, "Remark popup belongs in the separate Activity Status / Remarks section.");
assert.match(source, /aria-label="Activity status and remarks"/, "Retain separate activity and remarks controls.");
console.log("Life/Health issued policy continuous field grid regression passed.");
