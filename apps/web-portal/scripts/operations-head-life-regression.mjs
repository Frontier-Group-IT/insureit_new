import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { roleCapabilities, roleLabels } from "../lib/roles.ts";

const read = (name) => readFileSync(resolve(process.cwd(),name),"utf8");
assert.equal(roleLabels.operations_head_life,"Operations Head - Life");
assert.deepEqual(roleCapabilities.operations_head_life,["view_policies","view_intermediaries"],
  "Generic policy/intermediary capabilities stay read-only; explicit scoped actions authorize writes");
const scope=read("lib/employee-access-scope.ts");
assert.match(scope,/role === "operations_head_life"/);
assert.match(scope,/ac167429-0ce0-4ffe-90ea-4040cb4fea95/);
assert.match(scope,/descendantIds\(root, employees\)/);
const policy=read("lib/policy-access-scope.ts");
assert.match(policy,/role === "operations_head_life"/);
assert.match(policy,/getOperationsHeadDownlinePolicyScope/);
assert.match(policy,/operationsHeadPolicyFilter/);
assert.match(policy,/associate_employee_id/);
assert.match(policy,/intermediary_code/);
const register=read("app/policies/page.tsx");
assert.match(register,/profile\.role === "operations_head_life"/);
assert.match(register,/query = query\.or\(operationsHeadFilter\)/);
const middleware=read("middleware.ts");
assert.match(middleware,/check\.role === "operations_head_life" && !isOperationsHeadLifePath\(pathname\)/);
const nav=read("components/claim-manager/app-navigation.tsx");
assert.match(nav,/role==="operations_head_life"/);
const permission=read("lib/permission-management.ts");
assert.match(permission,/lifeHeadPermissionCeiling/);
assert.match(permission,/role==="operations_head_life"/);
const policyDocuments=read("app/policies/policy-document-actions.ts");
assert.match(policyDocuments,/profile.role === "operations_head_life"/);
assert.match(policyDocuments,/canAccessPolicy\(profile.id, profile.role, documentRow.policy_id, "view_policies"\)/);
const caseList=read("app/policies/life-health-cases/page.tsx");
assert.ok(caseList.includes(".or(downlineCaseFilter)"));
assert.ok(caseList.includes("operationsHeadVisiblePolicyFilter"));
assert.ok(caseList.includes("downlineCaseFilter !== null ? Promise.resolve(null)"));
const caseDetail=read("app/policies/life-health-cases/[id]/page.tsx");
assert.ok(caseDetail.includes("request = request.or(downlineFilter)"));
assert.ok(caseDetail.includes("LifeHealthCaseDetail"));
assert.ok(!caseDetail.includes("Read-only ·"));
assert.ok(!caseDetail.includes("if (!editable)"));
assert.ok(read("app/policies/life-health-policy-actions.ts").includes('requireOperationsHeadRecordOwnership("life_health_case",caseId)'));
assert.ok(read("app/policies/life-health-case-edit-actions.ts").includes('requireOperationsHeadRecordOwnership("life_health_case", caseId)'));
assert.ok(!read("app/policies/life-health-case-edit-actions.ts").includes("Customer master changes require separate authorization"));
assert.ok(policy.includes('in("business_line", ["Life", "Health"])'));
assert.ok(policy.includes("operationsHeadPolicyFilter(scope)"), "Policy Intake must remain downline only");
assert.ok(middleware.includes('pathname === "/policies/life-health-cases"'));
const migration=read("../../supabase/migrations/20261023101500_operations_head_life_role.sql");
assert.match(migration,/add value if not exists 'operations_head_life'/);
const policyAccessServer=read("lib/policy-access-server.ts");
assert.ok(policyAccessServer.includes('requirePolicyEditor(policyId?: string)'));
assert.ok(policyAccessServer.includes('canAccessPolicy(profile.id, profile.role, policyId, "view_policies", true)'));
assert.ok(policyAccessServer.includes('scope.intermediaryCodes.includes(sourceCode.trim())'));
const writeGuard=read("lib/operations-head-record-authorization.ts");
assert.ok(writeGuard.includes('requireOperationsHeadRecordOwnership'));
assert.ok(writeGuard.includes('canAccessOperationsHeadCase(profile.id, recordId)'));
for(const path of [
  "app/policies/policy-edit-actions.ts",
  "app/policies/non-motor-policy-actions.ts",
  "app/policies/policy-edit-document-actions.ts",
  "app/policies/policy-document-actions.ts",
  "app/policies/life-health-issued-policy-edit-actions.ts",
  "app/policies/life-health-issued-policy-document-actions.ts",
  "app/policies/policy-payin-billing-actions.ts",
]) {
  assert.ok(read(path).includes("requirePolicyEditor(policyId)"), path + ": per-policy scope required");
}
for(const path of [
  "app/policies/life-health-case-edit-actions.ts",
  "app/policies/life-health-policy-actions.ts",
]) {
  assert.ok(read(path).includes('requireOperationsHeadRecordOwnership("life_health_case"'),path + ": per-case scope required");
}
assert.ok(read("app/policies/life-health-case-documents/[documentId]/view/route.ts").includes("canAccessOperationsHeadCase(requester.id, document.case_id)"));
const intakes=read("lib/policy-intake-server.ts");
assert.ok(intakes.includes("canAccessOperationsHeadIntake(profile.id, intakeId)"));
assert.ok(read("app/policy-intakes/page.tsx").includes("submitted_by_profile_id.in."));
assert.ok(read("app/policy-intakes/actions.ts").includes("requirePolicyIntakeFinalizer(id)"));
assert.ok(read("app/policy-intakes/policy-copy-state-actions.ts").includes("requirePolicyIntakeFinalizer(id)"));
assert.ok(read("app/policies/new/page.tsx").includes("allowedCustomerIds.has(row.id)"));
assert.ok(read("app/policies/new/non-motor/page.tsx").includes("allowedCustomers.has(row.id)"));
assert.ok(read("app/policies/documents/[documentId]/download/route.ts").includes("canAccessPolicy(profile.id, profile.role, document.policy_id"));
assert.ok(read("app/policies/policy-edit-actions.ts").includes("The assigned intermediary and RM cannot be changed"));
assert.ok(read("app/policies/non-motor-policy-actions.ts").includes("Changing the linked intermediary or RM is not permitted"));
const commercial=read("lib/policy-commercial-access.ts");
assert.ok(commercial.includes('profile?.role === "operations_head_life") return scopedRecordAuthorized'));
const scopedDashboard=read("app/dashboard/page.tsx");
assert.ok(scopedDashboard.includes('isDownlineHead'));
assert.ok(scopedDashboard.includes('access.viewVehicles = false'));
assert.ok(scopedDashboard.includes('access.viewClaims = false'));
assert.ok(scopedDashboard.includes('access.viewPolicyIntakes = false'));
assert.ok(scopedDashboard.includes('!isDownlineHead && dashboardCommercialOperationsAccess'));
const dashboardPolicies=read("app/dashboard-v2/dashboard-data.ts");
assert.ok(dashboardPolicies.includes('operationsHeadVisiblePolicyFilter(await getOperationsHeadDownlinePolicyScope(profile.id))'));
assert.ok(dashboardPolicies.includes('query = query.or(downlineFilter)'));
const dashboardBusiness=read("app/dashboard-v2/dashboard-business.ts");
assert.ok(dashboardBusiness.includes('policyQuery = policyQuery.or(downlineFilter)'));
assert.ok(nav.includes('href:"/dashboard",label:"Dashboard"'));
assert.ok(!nav.includes('href:"/policies/new/non-motor",label:"Add Non-Motor Policy"'));
assert.ok(middleware.includes('const operationsHeadLifeHome = "/dashboard"'));
assert.ok(policy.includes('business_line.in.("Life","Health")'));
assert.ok(policy.includes('const filter = operationsHeadVisiblePolicyFilter(downline)'));
assert.ok(register.includes("operationsHeadVisiblePolicyFilter"));
assert.ok(caseDetail.includes("operationsHeadVisiblePolicyFilter"));
const lifeCaseDetail = read("components/life-health-case-detail.tsx");
assert.ok(lifeCaseDetail.includes('onClick={saveDetails}'), "Case details require a standalone save action");
assert.ok(lifeCaseDetail.includes('updateLifeHealthCaseDetails(editData())'), "Save must use existing authorized server action");
assert.ok(lifeCaseDetail.includes('"Save Case Details"'), "Standalone save button must be visible");
assert.ok(lifeCaseDetail.includes('onClick={convert}'), "Issue Policy workflow must remain available");
console.log("Operations Head Life all-Life/Health visibility and downline-only writes regression passed.");
