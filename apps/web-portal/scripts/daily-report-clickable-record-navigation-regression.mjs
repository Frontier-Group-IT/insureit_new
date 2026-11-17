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
assert.ok(routes.includes('if (table === "vehicles") return `${base}/${recordId}/edit`'), "Vehicle activity rows must open existing Vehicle View/Edit route");
assert.doesNotMatch(routes,/return base \? `\$\{base\}\/\$\{recordId\}` : null;[\s\S]*if \(table === "vehicles"\)/,"Vehicle canonical route must precede generic route");
const vehicleEdit=read("../app/vehicles/[id]/edit/page.tsx");
assert.ok(vehicleEdit.includes('hasEffectiveCapability(profile, "view_vehicles", "edit")'), "Vehicle View/Edit respects existing edit permission");
assert.ok(vehicleEdit.includes('<fieldset disabled={!canEdit}'), "Viewer without edit permission remains view only");
const vehicleRegister=read("../app/vehicles/vehicle-workspace.tsx");
assert.ok(vehicleRegister.includes('href={`/vehicles/${vehicle.id}/edit`}'), "Report uses same Vehicle View/Edit route as Vehicle Register");
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
assert.ok(panel.includes("<DailyActivityHistoryRows rows={data.rows} isCustomerActivity={isCustomerActivity} isClaimActivity={isClaimActivity} vehicleMode={vehicleMode} isOtherActivity={isOtherActivity} />"), "Shared activity renderer preserves Customer, Claims and Vehicle modes");
assert.ok(rows.includes('role={canOpen(row)?"button":undefined}'), "Verified destinations and deleted claims are clickable");
assert.ok(rows.includes('tabIndex={canOpen(row)?0:undefined}'), "Deleted claims remain keyboard accessible");
assert.match(rows,/event\.key==="Enter"\|\|event\.key===" "/,"Enter and Space navigate");
assert.match(rows,/\[&_td\]:cursor-pointer/,"Every cell indicates whole-row clickability");
assert.match(rows,/if\(row\.href\) router\.push\(row\.href\)/,"Navigate directly to verified record");
assert.match(rows, /row\.detail \? <span/, "Preserve latest audit field-level change details");
assert.doesNotMatch(rows, /\{row\.source\}/, "Never render Audit or Record history source text in any row");
assert.ok(loader.includes('delete_claim:"Claim Deleted"'), "Claim deletion starts with neutral action label");
assert.ok(loader.includes("claim_created_by_name"), "Original claim creator sourced from audit snapshot");
assert.ok(loader.includes("ownerName?"), "Original creator is only used when explicitly recorded");
assert.ok(loader.includes("Claim Deleted — Name Unavailable"), "Missing original creator never replaced by deleting actor");
assert.match(deleteAction, /\.from\("claims"\)[\s\S]*?\.select\("id,claim_no,created_by"\)/, "Read claim identity before permanently deleting it");
assert.match(deleteAction, /\.from\("profiles"\)[\s\S]*?\.select\("full_name"\)/, "Resolve the original claim creator, not the person deleting it");
assert.match(deleteAction, /claim_created_by_name: deletedClaimIdentity\?\.claim_created_by_name/, "Save creator name into deletion audit");
assert.ok(deleteAction.indexOf('deletedClaimIdentity = {claim_no:') < deleteAction.indexOf('.from("audit_logs").insert'), "Audit uses captured pre-delete identity");

assert.ok(rows.includes("onClick={canOpen(row)?event=>openRecord(row,event.currentTarget):undefined}"), "Clicking any claim row opens correct target");
assert.ok(rows.includes('role="dialog" aria-modal="true"'), "Deleted claim details open an accessible popup");
assert.ok(panel.includes('Policy / Case No.'), "Register shows policy or case reference");
assert.ok(panel.includes('Customer / Vehicle'), "Register shows customer and vehicle context");
assert.ok(panel.includes('Insurance Company'), "Register shows insurer");
assert.ok(rows.includes('getInsurerLogo(row.insurer)'), "Insurer cell uses existing managed-first logo resolver");
assert.ok(rows.includes('src={getInsurerLogo(row.insurer)!}'), "Insurer logo is the visible cell content");
assert.ok(rows.includes('alt={row.insurer}') && rows.includes('title={row.insurer}'), "Insurer name remains accessible via alt and tooltip");
assert.ok(rows.includes('object-contain object-left'), "Wide or narrow insurer logos fit the compact table cell");
assert.ok(rows.includes('aria-label="Insurer unavailable"'), "Missing insurer identity uses a clear fallback");
assert.ok(!rows.includes('{row.insurer||"—"}'), "Insurance company full name is no longer visible in rows");

