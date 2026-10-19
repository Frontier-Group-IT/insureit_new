import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { roleCapabilities } from "../lib/roles.ts";
import { roleMatrixV2 } from "../lib/access-control-role-matrix-v2.ts";

const read = (file) => readFileSync(resolve(process.cwd(), file), "utf8");
const expected = ["view_dashboard","view_claims","manage_claims","view_tasks","manage_tasks","view_reports","view_notifications"];
assert.deepEqual(roleCapabilities.claims_head, expected, "Do not change legacy capability defaults without migration");
const target = roleMatrixV2.find(r => r.code === "claims_head");
assert.equal(target?.defaultScope, "organization");
for (const name of ["claims.view","claims.edit","claims.verify_documents","claims.assign_surveyor","claims.change_stage"]) {
  assert.ok(target?.grants.some(g => g.permission === name && g.scope === "organization"), name);
}
const scope = read("lib/employee-access-scope.ts");
assert.match(scope, /role === "claims_head" && \(capability === "view_claims" \|\| capability === "manage_claims"\)/);
assert.doesNotMatch(scope.match(/const organizationWideRoles[\s\S]*?\];/)?.[0] ?? "", /"claims_head"/);
const middleware = read("middleware.ts");
assert.match(middleware, /check\.role === "claims_head" && !isClaimsHeadPortalPath\(pathname\)/);
const allowed = middleware.match(/function isClaimsHeadPortalPath\([\s\S]*?\n\}/)?.[0] ?? "";
for (const path of ['"/claims"','"/claim-documents"','"/reports/claims"','"/reports/export/claims"','"/notifications"']) assert.ok(allowed.includes(path), path);
for (const path of ['"/accounts"','"/policies"','"/customers"','"/reports"','"/dashboard"','"/tasks"']) assert.ok(!allowed.includes(path) || path === '"/reports"', "Claims Head allowlist must not enable " + path);
const nav = read("components/claim-manager/app-navigation.tsx");
assert.match(nav, /if\(role==="claims_head"\)/);
assert.match(nav, /href:"\/reports\/claims"/);
assert.doesNotMatch(nav.match(/if\(role==="claims_head"\)[\s\S]*?return result;\}/)?.[0] ?? "", /href:"\/reports"(?!\/claims)/);
const report = read("lib/reports/claims.ts");
assert.match(report, /profile\.role==="claims_head"\?"view_claims":"view_reports"/);
const migration = read("../../supabase/migrations/20261019170000_claims_head_organization_claim_updates.sql");
assert.match(migration, /else me\.role in \('it_super_user', 'claims_head'\)/);
assert.match(migration, /when exists \(select 1 from employee_override where access_level <> 'inherit'\)/);
assert.match(migration, /when exists \(select 1 from role_override\)/);
assert.doesNotMatch(migration, /create policy|drop policy|alter table/i, "Do not broaden RLS with unrelated policies");
console.log("Claims Head least-privilege static regression passed.");
