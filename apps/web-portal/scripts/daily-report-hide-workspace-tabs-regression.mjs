import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const nav = read("../components/reports/report-workspace-navigation.tsx");
const layout = read("../app/reports/(workspace)/layout.tsx");
const header = read("../components/reports/daily-report-header-controls.tsx");

assert.match(nav, /if \(pathname === "\/reports\/daily" \|\| pathname\.startsWith\("\/reports\/daily\/"\)\) return null;/,
  "Daily Report and nested routes must hide Reporting Workspace tabs");
for (const label of ["Overview", "Business", "Portfolio", "Operations"]) {
  assert.match(nav, new RegExp('label: "' + label + '"'),
    "Existing Reporting Workspace tab " + label + " must remain available on its original pages");
}
assert.match(layout, /<ReportWorkspaceNavigation \/>/,
  "Workspace navigation is still rendered by the shared layout for non-Daily Report pages");
assert.match(header, /Daily Report visibility/,
  "Daily Report keeps its independent Self / All selector");
assert.match(header, /item==="self"\?"Self":"All"/);
assert.match(layout, /<DailyReportHeaderScopes \/>/);
console.log("Daily Report hides all 4 workspace tabs without changing Reporting Workspace or Self/All.");
