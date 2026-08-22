import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { roleCapabilities } from "../lib/roles.ts";
import { resolveEffectivePermissionV2 } from "../lib/access-control-effective-v2.ts";
import { roleMatrixV2 } from "../lib/access-control-role-matrix-v2.ts";

function fail(message) {
  throw new Error(`[backoffice-data-entry] ${message}`);
}
function expect(condition, message) {
  if (!condition) fail(message);
}
function source(path) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const expectedLegacyCapabilities = new Set([
  "view_dashboard",
  "view_customers",
  "create_customers",
  "view_vehicles",
  "create_vehicles",
  "view_policies",
  "create_policies",
  "create_external_policies",
  "view_reports",
  "view_notifications",
]);
const actualLegacyCapabilities = new Set(roleCapabilities.backoffice_executive);
expect(actualLegacyCapabilities.size === expectedLegacyCapabilities.size, "Backoffice role must not inherit unrelated legacy capabilities.");
for (const capability of expectedLegacyCapabilities) expect(actualLegacyCapabilities.has(capability), `Backoffice role is missing ${capability}.`);
for (const capability of actualLegacyCapabilities) expect(expectedLegacyCapabilities.has(capability), `Backoffice role unexpectedly grants ${capability}.`);

const fixedNow = new Date("2026-08-22T10:00:00.000Z");
function decide(permission, overrides = []) {
  return resolveEffectivePermissionV2({
    permission,
    employeeActive: true,
    portalIdentityActive: true,
    assignments: [{ roleCode: "backoffice_executive", isActive: true }],
    overrides,
    now: fixedNow,
  }, roleMatrixV2);
}
for (const [permission, access] of [
  ["customers.view", "view"],
  ["customers.create", "edit"],
  ["vehicles.view", "view"],
  ["vehicles.create", "edit"],
  ["policies.view", "view"],
  ["policies.create", "edit"],
  ["reports.view", "view"],
]) {
  const decision = decide(permission);
  expect(decision.allowed && decision.access === access, `V2 Backoffice baseline must allow ${permission} at ${access}.`);
}
for (const permission of [
  "customers.edit",
  "kyc.view",
  "kyc.review",
  "vehicles.edit",
  "policies.edit",
  "claims.view",
  "intermediaries.view",
  "tasks.view",
  "admin.portal_users.manage",
  "master_data.manage",
  "system.manage",
]) {
  expect(!decide(permission).allowed, `V2 Backoffice ceiling must deny ${permission}.`);
}
expect(!decide("customers.edit", [{ permission: "customers.edit", access: "approve", scope: "organization", isActive: true }]).allowed, "A V2 employee override must not elevate Backoffice into existing-customer editing.");
expect(decide("customers.create", [{ permission: "customers.create", access: "approve", scope: "organization", isActive: true }]).access === "edit", "A V2 override must be capped at Backoffice create access.");

const permissionManagement = source("lib/permission-management.ts");
expect(permissionManagement.includes("backofficePermissionCeiling"), "Runtime permission management must define a Backoffice ceiling.");
for (const forbidden of ["manage_customers", "view_kyc", "review_kyc", "manage_tasks", "view_intermediaries", "manage_users", "manage_master_data", "manage_system"]) {
  const ceilingBlock = permissionManagement.slice(permissionManagement.indexOf("const backofficePermissionCeiling"), permissionManagement.indexOf("const accessRank"));
  expect(!ceilingBlock.includes(`${forbidden}:`), `Runtime Backoffice ceiling must not allow ${forbidden}.`);
}

const customerEntry = source("app/customers/data-entry/actions.ts");
expect(customerEntry.includes('requireCapability("create_customers", "edit")'), "Customer data entry must require create_customers.");
expect(customerEntry.includes('onboarding_status: "pending_kyc"'), "Backoffice customer creation must stay pending KYC.");
expect(!customerEntry.includes("auth.admin.createUser"), "Backoffice customer creation must not create a portal identity.");
expect(!customerEntry.includes("customer_documents"), "Backoffice customer creation must not verify or persist KYC documents.");
expect(!customerEntry.includes("aadhaar_hash"), "Backoffice customer creation must not handle Aadhaar identity data.");

const vehicleActions = source("app/vehicles/vehicle-master-actions.ts");
expect(vehicleActions.includes('capability: "create_vehicles"'), "Vehicle creation must support the create-only vehicle permission.");
expect(vehicleActions.includes('requireCapability("view_vehicles", "edit")'), "Existing vehicle updates must still require edit authority.");

const policyAccess = source("lib/policy-access-server.ts");
expect(policyAccess.includes("requirePolicyCreator"), "Managed policy creation must have a dedicated create guard.");
expect(policyAccess.includes("requireExternalPolicyCreator"), "External policy creation must have a dedicated create guard.");
expect(policyAccess.includes('getEffectivePermission(profile.id, profile.role, "view_policies")'), "Existing policy editing must continue to use the established edit permission.");

const onboardingActions = source("app/policies/policy-onboarding-actions.ts");
expect(onboardingActions.includes("operationalEntryPayload(payload, profile.role)"), "Policy onboarding must sanitize Backoffice financial fields before validation and persistence.");
for (const marker of [
  'payin: { basis: "NET", odPercent: "0", tpPercent: "0", scheme: "0" }',
  'billing: { billNumber: "", billedAmount: "0", billDate: "", status: "Unbilled" }',
  'payout: { retention: "0", odPercent: "0", tpPercent: "0", status: "Pending", date: "", voucherNumber: "" }',
]) expect(onboardingActions.includes(marker), `Backoffice policy sanitizer is missing ${marker}.`);

const financePage = source("app/reports/finance/page.tsx");
const financeExport = source("app/reports/export/finance/route.ts");
expect(financePage.includes('profile.role==="backoffice_executive"') && financePage.includes('redirect("/access-denied")'), "Finance report UI must deny Backoffice directly.");
expect(financeExport.includes('profile.role==="backoffice_executive"'), "Finance export must deny Backoffice directly.");

const managementPack = source("lib/reports/management-pack.ts");
expect(managementPack.includes('profile.role === "backoffice_executive"'), "Management-pack loader must deny Backoffice before loading finance/payout/governance data.");

const reportNavigation = source("components/reports/report-navigation.tsx");
expect(reportNavigation.includes('["business", "portfolio", "operations"]'), "Backoffice report navigation must be limited to operational workspaces.");
expect(reportNavigation.includes('route === "/reports/business"'), "Backoffice Business navigation must hide Distribution and Finance sections.");

console.log("Backoffice data-entry security regression passed.");
