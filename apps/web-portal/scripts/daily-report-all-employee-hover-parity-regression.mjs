import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const directory = read("../components/reports/daily-employee-directory.tsx");
const self = read("../components/reports/daily-self-activity-panel.tsx");

const sharedHover = [
  "hover:-translate-y-0.5",
  "hover:border-[#7ba7dc]",
  "hover:from-[#f5f9ff]",
  "hover:to-[#e9f2ff]",
  "hover:shadow-[0_5px_14px_rgba(23,54,93,0.13)]",
  "active:translate-y-0",
  "motion-reduce:transform-none",
  "motion-reduce:transition-none",
  "focus-visible:outline-[#315b9a]"
];
for (const style of sharedHover) {
  assert.ok(self.includes(style), "Self category card reference missing: " + style);
  assert.ok(directory.includes(style), "All employee cards should share Self hover effect: " + style);
}
assert.doesNotMatch(directory, /View history|<span aria-hidden="true">›<\/span>/,
  "Employee directory cards must not display View history text or arrow");
assert.match(directory, /href=\{linkFor\(\{scope:"all",person:p\.id,employee:"",activity:"",page:"1"\}\)\}/,
  "Entire employee card must remain linked to the authorized employee history");
assert.match(directory, /grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5/,
  "Retain five desktop employee cards per row");
assert.match(directory, /\{p\.full_name\|\|"Unnamed employee"\}/,
  "Employee name remains visible");
assert.match(directory, /\{p\.employee_code\}/,
  "Employee code remains visible");
console.log("Daily Report All employee cards retain navigation and match Self hover without View history footer.");
