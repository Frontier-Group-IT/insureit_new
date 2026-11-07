import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const finalDocuments = read("../components/final-documents/final-documents-workspace-v2.tsx");
const stages = read("../components/claim-manager/operations-claim-stages.tsx");

function dateInputBody(source, start) {
  const pos = source.indexOf(start);
  assert.ok(pos >= 0, "Date input component must be present");
  return source.slice(pos, source.indexOf("\n}", pos) + 2);
}
const dateField = dateInputBody(finalDocuments, "function DateField(");
const standardPicker = dateInputBody(stages, "function AppStyleDateInput(");
const svg = /<svg viewBox="0 0 24 24" aria-hidden="true"[^>]*><rect x="4" y="6" width="16" height="14" rx="2" \/><path d="M8 3v6M16 3v6M4 10h16" \/><\/svg>/;
assert.match(dateField, svg, "Claim Intimation must render the standard outlined calendar icon");
assert.match(standardPicker, svg, "Other Operations stages must retain the same calendar geometry");
assert.doesNotMatch(dateField, /▦/, "Remove font-dependent square calendar glyph");
assert.ok(finalDocuments.includes('<DateField label="Claim Intimation Date"'));
assert.ok(finalDocuments.includes('<DateField label="Gate-in Date"'));
assert.ok(dateField.includes('type="date" value={value} onChange={(event) => onChange(event.target.value)}'));
assert.ok(dateField.includes('onClick={(event) => event.currentTarget.showPicker?.()}'));
assert.ok(dateField.includes('aria-label={label}'));
assert.ok(dateField.includes('DD/MM/YYYY'));
assert.ok(dateField.includes('h-[34px] w-full'), 'Claim Intimation calendar field follows the approved 34px compact height');
console.log("Operations Claim Intimation calendar icon parity regression passed.");
