import {
  permissionCatalogueV2,
  permissionsForLegacyCapability,
} from "../lib/access-control-catalogue-v2.ts";
import {
  appRoles,
  hasCapability,
  roleCapabilities,
} from "../lib/roles.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function fail(message) {
  throw new Error(`[assistant-permissions] ${message}`);
}

const internalRoles = appRoles.filter((role) => role !== "customer" && role !== "intermediary");
for (const role of internalRoles) {
  if (!hasCapability(role, "use_assistant")) fail(`${role} must receive the internal assistant pilot grant`);
}
for (const role of ["customer", "intermediary"]) {
  if (hasCapability(role, "use_assistant")) fail(`${role} must not receive internal assistant access`);
}
for (const role of appRoles) {
  const expected = role === "it_super_user";
  if (hasCapability(role, "manage_assistant_knowledge") !== expected) {
    fail(`${role} has an unsafe assistant knowledge management default`);
  }
}

const permissionManagementSource = readFileSync(resolve(process.cwd(), "lib/permission-management.ts"), "utf8");
if (!permissionManagementSource.includes('use_assistant: { module: "Assistant"')) {
  fail("use_assistant is missing from the authoritative permission catalogue");
}
if (!permissionManagementSource.includes('manage_assistant_knowledge: { module: "Assistant"')) {
  fail("manage_assistant_knowledge is missing from the authoritative permission catalogue");
}
if (!permissionManagementSource.includes('capability === "use_assistant" ? "view"')) {
  fail("assistant use must be explicitly classified as view-level access");
}

for (const capability of ["use_assistant", "manage_assistant_knowledge"]) {
  const shadowKeys = permissionsForLegacyCapability(capability);
  if (shadowKeys.length !== 1 || !permissionCatalogueV2.some((entry) => entry.key === shadowKeys[0])) {
    fail(`${capability} is missing its shadow V2 catalogue entry`);
  }
}

if (!roleCapabilities.it_super_user.includes("manage_assistant_knowledge")) {
  fail("IT Super User must explicitly retain assistant knowledge management");
}

console.log(JSON.stringify({
  internalPilotRoles: internalRoles.length,
  externalRolesDenied: 2,
  managementRoles: ["it_super_user"],
  shadowCatalogueOnly: true,
  status: "ok",
}, null, 2));
