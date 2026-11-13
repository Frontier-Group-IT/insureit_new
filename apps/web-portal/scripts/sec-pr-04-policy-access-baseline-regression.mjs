import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

// SEC-PR-04 is a baseline compatibility contract, not an authorization patch.
// Keep it in CI before any later role/Storage/RLS change is proposed.
const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const scope = read("../lib/employee-access-scope.ts");
const policy = read("../lib/policy-access-scope.ts");
const server = read("../lib/policy-access-server.ts");
const nonMotor = read("../app/policies/non-motor-policy-document-actions.ts");
const lifeHealth = read("../app/policies/life-health-issued-policy-document-actions.ts");

assert.match(scope, /const organizationWideRoles:\s*AppRole\[\]/);
for (const role of ["super_admin", "admin", "it_super_user", "it_user", "manager", "director", "sales_operations_head", "backoffice_executive", "accounts"]) {
  assert.match(scope, new RegExp('"' + role + '"'), "Preserve existing organization-scope role: " + role);
}
assert.match(scope, /getActiveEmployeePermissionOverride/, "Preserve scoped employee overrides.");
assert.match(scope, /claimsHeadClaimScope/, "Keep Claims Head organization scope confined to claims.");
assert.match(policy, /getAccessiblePolicyRmEmployeeIds/, "Keep policy-level RM scope.");
assert.match(policy, /getOperationsHeadDownlinePolicyScope/, "Keep Life/Health downline exception.");
assert.match(policy, /target\.business_line === "Life" \|\| target\.business_line === "Health"/, "Keep Life/Health vertical exception.");
assert.match(server, /getEffectivePermission\(profile\.id, profile\.role, "view_policies"\)/, "Keep operation capability checks.");
assert.match(server, /canAccessPolicy/, "Keep existing scoped-policy guard.");
assert.match(nonMotor, /requireNonMotorPolicy/, "Keep target policy type validation.");
assert.match(nonMotor, /requirePolicyCreator/, "Track creator path separately from editor.");
assert.match(nonMotor, /requirePolicyEditor/, "Track existing edit/delete authorization.");
assert.match(lifeHealth, /requirePolicyEditor\(policyId\)/, "Keep issued Life/Health policy editor gate.");
console.log("SEC-PR-04 compatibility baseline OK. No entitlement, database or Storage changes tested.");
