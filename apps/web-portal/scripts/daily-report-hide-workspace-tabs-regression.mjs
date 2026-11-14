import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const nav = read("../components/reports/report-workspace-navigation.tsx");
const layout = read("../app/reports/(workspace)/layout.tsx");
const daily = read("../app/reports/(workspace)/daily/page.tsx");

assert.match(nav, /if \(pathname === "\/reports\/daily" \|\| pathname\.startsWith\("\/reports\/daily\/"\)\) return null;/,
  "Daily Report and nested routes must hide Reporting Workspace tabs");
for (const label of ["Overview", "Business", "Portfolio", "Operations"]) {
  assert.match(nav, new RegExp('label: "' + label + '"'),
    "Existing Reporting Workspace tab " + label + " must remain available on its original pages");
}
assert.match(layout, /<ReportWorkspaceNavigation \/>/,
  "Workspace navigation is still rendered by the shared layout for non-Daily Report pages");
assert.match(daily, /Daily Report visibility/,
  "Daily Report keeps its independent Self / All selector");
assert.match(daily, />Self<\/Link>/);
assert.match(daily, />All<\/Link>/);
console.log("Daily Report hides all 4 workspace tabs without changing Reporting Workspace or Self/All.");
