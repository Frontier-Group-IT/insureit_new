import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const routes=read("../lib/reports/daily-activity-record-routes.ts");
const loader=read("../lib/reports/daily-self-activity.ts");
const panel=read("../components/reports/daily-self-activity-panel.tsx");
const rows=read("../components/reports/daily-activity-history-rows.tsx");
const deleteAction=read("../app/master-record-delete-actions.ts");
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
assert.match(panel, /<DailyActivityHistoryRows rows=\{data\.rows\} isCustomerActivity=\{isCustomerActivity\} isClaimActivity=\{isClaimActivity\} isOtherActivity=\{isOtherActivity\} \/>/, "All employee and Self reports use interactive rows with customer-specific context");
assert.match(rows, /role="button" tabIndex=\{0\}/, "Rows support keyboard focus");
assert.match(rows, /event\.key==="Enter"\|\|event\.key===" "/, "Enter and Space activate rows");
assert.match(rows, /row\.detail \? <span/, "Preserve latest audit field-level change details");
assert.doesNotMatch(rows, /\{row\.source\}/, "Never render Audit or Record history source text in any row");
assert.match(loader, /delete_claim:"Claim deleted \(creator unavailable\)"/, "Deleted claims never display the generic Delete Claim title");
assert.match(loader, /deletedClaimActivity\(change\.old_data\)/, "Creator comes from preserved claim audit metadata");
assert.match(loader, /claim_created_by_name/, "Creator field must be read from audited claim metadata");
assert.match(loader, /creator unavailable/, "Older deleted claims cannot be assigned guessed names");
assert.match(deleteAction, /\.from\("claims"\)[\s\S]*?\.select\("id,claim_no,created_by"\)/, "Read claim identity before permanently deleting it");
assert.match(deleteAction, /\.from\("profiles"\)[\s\S]*?\.select\("full_name"\)/, "Resolve the original claim creator, not the person deleting it");
assert.match(deleteAction, /claim_created_by_name: deletedClaimIdentity\?\.claim_created_by_name/, "Save creator name into deletion audit");
assert.ok(deleteAction.indexOf('deletedClaimIdentity = {claim_no:') < deleteAction.indexOf('.from("audit_logs").insert'), "Audit uses captured pre-delete identity");

assert.ok(rows.includes('role="dialog" aria-modal="true"'), "Entire row opens accessible activity details dialog");
assert.ok(rows.includes('onClick={event=>openRecord(row,event.currentTarget)}'), "Clicking row opens details");
assert.ok(rows.includes('router.push(selected.href!)'), "Optional Open record action navigates to canonical page");
assert.ok(rows.includes('event.key==="Escape"'), "Dialog allows Escape dismissal");
assert.ok(rows.includes('selected.detail||"Not recorded"'), "Only recorded audit details shown");
assert.ok(panel.includes('Policy / Case No.'), "Register shows policy or case reference");
assert.ok(panel.includes('Customer / Vehicle'), "Register shows customer and vehicle context");
assert.ok(panel.includes('Insurance Company'), "Register shows insurer");
assert.ok(!panel.includes('Performed By')&&!panel.includes('View Details'), "No performer or details-action column");
assert.ok(loader.includes('admin.from("insurance_companies")'), "Insurer linked to actual company");
assert.ok(loader.includes('admin.from("customers")'), "Customer linked to actual customer");
assert.ok(loader.includes('admin.from("vehicles")'), "Vehicle linked to actual vehicle");
assert.doesNotMatch(loader+routes+panel+rows,/\.insert\(|\.update\(|\.upsert\(|\.delete\(/, "Navigation is read-only");
console.log("Daily Report activity detail dialog and six-column context regression passed.");

assert.match(panel, /const isCustomerActivity=data\.category\.startsWith\("Customer "\)/, "Customer category switches to register-aligned columns");
for(const column of ["Customer", "Customer Type", "Mobile"]) {
  assert.ok(panel.includes(`>${column}</th>`), `Customer-specific column is visible: ${column}`);
  assert.ok(rows.includes(`["${column}",customerField(selected.`), `Customer detail popup includes ${column}`);
}
assert.match(rows, /isCustomerActivity \? \(/, "Customer row data is conditional");
assert.match(loader, /row\.customerName=customer\.contact_name/, "Customer name comes from its master record");
assert.match(loader, /visible\.filter\(row=>row\.table==="customers"/, "Customer lookups are bounded to visible records");
assert.match(loader, /customer\.phone\?\.replace/, "Customer mobiles are masked rather than exposing full phone numbers");

assert.doesNotMatch(panel, /<th[^>]*>Fleet Size<\/th>|<th[^>]*>Total Policies<\/th>/, "Customer drilldown hides fleet size and total policies headers");
assert.doesNotMatch(rows, /customerField\(row\.customerFleetSize\)|customerField\(row\.customerPolicyCount\)|\["Fleet Size",customerField|\["Total Policies",customerField/, "Customer rows and detail dialog hide fleet size and total policies");

assert.match(panel, /const isClaimActivity=data\.category==="Claims"/, "Claims have their own register columns");
for(const header of ["Control No.","Claim No.","Vehicle No."]) assert.ok(panel.includes(`>${header}</th>`),`Claims header present: ${header}`);
assert.match(rows, /isClaimActivity \? \(/, "Claim rows and popup switch to claim-specific fields");
assert.match(loader, /row\.claimControlNo \|\|=label\(previous\.claim_no\)/, "Deleted claims only use audit-preserved control number");
assert.match(loader, /row\.claimInsurerNo \|\|=label\(previous\.insurer_claim_no\)/, "Deleted claims only use audit-preserved claim number");

assert.match(panel, /const isOtherActivity=data\.category==="Other Activities"/, "Other Activities uses its own minimal columns");
assert.match(panel, /isOtherActivity \? \(/, "Other Activities uses an employee-specific column");
assert.match(rows, /customerField\(row\.subjectEmployeeName\)/, "Other Activities renders affected employee name");
assert.match(rows, /\["Employee Name",customerField\(selected\.subjectEmployeeName\)\]/, "Other Activities detail shows employee name");
assert.match(rows, /\["Recorded changes",selected\.detail\|\|"Not recorded"\]/, "Detail popup retains recorded audit changes");

assert.match(panel, /<th className="px-3 py-3">Employee Name<\/th>/, "Other Activities heading is Employee Name");
assert.match(loader, /if\(category==="Other Activities"\)/, "Subject lookup is limited to Other Activities");
assert.match(loader, /row\.table==="employees"/, "Employee lifecycle audit IDs resolve via employee master");
assert.match(loader, /\["profiles","auth.users"\]/, "IT identity audit IDs resolve via profile master");
assert.match(loader, /\.select\("id,full_name,employee_id"\)/, "Profiles connect to employee records");
assert.match(loader, /row\.subjectEmployeeName=employeeNames\.get/, "Subject employee is not the current actor");
assert.doesNotMatch(loader, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/, "Other Activities report remains read-only");
