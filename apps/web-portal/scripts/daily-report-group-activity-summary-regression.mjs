import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const panel=readFileSync(new URL("../components/reports/daily-self-activity-panel.tsx",import.meta.url),"utf8");
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
assert.match(panel,/grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5/,"Keep five activity cards per desktop row");
assert.match(panel,/href=\{linkFor\(\{activity:item\.name,page:"1"\}\)\}/,"Keep original category drilldown");
assert.match(panel,/item\.count\.toLocaleString\("en-IN"\)/,"Keep unmodified activity totals");
assert.match(panel,/data\.categories\.length/,"Keep original empty-state handling");
for (const family of ["Customer","Vehicle","Policies","Claims","Other"]) {
  assert.ok(panel.includes(`${family}:{`), `Missing distinct card palette for ${family}`);
}
assert.match(panel,/familyStyles\[group\.name\]\.card/,"Cards use a family-specific accent and soft background");
assert.match(panel,/familyStyles\[group\.name\]\.count/,"Number badges match their family palette");
assert.match(panel,/familyStyles\[group\.name\]\.heading/,"Group headings match card accents");
assert.doesNotMatch(panel,/>›<\/span>/,"No chevron arrows appear on activity buttons");

console.log("Daily Report activity cards remain grouped by Customer, Vehicle, Policies, Claims and Other.");
