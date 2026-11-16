import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {roleCapabilities} from "../lib/roles.ts";

const read=(file)=>readFileSync(resolve(process.cwd(),file),"utf8");
const access=read("lib/reports/daily-report-access.ts");
const page=read("app/reports/(workspace)/daily/page.tsx");
const layout=read("app/reports/(workspace)/layout.tsx");
const controls=read("components/reports/daily-report-header-controls.tsx");
const middleware=read("middleware.ts");
const desktop=read("components/claim-manager/app-navigation.tsx");
const mobile=read("components/claim-manager/mobile-navigation.tsx");
const directory=read("lib/reports/daily-employee-directory.ts");

// Self access must validate active linked employees, not every account or a role label.
assert.match(access,/isPortalRole\(profile\.role\)/,"Only internal portal roles can enter");
assert.match(access,/profile\.is_active/,"Inactive profiles are rejected");
assert.match(access,/\.select\("employee_id"\)\.eq\("id",profile\.id\)\.eq\("is_active",true\)/,"Require an active employee-linked profile");
assert.match(access,/\.from\("employees"\)[\s\S]*?\.eq\("employment_status","active"\)/,"Verify linked employee is active");
assert.match(access,/if\(employeeError \|\| !employee\) redirect\("\/access-denied"\)/,"Fail closed on inactive or unverifiable employee");

// Do not grant broad Reports permissions merely to make the Self report visible.
for(const role of ["sales_executive","operations_head_life","claim_processor","field_executive","agent"]){
  assert.ok(!roleCapabilities[role].includes("view_reports"),"No global reporting grant to "+role);
}
assert.match(page,/await requireDailyReportEmployee\(\)/,"Daily page admits employee-linked profiles");
assert.doesNotMatch(page,/requireCapability\("view_reports"\)/,"Self cannot require broad reporting capability");
assert.match(page,/const isSelf = query\.scope !== "all" \|\| !canViewAll/,"Direct scope=all is downgraded to Self without permission");
assert.match(page,/if \(isSelf\) \{[\s\S]*?loadSelfActivityHistory\(profile\.id/,"Self always loads only authenticated employee history");
assert.match(page,/employeeDirectory = await loadDailyReportEmployeeDirectory\(profile\)/,"All retains scoped employee directory");
assert.match(page,/assertDailyReportEmployeeAllowed\(chosenPerson, employeeDirectory\)/,"Direct person= URLs retain target authorization");
assert.match(access,/hasEffectiveCapability\(profile,"view_reports","view"\)/,"All still needs existing reporting permission");
for(const role of ["accounts","claims_head","sales_executive","operations_head_life"])
  assert.ok(access.includes(`role!=="${role}"`),"Previously restricted role must not gain All: "+role);
assert.match(directory,/getEmployeeAccessScope\(viewer\.id, viewer\.role, "view_reports"\)/,"All preserves reporting hierarchy");
assert.match(directory,/activeEmployeeIds\.has\(p\.employee_id\)/,"All continues excluding customer-only profiles");

// Exactly one new employee Self route, never the whole Reports workspace.
for(const role of ["accounts","operations_head_life","sales_executive","claims_head"]){
  assert.ok(middleware.includes(`check.role === "${role}" && pathname !== "/reports/daily" &&`),"Exact Daily-only middleware exception missing for "+role);
}
assert.match(desktop,/isPortalRole\(role\).*?node\.href==="\/reports\/daily"/,"Desktop uses employee-only Daily link when a Reports menu link is absent");
assert.match(mobile,/isPortalRole\(role\).*?node\.href==="\/reports\/daily"/,"Mobile uses employee-only Daily link");
for(const nav of [desktop,mobile]){
  assert.match(nav,/href="\/reports\/daily\?scope=self"/,"Dedicated quick link opens own activities");
  assert.match(nav,/!isIntermediaryOnlyLaunch/,"Do not expose internal Daily link to intermediary portal");
}
assert.match(layout,/canViewAll=profile\?\.is_active \? await canViewDailyReportAll\(profile\) : false/,"Header uses permission-aware All visibility");
assert.match(layout,/<DailyReportHeaderScopes canViewAll=\{canViewAll\}/,"Header receives reporting access");
assert.match(controls,/canViewAll\|\|option\.value==="self"/,"Self-only employee cannot choose All");
assert.match(controls,/const scope=canViewAll && searchParams\.get\("scope"\)==="all"\?"all":"self"/,"Header reflects effective Self mode");
console.log("Daily Report access for all active employees with Self/All isolation regression passed");
