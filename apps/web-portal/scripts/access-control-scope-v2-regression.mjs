import { legacyCapabilityCompatibilityMap } from "../lib/access-control-catalogue-v2.ts";
import { resolveEffectivePermissionV2 } from "../lib/access-control-effective-v2.ts";
import { roleMatrixV2 } from "../lib/access-control-role-matrix-v2.ts";
import { evaluateScopedAccessV2, scopeAllowsTargetV2 } from "../lib/access-control-scope-v2.ts";
import { appRoles, roleCapabilities } from "../lib/roles.ts";

function fail(message) {
  throw new Error(`[access-control-scope-v2] ${message}`);
}

function expect(name, actual, expected) {
  if (actual !== expected) fail(`${name}: expected ${String(expected)}, got ${String(actual)}`);
}

const actor = {
  actorEmployeeId: "emp-self",
  teamEmployeeIds: ["emp-team"],
  hierarchyEmployeeIds: ["emp-team", "emp-child"],
  branchId: "branch-a",
  zoneId: "zone-a",
  departmentId: "dept-a",
  verticalId: "vertical-a",
  selectedLocationIds: ["location-special"],
  selectedEmployeeIds: ["emp-selected"],
};

const scopeCases = [
  ["organization always allows", "organization", { principalEmployeeIds: ["emp-other"] }, true],
  ["self owner allows", "self", { principalEmployeeIds: ["emp-self"] }, true],
  ["self unrelated denies", "self", { principalEmployeeIds: ["emp-other"] }, false],
  ["assigned actor allows", "assigned", { assigneeEmployeeIds: ["emp-self"] }, true],
  ["assigned unrelated denies", "assigned", { assigneeEmployeeIds: ["emp-other"] }, false],
  ["team member allows", "team", { principalEmployeeIds: ["emp-team"] }, true],
  ["hierarchy descendant allows", "hierarchy", { principalEmployeeIds: ["emp-child"] }, true],
  ["branch match allows", "branch", { branchId: "branch-a" }, true],
  ["branch mismatch denies", "branch", { branchId: "branch-b" }, false],
  ["zone match allows", "zone", { zoneId: "zone-a" }, true],
  ["department match allows", "department", { departmentId: "dept-a" }, true],
  ["vertical match allows", "vertical", { verticalId: "vertical-a" }, true],
  ["selected location allows", "selected_locations", { locationId: "location-special" }, true],
  ["selected employee allows", "selected_employees", { principalEmployeeIds: ["emp-selected"] }, true],
];

for (const [name, scope, target, expected] of scopeCases) {
  expect(name, scopeAllowsTargetV2(scope, actor, target), expected);
}

const fixedNow = new Date("2026-08-10T08:00:00.000Z");
function decide(permission, roleCode) {
  return resolveEffectivePermissionV2({
    permission,
    employeeActive: true,
    portalIdentityActive: true,
    assignments: [{ roleCode, isActive: true }],
    now: fixedNow,
  }, roleMatrixV2);
}

const claimProcessorEdit = decide("claims.edit", "claim_processor");
expect(
  "claim processor assigned claim inside scope",
  evaluateScopedAccessV2(claimProcessorEdit, actor, { assigneeEmployeeIds: ["emp-self"] }).allowed,
  true,
);
expect(
  "claim processor unassigned claim outside scope",
  evaluateScopedAccessV2(claimProcessorEdit, actor, { assigneeEmployeeIds: ["emp-other"] }).allowed,
  false,
);

const claimProcessorTaskCreate = decide("tasks.create", "claim_processor");
expect(
  "claim processor self followup inside scope",
  evaluateScopedAccessV2(claimProcessorTaskCreate, actor, { principalEmployeeIds: ["emp-self"] }).allowed,
  true,
);
expect(
  "claim processor cannot create another employee followup",
  evaluateScopedAccessV2(claimProcessorTaskCreate, actor, { principalEmployeeIds: ["emp-other"] }).allowed,
  false,
);

