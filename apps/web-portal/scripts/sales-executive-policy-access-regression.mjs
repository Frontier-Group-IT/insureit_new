import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { roleCapabilities, roleLabels } from "../lib/roles.ts";
import { roleMatrixV2 } from "../lib/access-control-role-matrix-v2.ts";

function fail(message) {
  throw new Error(`[sales-executive-access] ${message}`);
}

const expectedCapabilities = ["view_policies", "view_policy_intakes", "create_policy_intakes"];
if (JSON.stringify(roleCapabilities.sales_executive) !== JSON.stringify(expectedCapabilities)) {
  fail(`unexpected legacy capability set: ${JSON.stringify(roleCapabilities.sales_executive)}`);
}
if (roleLabels.sales_executive !== "Sales Executive") fail("role label is missing");

const role = roleMatrixV2.find((entry) => entry.code === "sales_executive");
if (!role || !role.assignable || role.defaultScope !== "self") fail("V2 role baseline is invalid");
const grants = role.grants.map((grant) => `${grant.permission}|${grant.access}|${grant.scope ?? ""}`);
for (const expected of ["policies.view|view|self", "policy_intakes.view|view|self", "policy_intakes.create|edit|self"]) {
  if (!grants.includes(expected)) fail(`missing V2 grant ${expected}`);
}
if (grants.length !== 3) fail("Sales Executive gained an unexpected V2 permission");

const navigation = readFileSync(resolve(process.cwd(), "components/claim-manager/app-navigation.tsx"), "utf8");
for (const required of ['role==="sales_executive"', 'item.href==="/policies"', 'item.href==="/policy-intakes"', 'item.href==="/policy-intakes/new"']) {
  if (!navigation.includes(required)) fail(`sidebar restriction missing ${required}`);
}

const policyPage = readFileSync(resolve(process.cwd(), "app/policies/page.tsx"), "utf8");
if (!policyPage.includes('profile.role === "sales_executive"')) fail("Policy Register lacks Sales Executive branch");
if (!policyPage.includes("getSalesExecutivePolicyIds(profile.id)")) fail("Policy Register is not scoped by own intake lineage");
if (!policyPage.includes("<BackofficePolicyRegister")) fail("Sales Executive Policy Register must remain read-only");

const policyScope = readFileSync(resolve(process.cwd(), "lib/policy-access-scope.ts"), "utf8");
if (!policyScope.includes('.eq("submitted_by_profile_id", profileId)')) fail("detail authorization is not tied to submitter");
if (!policyScope.includes('.eq("final_policy_id", policyId)')) fail("detail authorization is not tied to finalized policy");

const intakeServer = readFileSync(resolve(process.cwd(), "lib/policy-intake-server.ts"), "utf8");
const intakeActions = readFileSync(resolve(process.cwd(), "app/policy-intakes/actions.ts"), "utf8");
if (!intakeServer.includes('"create_policy_intakes"')) fail("intake source loading must use intake creation scope");
if (!intakeActions.includes('"create_policy_intakes"')) fail("intake submission must validate source using intake creation scope");

const middleware = readFileSync(resolve(process.cwd(), "middleware.ts"), "utf8");
if (!middleware.includes("isSalesExecutivePortalPath")) fail("route restriction helper missing");
if (!middleware.includes('check.role === "sales_executive"')) fail("Sales Executive route restriction missing");

const migration = readFileSync(resolve(process.cwd(), "../../supabase/migrations/20260921131500_add_sales_executive_app_role.sql"), "utf8");
if (!migration.includes("add value if not exists 'sales_executive'")) fail("database enum migration missing");

console.log(JSON.stringify({
  role: "sales_executive",
  sidebar: ["Policy Register", "Policy Intakes", "New Policy Intake"],
  directAddPolicy: false,
  policyVisibility: "own finalized Policy Intakes only",
  status: "ok",
}, null, 2));
