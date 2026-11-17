import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const panel=readFileSync(new URL("../components/reports/daily-self-activity-panel.tsx",import.meta.url),"utf8");
const history=readFileSync(new URL("../lib/reports/daily-self-activity.ts",import.meta.url),"utf8");
const rows=readFileSync(new URL("../components/reports/daily-activity-history-rows.tsx",import.meta.url),"utf8");

for(const [group,selector] of [
  ["Customer",'item.name.startsWith("Customer ")'],
  ["Vehicle",'item.name.startsWith("Vehicle ")'],
  ["Policies",'item.name.startsWith("Policy ")'],
  ["Claims",'item.name==="Claims"||item.name.startsWith("Claim ")'],
]) {
  assert.ok(panel.includes(`name:"${group}", items:data.categories.filter(item=>${selector})`),`Missing dedicated ${group} activity row`);
}
assert.match(panel,/name:"Other", items:data\.categories\.filter\(/,"Unclassified categories remain visible in an Other row");
assert.match(panel,/\]\.filter\(group=>group\.items\.length>0\)/,"Do not render empty family rows");
assert.match(panel,/categoryGroups\.map\(group=>\(/,"Render one section per family");
assert.match(panel,/group\.items\.map\(item=>\(/,"Render cards only within their own family grid");
assert.match(panel,/gridColumnsFor\(group\.items\.length\)/,"Each family uses its full available row width");
assert.match(panel,/count>=5\?"xl:grid-cols-5"/,"At most five activity cards per desktop row");
assert.match(panel,/href=\{linkFor\(\{activity:item\.name,page:"1"\}\)\}/,"Keep original category drilldown");
assert.match(panel,/item\.count\.toLocaleString\("en-IN"\)/,"Keep unmodified activity totals");
assert.match(panel,/data\.categories\.length/,"Keep original empty-state handling");
assert.match(history,/groupActivityWithName\(activity:string,groupName:string\)/, "Group names replace generic activity prefixes");
assert.match(history,/row\.table==="intermediary_groups"&&isValidDailyRecordId\(row\.recordId\?\?""\)/, "Group references must come only from visible valid IDs");
assert.match(history,/admin\.from\("intermediary_groups"\)[\s\S]*?\.select\("id,group_name"\)\.in\("id",groupIds\)/, "Group labels are read in one scoped lookup");
assert.match(history,/row\.activity=groupActivityWithName\(row\.activity,name\)/, "Group activity label includes actual group name");
assert.match(history,/typeof capturedName==="string"&&capturedName\.trim\(\)/, "Use captured historical name for renamed groups");
assert.match(history,/const actingEmployeeName=selfProfile\?\.full_name\?\.trim\(\)\|\|undefined/, "Actor's real profile name is used for non-employee operations");
assert.match(history,/else row\.subjectEmployeeName=actingEmployeeName/, "Missing employee targets resolve to action performer");
assert.match(history,/if\(row\.recordId&&row\.table==="employees"\)/, "Affected employee names retain priority for employee actions");
assert.match(rows,/row\.subjectEmployeeName/, "Employee Name table cell displays resolved employee");
assert.match(history,/\.eq\("actor_id",viewerId\)/, "Activity scope remains restricted to selected authorized actor");
assert.doesNotMatch(history,/\.update\(|\.insert\(|\.upsert\(|\.delete\(/, "Reporting change stays read-only");
console.log("Daily Report activity cards remain grouped by Customer, Vehicle, Policies, Claims and Other.");