const salesHeadCustomerView = decide("customers.view", "sales_head");
expect(
  "sales head hierarchy customer inside scope",
  evaluateScopedAccessV2(salesHeadCustomerView, actor, { principalEmployeeIds: ["emp-child"] }).allowed,
  true,
);
expect(
  "sales head unrelated customer outside hierarchy",
  evaluateScopedAccessV2(salesHeadCustomerView, actor, { principalEmployeeIds: ["emp-other"] }).allowed,
  false,
);

const adminRoleManage = decide("admin.roles.manage", "super_admin");
expect(
  "unscoped administration permission does not require target ownership",
  evaluateScopedAccessV2(adminRoleManage, actor, { principalEmployeeIds: ["emp-other"] }).allowed,
  true,
);

// Static compatibility comparison. This does not claim full production parity:
// it compares the current code-defined legacy role capabilities only against
// the V2 permissions explicitly mapped from those capabilities. RLS, stored
// overrides and record-level scope are separate Phase 8 parity inputs.
const internalRoles = appRoles.filter((role) => role !== "customer" && role !== "intermediary");
const roleByCode = new Map(roleMatrixV2.map((role) => [role.code, role]));
const comparisonRows = [];

for (const roleCode of internalRoles) {
  const role = roleByCode.get(roleCode);
  if (!role) fail(`missing V2 role ${roleCode}`);
  const v2GrantKeys = new Set(role.grants.map((grant) => grant.permission));
  const legacyCapabilities = new Set(roleCapabilities[roleCode]);

  for (const [legacyCapability, mappedPermissions] of Object.entries(legacyCapabilityCompatibilityMap)) {
    const legacyGranted = legacyCapabilities.has(legacyCapability);
    const grantedMapped = mappedPermissions.filter((permission) => v2GrantKeys.has(permission));
    const v2Any = grantedMapped.length > 0;
    const v2All = grantedMapped.length === mappedPermissions.length;

    let classification = "retained-deny";
    if (legacyGranted && v2All) classification = "retained-grant";
    else if (legacyGranted && v2Any) classification = "narrowed";
    else if (legacyGranted && !v2Any) classification = "removed";
    else if (!legacyGranted && v2Any) classification = "expanded";

    comparisonRows.push({ roleCode, legacyCapability, mappedPermissions, grantedMapped, classification });
  }
}

const expanded = comparisonRows.filter((row) => row.classification === "expanded");
if (expanded.length) {
  fail(`unexpected mapped legacy capability expansion: ${expanded.map((row) => `${row.roleCode}:${row.legacyCapability}`).join(", ")}`);
}

const claimProcessorTasks = comparisonRows.find(
  (row) => row.roleCode === "claim_processor" && row.legacyCapability === "manage_tasks",
);
if (!claimProcessorTasks || claimProcessorTasks.classification !== "narrowed") {
  fail("Claim Processor manage_tasks must be explicitly classified as narrowed in the V2 compatibility comparison");
}
if (claimProcessorTasks.grantedMapped.includes("tasks.assign")) {
  fail("Claim Processor compatibility comparison unexpectedly includes tasks.assign");
}

const fieldExecutiveClaims = comparisonRows.find(
  (row) => row.roleCode === "field_executive" && row.legacyCapability === "view_claims",
);
if (!fieldExecutiveClaims || fieldExecutiveClaims.classification !== "retained-grant") {
  fail("Field Executive view_claims should remain granted while its record scope is narrowed separately");
}

const counts = Object.fromEntries(
  ["retained-grant", "retained-deny", "narrowed", "removed", "expanded"].map((classification) => [
    classification,
    comparisonRows.filter((row) => row.classification === classification).length,
  ]),
);

console.log(JSON.stringify({
  scopePredicateCases: scopeCases.length,
  scopedDecisionCases: 7,
  compatibilityRows: comparisonRows.length,
  compatibilityCounts: counts,
  caveat: "Static comparison covers code-defined legacy capabilities and mapped V2 grants only; production RLS, stored overrides and record ownership parity remain Phase 8 work.",
  status: "ok",
}, null, 2));
