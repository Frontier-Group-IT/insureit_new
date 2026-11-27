import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const roles = await read("../lib/roles.ts");
const matrix = await read("../lib/access-control-role-matrix-v2.ts");
const policies = await read("../app/policies/page.tsx");
const navigation = await read("../components/claim-manager/app-navigation.tsx");
const scope = await read("../lib/policy-access-scope.ts");
const employeeScope = await read("../lib/employee-access-scope.ts");

for (const role of ["relationship_manager", "sales_manager", "asm", "zonal_head", "sales_head"]) {
  const roleLine = roles.split("\n").find(line => line.trim().startsWith(role + ":["));
  assert.ok(roleLine, "Expected role " + role);
  assert.match(roleLine, /"view_policies"/, role + " must have read access to Policy Register");
  const roleBlock = matrix.match(new RegExp('code: "' + role + '"[\\s\\S]*?(?=\\n  \\{|\\n\\];)'))?.[0];
  assert.ok(roleBlock, "Missing v2 role " + role);
  const expectedScope = role === "relationship_manager" ? "self" : "hierarchy";
  assert.ok(roleBlock.includes('grant("policies.view", "view", "' + expectedScope + '")'), role + " should receive only " + expectedScope + "-scoped view");
  assert.ok(!roleBlock.includes('grant("policies.edit"'), role + " must not gain edit authority");
}
assert.match(policies, /requireCapability\("view_policies"\)/);
assert.match(navigation, /href:"\/policies",label:"Policy Register"[^\]]*capability:"view_policies"/);
assert.match(scope, /getEmployeeAccessScope\(profileId, role, capability\)/);
assert.match(employeeScope, /const hierarchyRoles: AppRole\[\] = \["sales_head", "zonal_head", "asm", "sales_manager"\]/);
console.log("Policy Register sales hierarchy permission regression passed.");
