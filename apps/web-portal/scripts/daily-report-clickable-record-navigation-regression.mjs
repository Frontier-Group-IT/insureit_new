import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const routes=read("../lib/reports/daily-activity-record-routes.ts");
const loader=read("../lib/reports/daily-self-activity.ts");
const panel=read("../components/reports/daily-self-activity-panel.tsx");
const rows=read("../components/reports/daily-activity-history-rows.tsx");
const uuid="d939d183-6e23-47ce-8484-76cd4c1f0555";

for(const [table,base] of Object.entries({
  policies:"/policies",policy_intake_requests:"/policy-intakes",
  life_health_cases:"/policies/life-health-cases",
  customers:"/customers",vehicles:"/vehicles",claims:"/claims",
})) {
  assert.ok(routes.includes(`${table}: "${base}"`),`Canonical ${table} route is allowlisted`);
}
assert.match(routes, /isValidDailyRecordId\(recordId\)/, "Record ID must be a validated UUID");
assert.match(routes, /const base=DAILY_ACTIVITY_RECORD_ROUTES\[table\]/, "Unknown table names cannot become arbitrary paths");
assert.match(loader, /Object\.keys\(DAILY_ACTIVITY_RECORD_ROUTES\)\.map\(async table/, "Lookup only allowlisted tables");
assert.match(loader, /visible\s*\.filter\(row=>row\.table===table && isValidDailyRecordId\(row\.recordId\?\?""\)\)/, "Record checks are limited to visible rows with valid IDs");
assert.match(loader, /admin\.from\(table\)\.select\("id"\)\.in\("id",ids\)/, "Verify target exists in live database");
assert.match(loader, /if\(error\) return;/, "Failed existence lookup cannot create a link");
assert.match(loader, /existing\.has\(row\.recordId\)/, "Only surviving records receive a link");
assert.match(loader, /row\.href=dailyActivityRecordHref\(table,row\.recordId\)/, "Canonical route builder used");
for(const table of ["policies","policy_intake_requests","life_health_cases"]) {
  assert.ok(loader.includes(`table:"${table}",recordId:a.id`),`Keep immutable record ID for ${table} history`);
}
assert.match(panel, /<DailyActivityHistoryRows rows=\{data\.rows\} employeeName=\{data\.selfName\} \/>/, "All employee and Self reports use interactive rows");
assert.match(rows, /role="button" tabIndex=\{0\}/, "Rows support keyboard focus");
assert.match(rows, /event\.key==="Enter"\|\|event\.key===" "/, "Enter and Space activate rows");
assert.match(rows, /router\.push\(row\.href\)/, "Existing record navigates to its own page");
assert.match(rows, /role="alertdialog" aria-modal="true"/, "Unavailable record opens accessible popup");
assert.match(rows, /This record has been deleted\./, "Deleted record message is short");
assert.match(rows, /This record is no longer available\./, "Unavailable record message is short");
assert.match(rows, />OK<\/button>/, "Popup has OK dismissal");
assert.match(rows, /className="mt-3 flex items-center justify-between gap-3"/, "Message and OK button share a compact horizontal row");
assert.match(rows, /className="min-w-0 flex-1 text-\[12px\]/, "Message takes the remaining row width");
assert.match(rows, /className="shrink-0 min-w-\[64px\]/, "OK button stays beside the message");
assert.match(rows, /event\.key==="Escape"/, "Dialog allows Escape dismissal");
assert.doesNotMatch(loader+routes+panel+rows,/\.insert\(|\.update\(|\.upsert\(|\.delete\(/, "Navigation is read-only");
console.log("Daily Report clickable record navigation and unavailable-popup regression passed.");
