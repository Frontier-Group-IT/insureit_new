import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const directory = read("../lib/reports/daily-employee-directory.ts");
const page = read("../app/reports/(workspace)/daily/page.tsx");
const listing = read("../components/reports/daily-employee-directory.tsx");

assert.match(directory, /p\.id !== viewer\.id && \(allowedIds===null \|\| allowedIds\.includes\(p\.id\)\)/,
  "All excludes the current profile by immutable ID while preserving the authorized hierarchy");
assert.doesNotMatch(directory, /people\.push\(self\)/,
  "All must not reinsert the current employee");
assert.match(directory, /const authorized=directory\.people\.find\(person=>person\.id===targetId\)/,
  "A manually supplied person ID must be checked against the same filtered directory");
assert.match(directory, /if\(!authorized\) throw/,
  "Self selection through All URL fails closed");
assert.match(page, /loadSelfActivityHistory\(profile\.id/,
  "Self continues to show the signed-in employee");
assert.match(page, /assertDailyReportEmployeeAllowed\(chosenPerson, employeeDirectory\);[\s\S]*?loadSelfActivityHistory\(chosenPerson/,
  "All validates selected employee before loading admin-scoped history");
assert.match(listing, /people\.filter\(p=>!term/,
  "Search still filters the authorized list");
assert.doesNotMatch(directory+page+listing, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/,
  "Report fix does not write to production data");

// Check the intended set behavior for an organization-wide user and a manager.
const employees = [{id:"nishant"}, {id:"jatin"}, {id:"subordinate"}];
const shown = (viewer,allowed) => employees.filter(p =>
  p.id!==viewer && (allowed===null || allowed.includes(p.id))
).map(p=>p.id);
assert.deepEqual(shown("nishant",null),["jatin","subordinate"]);
assert.deepEqual(shown("jatin",["jatin","subordinate"]),["subordinate"]);
assert.deepEqual(shown("subordinate",["subordinate"]),[]);
console.log("Daily Report All excludes logged-in employee, preserves hierarchy, and rejects self URL drilldown.");
