import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { roleCapabilities } from "../lib/roles.ts";
const read = (path) => readFileSync(resolve(process.cwd(),path),"utf8");
const granted = roleCapabilities.operations_head_life;
assert.ok(granted.includes("view_intermediaries"));
for (const capability of ["create_intermediary_application","review_intermediary_application","approve_intermediary_application","activate_intermediary","manage_system"]) {
  assert.ok(!granted.includes(capability), "Generic privileged capability must stay denied: "+capability);
}
const management = read("lib/permission-management.ts");
assert.ok(management.includes('view_intermediaries:"view"'));
assert.ok(!management.includes('const lifeHeadPermissionCeiling:Partial<Record<Capability,PermissionAccess>>={view_policies:"view",view_intermediaries:"view",create_intermediary_application'));
const scope=read("lib/employee-access-scope.ts");
assert.ok(scope.includes('["view_policies","view_intermediaries"].includes(capability)'));
assert.ok(scope.includes('const root = "ac167429-0ce0-4ffe-90ea-4040cb4fea95"'));
assert.ok(scope.includes('if (role === "operations_head_life") {') && scope.includes('linkedError) return []'));
const master=read("lib/master-data-server.ts");
assert.ok(master.includes("getPospMispManager(allowOperationsHeadLife = false)"));
assert.ok(master.includes('allowOperationsHeadLife && await hasEffectiveCapability(profile, "view_intermediaries", "view")'));
assert.ok(master.includes("getScopedPospMispManager(applicationId: string, allowOperationsHeadLife = false)"));
assert.ok(master.includes('profile.role === "operations_head_life" ? "view_intermediaries" : "review_intermediary_application"'));
for (const path of ["app/intermediaries/overview-register.tsx","app/intermediaries/intermediary-register.tsx","app/intermediaries/structured-account-register.tsx","app/customers/posp-misp/new/new-onboarding-page.tsx"]) {
  assert.ok(read(path).includes("requirePospMispManager(true)"),path);
}
const nav=read("components/claim-manager/app-navigation.tsx");
assert.ok(nav.includes('label:"Intermediaries"'));
assert.ok(nav.includes('href:"/intermediaries/posp/new"'));
assert.ok(nav.includes('href:"/intermediaries/misp/new"'));
const mw=read("middleware.ts");
assert.ok(mw.includes('pathname === "/intermediaries"'));
assert.ok(mw.includes('pathname === "/customers/posp-misp/new/submit"'));
assert.ok(!mw.includes('pathname.startsWith("/intermediaries/")'));
const edit=read("app/customers/applications/intermediary-edit-actions.ts");
assert.ok(edit.includes("requireScopedPospMispManager(applicationId, true)"));
assert.ok(edit.includes('isEmployeeWithinAccessScope(reviewer.id,reviewer.role,associate.id)'));
assert.ok(edit.includes('editSection!=="primary" || hasExistingMigration'));
const accountDetail=read("app/intermediaries/applications/[id]/page.tsx");
assert.ok(accountDetail.includes("requireScopedPospMispManager(id, true)"));
assert.ok(accountDetail.includes("limitedLifeHead ? <Link"));
assert.ok(accountDetail.includes("isPartner && !limitedLifeHead && activePartner"));
const workflow=read("app/intermediaries/applications/[id]/workflow/page.tsx");
assert.ok(workflow.includes('requireScopedPospMispManager(id, true)'));
assert.ok(workflow.includes('lifeScope.employeeIds.includes(item.id)'));
// Life Head may view the unlocked document stage, but never unrelated workflow stages.
assert.ok(workflow.includes('requestedStage === "documents" && unlocked.has("documents")'));
assert.ok(workflow.includes('"documents" : "primary"'));
assert.ok(!workflow.includes('limitedLifeHead ? "primary"'));
assert.ok(workflow.includes('enabled={viewStage === "documents" && editable}'));
const manual=read("app/customers/posp-misp/manual-actions-v2.ts");
assert.ok(manual.includes('currentManager(value(data, "associate_employee_id"))'));
assert.ok(manual.includes('isEmployeeWithinAccessScope(profile.id,profile.role,employeeId)'));
const older=read("app/customers/posp-misp/actions.ts");
assert.ok(older.includes('isEmployeeWithinAccessScope(profile.id, profile.role, employeeId)'));
const submission=read("app/customers/posp-misp/new/submit/route.ts");
assert.ok(submission.includes('canAccessIntermediaryApplication(requester.id, requester.role, existingApplicationId, "view_intermediaries")'));
assert.ok(submission.includes('hasEffectiveCapability(profile, "view_intermediaries", "view")'));
console.log("Operations Head intermediary read/create/edit least-privilege checks passed.");
