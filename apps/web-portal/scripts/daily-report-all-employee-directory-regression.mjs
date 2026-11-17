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
assert.doesNotMatch(header,/value:"all",label:"All"/);
assert.doesNotMatch(page,/<DailyEmployeeDirectory/);
assert.match(page,/if \(query\.scope === "all" && !query\.person\)/);
assert.match(page,/redirect\(`\/reports\/daily\?\$\{params\.toString\(\)\}`\)/);
assert.match(page,/assertDailyReportEmployeeAllowed\(chosenPerson, employeeDirectory\);[\s\S]*?loadSelfActivityHistory\(chosenPerson/);
assert.match(panel,/reportMode==="self" \? "My Activity Summary"/);
assert.match(history,/\.eq\("actor_id",viewerId\)/);
assert.doesNotMatch(directory+endpoint+panel+history,/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
console.log("Employee selector reuses server hierarchy without any standalone All directory.");