assert.ok(!panel.includes('Performed By')&&!panel.includes('View Details'), "No performer or details-action column");
assert.ok(loader.includes('admin.from("insurance_companies")'), "Insurer linked to actual company");
assert.ok(loader.includes('admin.from("customers")'), "Customer linked to actual customer");
assert.ok(loader.includes('admin.from("vehicles")'), "Vehicle linked to actual vehicle");
assert.doesNotMatch(loader+routes+panel+rows,/\.insert\(|\.update\(|\.upsert\(|\.delete\(/, "Navigation is read-only");
console.log("Daily Report direct whole-row navigation and six-column context regression passed.");

assert.match(panel, /const isCustomerActivity=data\.category\.startsWith\("Customer "\)/, "Customer category switches to register-aligned columns");
for(const column of ["Customer", "Customer Type", "Mobile"]) {
  assert.ok(panel.includes(`>${column}</th>`), `Customer-specific column is visible: ${column}`);
  assert.ok(rows.includes(`customerField(row.${column==="Customer"?"customerName":column==="Customer Type"?"customerType":"customerMobile"})`), `Customer row retains ${column}`);
}
assert.match(rows, /isCustomerActivity \? \(/, "Customer row data is conditional");
assert.match(loader, /row\.customerName=customer\.contact_name/, "Customer name comes from its master record");
assert.match(loader, /visible\.filter\(row=>row\.table==="customers"/, "Customer lookups are bounded to visible records");
assert.match(loader, /customer\.phone\?\.replace/, "Customer mobiles are masked rather than exposing full phone numbers");

assert.doesNotMatch(panel, /<th[^>]*>Fleet Size<\/th>|<th[^>]*>Total Policies<\/th>/, "Customer drilldown hides fleet size and total policies headers");
assert.doesNotMatch(rows, /customerField\(row\.customerFleetSize\)|customerField\(row\.customerPolicyCount\)|\["Fleet Size",customerField|\["Total Policies",customerField/, "Customer rows hide fleet size and total policies");

assert.match(panel, /const isClaimActivity=data\.category==="Claims"/, "Claims have their own register columns");
for(const header of ["Control No.","Claim No.","Vehicle No."]) assert.ok(panel.includes(`>${header}</th>`),`Claims header present: ${header}`);
assert.match(rows, /isClaimActivity \? \(/, "Claim rows switch to claim-specific fields");
assert.match(loader, /row\.claimControlNo \|\|=label\(previous\.claim_no\)/, "Deleted claims only use audit-preserved control number");
assert.match(loader, /row\.claimInsurerNo \|\|=label\(previous\.insurer_claim_no\)/, "Deleted claims only use audit-preserved claim number");

assert.ok(panel.includes('const vehicleMode=data.category.startsWith("Vehicle ")'),"Vehicle category uses Vehicle Register presentation");
for(const label of ["Vehicle","Customer","Make / model","Registration"]) assert.ok(panel.includes('>'+label+'</th>'),"Vehicle column "+label);
assert.ok(rows.includes('vehicleMode ? ('),"Vehicle rows have conditional fields");
assert.ok(rows.includes('row.vehicleNumber'),"Vehicle columns preserve vehicle number");
assert.ok(loader.includes('.in("id",activityVehicleIds)'),"Vehicle records are read only within visible activity scope");
assert.ok(panel.includes('isClaimActivity={isClaimActivity} vehicleMode={vehicleMode}'),"Claims mode remains intact");

assert.ok(rows.includes('customerField(row.subjectEmployeeName)'),"Other Activities renders affected employee name");
assert.ok(loader.includes('if(category==="Other Activities")'),"Other Activities identity enrichment is scoped to the selected category");

assert.ok(rows.includes('row.status==="Deleted"'),"Deleted Claims open popup instead of unavailable record page");
assert.ok(rows.includes("if(event.key===\"Escape\")"),"Deleted claim popup can close with Escape");
assert.ok(rows.includes("deletedClaim.claimControlNo"),"Deleted claim popup shows recorded claim metadata only");
assert.ok(!loader.includes('selfProfile?.full_name?.trim()||"Employee unavailable"'),"Actor is never mislabelled as deleted claim owner");

assert.match(loader, /const missingIds=error\?\[\]:ids\.filter/, "Failed customer lookup never marks surviving customers deleted");
assert.match(loader, /\.eq\("table_name","customers"\)\.eq\("action","delete_customer"\)/, "Deletion identity comes only from deleted customer audit");
assert.match(loader, /row\.customerName=deletion\.name/, "Deleted customer name is recovered from deletion snapshot");
assert.ok(loader.includes("profile?.full_name?.trim().toLocaleLowerCase()===deletion.name.toLocaleLowerCase()"), "Retained phone must match deleted customer name");
assert.match(loader, /row\.customerMobile=phone\?maskPhone\(phone\):undefined/, "Only masked historical phones are displayed");
assert.match(loader, /if\(row\.activity==="Customer Created"\)row\.activity="Customer Deleted"/, "Deleted customer rows directly display Customer Deleted");
assert.match(loader, /row\.status="Deleted"/, "Current deleted state is distinguished from creation event");
assert.match(loader, /creation_channel==="direct_customer_onboarding"/, "Only audited direct onboarding qualifies for Internal customer type");
assert.match(loader, /if\(directOnboardingIds\.has\(row\.recordId\)\)row\.customerType="Internal"/, "Historical Internal type comes from verified origin");
