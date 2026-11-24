import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {lifeTeamOwnerIds,lifeTeamReadFilter,lifeTeamReportSegments} from "../lib/life-team-portfolio-contract.ts";

const owners=lifeTeamOwnerIds("root",[
 {id:"root",reporting_manager_id:null},
 {id:"active",reporting_manager_id:"root"},
 {id:"former",reporting_manager_id:"root"},
 {id:"historical-child",reporting_manager_id:"former"},
 {id:"direct",reporting_manager_id:"root"},
 {id:"unrelated",reporting_manager_id:null},
 {id:"unrelated-child",reporting_manager_id:"unrelated"},
], "direct");
assert.deepEqual(owners,["active","former","historical-child","root"]);
assert.deepEqual(lifeTeamOwnerIds("missing",[],"direct"),[]);
assert.deepEqual(lifeTeamOwnerIds("a",[{id:"a",reporting_manager_id:"b"},{id:"b",reporting_manager_id:"a"}],"direct"),["a","b"],"Cycles must terminate");
const scope={employeeIds:owners,directEmployeeId:"direct"};
assert.equal(lifeTeamReadFilter(scope),"rm_employee_id.in.(active,former,historical-child,root),and(business_line.in.(Life,Health),rm_employee_id.eq.direct)");
assert.equal(lifeTeamReadFilter({employeeIds:[],directEmployeeId:null}),"id.eq.00000000-0000-0000-0000-000000000000");
for(const line of ["Motor","Non Motor","Life","Health",null]){
 const segments=lifeTeamReportSegments(scope,line);
 const records=[
  ...owners.flatMap(owner=>["Motor","Non Motor","Life","Health"].map(business=>({owner,business}))),
  ...["direct","unrelated",null].flatMap(owner=>["Motor","Non Motor","Life","Health"].map(business=>({owner,business})))
 ];
 for(const record of records){
  const matches=segments.filter(segment=>segment.ids.includes(record.owner)&&(!segment.line||segment.line===record.business));
  const expected=(!line||line===record.business)&&(owners.includes(record.owner)||(record.owner==="direct"&&["Life","Health"].includes(record.business)));
  assert.equal(matches.length,expected?1:0,JSON.stringify({record,line}));
 }
}
assert.deepEqual(lifeTeamReportSegments({employeeIds:[],directEmployeeId:null},null),[]);
assert.deepEqual(lifeTeamReportSegments({employeeIds:["direct"],directEmployeeId:"direct"},"Motor"),[]);
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const policy=read("lib/policy-access-scope.ts");
assert.match(policy,/hasEffectiveCapability\(\{ id: profileId, role \}, "view_policies", "view"\)/);
assert.match(policy,/\.eq\("is_active", true\)/);
assert.match(policy,/!write && capability === "view_policies"/);
for(const path of ["app/dashboard-v2/dashboard-data.ts","app/dashboard-v2/dashboard-business.ts","app/dashboard/page.tsx","app/policies/page.tsx","app/policies/life-health-cases/page.tsx","app/policies/life-health-cases/[id]/page.tsx","lib/reports/policy-business-mis-export.ts"]){
 assert.ok(read(path).includes("getLifeTeamPortfolioReadFilter"),path+" must reuse shared read filter");
}
assert.ok(read("lib/reports/policy-business.ts").includes("lifeTeamReportSegments(portfolio,filters.businessLine)"));
assert.ok(read("lib/reports/policy-business-export.ts").includes("loadPolicyBusinessReport(profile,"));
assert.ok(read("app/policies/life-health-case-documents/[documentId]/view/route.ts").includes("canReadLifeTeamCase"));
for(const path of ["app/policies/documents/[documentId]/download/route.ts","app/policies/policy-document-actions.ts"])assert.ok(read(path).includes("usesLifeTeamPortfolio"));
console.log("Historical Life team and independent Direct Business read-scope regression passed.");
