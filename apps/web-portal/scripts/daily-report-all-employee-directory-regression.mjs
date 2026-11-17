import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveDailyReportActorIds } from "../lib/reports/daily-activity-actor-scope.ts";
const read = path => readFileSync(new URL(path,import.meta.url),"utf8");
const directory=read("../lib/reports/daily-employee-directory.ts");
const page=read("../app/reports/(workspace)/daily/page.tsx");
const header=read("../components/reports/daily-report-header-controls.tsx");
const endpoint=read("../app/api/reports/daily/employees/route.ts");
const panel=read("../components/reports/daily-self-activity-panel.tsx");
const history=read("../lib/reports/daily-self-activity.ts");
assert.deepEqual(resolveDailyReportActorIds("manager","all",{mode:"hierarchy",profileIds:["team1","team2"]}),["manager","team1","team2"]);
assert.deepEqual(resolveDailyReportActorIds("employee","all",{mode:"self",profileIds:["other"]}),["employee"]);
assert.equal(resolveDailyReportActorIds("superuser","all",{mode:"organization",profileIds:[]}),null);
assert.match(directory,/getEmployeeAccessScope\(viewer\.id, viewer\.role, "view_reports"\)/);
assert.match(directory,/resolveDailyReportActorIds\(viewer\.id, "all", access\)/);
assert.match(directory,/activeEmployeeIds\.has\(p\.employee_id\)/);
assert.match(directory,/const authorized=directory\.people\.find\(person=>person\.id===targetId\)/);
assert.match(directory,/if\(!authorized\) throw/);
assert.match(directory,/JATIN_EMPLOYEE_ID/);
assert.match(directory,/descendants\.has\(employee\.reporting_manager_id\)/);
assert.match(directory,/access\.mode==="organization"/);
assert.match(endpoint,/await requireDailyReportEmployee\(\)/);
assert.match(endpoint,/await canViewDailyReportAll\(profile\)/,"Self-only users cannot list colleagues");
assert.match(endpoint,/loadDailyReportEmployeeDirectory\(profile\)/);
assert.match(endpoint,/"Cache-Control":"private, no-store"/);
assert.match(header,/fetch\("\/api\/reports\/daily\/employees"/);
assert.match(header,/matching\.map\(person=>\(/);
assert.match(header,/if\(!isDaily \|\| !canViewAll\)return;/,
  "Employee directory is loaded automatically only for authorized Daily Report viewers");
assert.match(header,/const hasOtherEmployees=people\.length>0/,
  "Employee dropdown depends on real authorized employees, not role or permission alone");
assert.match(header,/const showDropdown=canViewAll && \(hasOtherEmployees \|\| loadError\)/,
  "Zero reportees get fixed Self; lookup errors remain distinguishable and retryable");
assert.match(header,/if\(!showDropdown\)/, "Self-only view never opens the search dropdown");
assert.match(header,/aria-label="Daily Report scope: Self"/,
  "Self-only employee sees an accessible non-interactive scope label");

assert.match(header,/selectedPerson===person\.id\?"bg-\[#edf3fa\] text-\[#111827\]"/, "Selected employee keeps readable black text");
assert.match(header,/className="min-w-0 truncate text-center"/, "Selected scope text is centered");
assert.match(header,/justify-center rounded-lg/, "Self-only scope text is centered");
assert.match(header,/selectPerson\(person\.id\)/);
assert.match(header,/selectPerson\("all"\)/,"Dropdown offers combined All view");
assert.doesNotMatch(page,/<DailyEmployeeDirectory/);
assert.doesNotMatch(page,/if \(query\.scope === "all" && !query\.person\)/,"All no longer redirects to Self");
assert.match(page,/authorizedActorIds:\[profile\.id,\.\.\.employeeDirectory\.people\.map\(person=>person\.id\)\]/,"All combines only authorized employee IDs and viewer");
assert.match(page,/if \(chosenPerson\) assertDailyReportEmployeeAllowed\(chosenPerson, employeeDirectory\)/,"Individual employee selection remains authorized");
assert.match(panel,/reportMode==="self" \? "My Activity Summary"/);
assert.match(history,/\.in\("actor_id",actorIds\)/,"History source uses authorized actor IDs inside database query");
assert.doesNotMatch(directory+endpoint+panel+history,/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
assert.match(header,/aria-selected=\{allSelected&&!selectedPerson\}/,"All selection is explicit and accessible");
assert.match(header,/onClick=\{\(\)=>selectPerson\("all"\)\}/,"All option uses existing scope navigation");
assert.match(header,/personId!=="all"/,"Combined All never writes a person ID to the URL");
assert.match(page,/employeeDirectory = await loadDailyReportEmployeeDirectory\(profile\)/,"Combined All requires the original authorized directory");
assert.match(page,/authorizedActorIds:\[profile\.id,\.\.\.employeeDirectory\.people\.map\(person=>person\.id\)\]/,"Combined actor IDs come solely from authorized directory");
assert.match(history,/actorIds\.some\(id=>!isValidDailyProfileId\(id\)\)/,"Reject malformed actor IDs");
for(const source of ["actor_id","created_by","submitted_by_profile_id","finalized_by_profile_id","converted_by","verified_by","changed_by"]) {
  assert.ok(history.includes('.in("'+source+'",actorIds)'),"All source must apply actor scope in database: "+source);
}
assert.match(panel,/reportMode==="all" \? "All Activity Summary"/,"Combined All view has a clear title");
console.log("Employee selector reuses server hierarchy without any standalone All directory.");