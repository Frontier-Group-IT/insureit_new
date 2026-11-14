import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const directory = read("../components/reports/daily-employee-directory.tsx");
const page = read("../app/reports/(workspace)/daily/page.tsx");
const filters = read("../components/reports/daily-report-quick-filters.tsx");

assert.match(directory, /Employee Activity Reports<\/h3>[\s\S]*?<DailyReportQuickFilters mode="directory" date="" employeeSearch=\{search\}/,
  "Employee search must be immediately after the directory heading");
assert.doesNotMatch(directory, /Select an authorized employee to view their activity summary and history/,
  "Remove the requested helper subtitle completely");
assert.match(directory, /grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5/,
  "Display five employee cards per row on desktop with responsive narrower layouts");
assert.match(directory, /filtered\.map\(p=>\(/, "Keep all authorized filtered employees");
assert.match(directory, /href=\{linkFor\(\{scope:"all",person:p\.id,employee:"",activity:"",page:"1",period:"all"\}\)\}/,
  "Employee history navigation retains verified id, scope and filters");
assert.match(directory, /\{filtered\.length\} employees/, "Keep count of filtered employees");
assert.match(directory, /No authorized employees match your search/, "Keep empty search feedback");
assert.match(page, /\{\(isSelf \|\| chosenPerson\) \? \(/,
  "Show date control for self and employee history but not duplicate directory search");
assert.match(page, /<DailyEmployeeDirectory people=\{employeeDirectory\.people\} search=\{query\.employee\?\?""\}/,
  "Keep current authorization filtered directory and search query");
assert.match(filters, /<span className="sr-only">Employee Search<\/span>/,
  "Search retains accessible label without occupying vertical header space");
assert.match(filters, /window\.setTimeout/, "Preserve debounced search behavior");
assert.match(filters, /router\.replace/, "Search retains URL-driven filtering");
assert.doesNotMatch(directory + page, /\.insert\(|\.upsert\(|\.delete\(|\.update\(/,
  "Presentation changes must stay read-only");
console.log("Daily Report header search and five-employee-per-row regression passed.");
