import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  accessLevels,
  dataScopes,
  legacyCapabilityCompatibilityMap,
  permissionCatalogueV2,
} from "../lib/access-control-catalogue-v2.ts";
import { appRoles } from "../lib/roles.ts";
import { roleMatrixV2 } from "../lib/access-control-role-matrix-v2.ts";

function fail(message) {
  throw new Error(`[access-control-v2] ${message}`);
}

const keys = permissionCatalogueV2.map((permission) => permission.key);
const uniqueKeys = new Set(keys);
if (uniqueKeys.size !== keys.length) {
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  fail(`duplicate permission keys: ${Array.from(new Set(duplicates)).join(", ")}`);
}

const permissionByKey = new Map(permissionCatalogueV2.map((permission) => [permission.key, permission]));
const validAccess = new Set(accessLevels.filter((level) => level !== "none"));
const validScopes = new Set(dataScopes);

for (const permission of permissionCatalogueV2) {
  if (!permission.key.trim()) fail("permission key cannot be blank");
  if (!permission.label.trim()) fail(`${permission.key} has a blank label`);
  if (!permission.description.trim()) fail(`${permission.key} has a blank description`);
  if (!permission.allowedAccess.length) fail(`${permission.key} must allow at least one non-none access level`);
  for (const access of permission.allowedAccess) {
    if (!validAccess.has(access)) fail(`${permission.key} contains invalid access level ${access}`);
  }
  for (const scope of permission.allowedScopes) {
    if (!validScopes.has(scope)) fail(`${permission.key} contains invalid data scope ${scope}`);
  }
  if (permission.scopeRequired && !permission.allowedScopes.length) {
    fail(`${permission.key} requires a data scope but declares none`);
  }
}

for (const [legacyCapability, mappedPermissions] of Object.entries(legacyCapabilityCompatibilityMap)) {
  if (!mappedPermissions.length) fail(`${legacyCapability} has no V2 compatibility mapping`);
  for (const permissionKey of mappedPermissions) {
    if (!uniqueKeys.has(permissionKey)) {
      fail(`${legacyCapability} maps to missing V2 permission ${permissionKey}`);
    }
  }
}

const employeeRoleCodes = appRoles.filter((role) => role !== "customer" && role !== "intermediary");
const matrixRoleCodes = roleMatrixV2.map((role) => role.code);
if (new Set(matrixRoleCodes).size !== matrixRoleCodes.length) fail("role matrix contains duplicate role codes");
for (const role of employeeRoleCodes) {
  if (!matrixRoleCodes.includes(role)) fail(`employee role ${role} is missing from the V2 role matrix`);
}
for (const role of matrixRoleCodes) {
  if (!employeeRoleCodes.includes(role)) fail(`V2 role matrix contains unexpected employee role ${role}`);
}

for (const role of roleMatrixV2) {
  if (!validScopes.has(role.defaultScope)) fail(`${role.code} has invalid default scope ${role.defaultScope}`);
  if (role.status !== "active" && role.assignable) fail(`${role.code} is ${role.status} but still assignable`);
  const grantKeys = role.grants.map((grant) => grant.permission);
  if (new Set(grantKeys).size !== grantKeys.length) fail(`${role.code} contains duplicate permission grants`);

  for (const roleGrant of role.grants) {
    const permission = permissionByKey.get(roleGrant.permission);
    if (!permission) fail(`${role.code} references missing permission ${roleGrant.permission}`);
    if (!permission.allowedAccess.includes(roleGrant.access)) {
      fail(`${role.code} requests invalid access ${roleGrant.access} for ${roleGrant.permission}`);
    }
    if (permission.scopeRequired && !roleGrant.scope) {
      fail(`${role.code} must declare a scope for ${roleGrant.permission}`);
    }
    if (roleGrant.scope && !permission.allowedScopes.includes(roleGrant.scope)) {
      fail(`${role.code} requests invalid scope ${roleGrant.scope} for ${roleGrant.permission}`);
    }
  }
}

const itSuperUser = roleMatrixV2.find((role) => role.code === "it_super_user");
if (!itSuperUser || itSuperUser.status !== "protected" || itSuperUser.assignable) {
  fail("IT Super User must remain protected and non-assignable");
}
if (itSuperUser.grants.length !== permissionCatalogueV2.length) {
  fail("IT Super User must cover every V2 permission");
}

for (const code of ["manager", "agent"]) {
  const role = roleMatrixV2.find((entry) => entry.code === code);
  if (!role || role.status !== "compatibility" || role.assignable) {
    fail(`${code} must remain a non-assignable compatibility role during migration`);
  }
}

for (const role of roleMatrixV2.filter((entry) => entry.code !== "it_super_user")) {
  if (role.grants.some((grant) => grant.permission === "system.integrations.configure")) {
    fail(`${role.code} must not receive protected integration configuration in the shadow matrix`);
  }
}

// Phase 4 database seed must remain a byte-independent semantic mirror of the
// TypeScript shadow catalogue/matrix. This checks the static migration without
// applying it to any Supabase project.
const migrationPath = resolve(
  process.cwd(),
  "../../supabase/migrations/20260810140000_access_control_v2_shadow_rbac_foundation.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

function sectionBetween(startMarker, endMarker) {
  const start = migrationSql.indexOf(startMarker);
  const end = migrationSql.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) fail(`cannot locate migration section ${startMarker}`);
  return migrationSql.slice(start, end);
}

const roleSeedSection = sectionBetween(
  "insert into public.access_roles_v2",
  "-- Canonical V2 permission catalogue.",
);
for (const role of roleMatrixV2) {
  const marker = `('${role.code}'`;
  if (!roleSeedSection.includes(marker)) fail(`Phase 4 SQL role seed is missing ${role.code}`);
}

const permissionSeedSection = sectionBetween(
  "insert into public.access_permissions_v2",
  "-- Seed role defaults from the approved Phase 3 shadow matrix.",
);
for (const permission of permissionCatalogueV2) {
  const marker = `('${permission.key}'`;
  if (!permissionSeedSection.includes(marker)) fail(`Phase 4 SQL permission seed is missing ${permission.key}`);
}

const sqlPermissionKeys = Array.from(permissionSeedSection.matchAll(/\('([^']+)'\s*,\s*'[^']+'/g), (match) => match[1]);
if (new Set(sqlPermissionKeys).size !== permissionCatalogueV2.length) {
  fail(`Phase 4 SQL permission seed count ${new Set(sqlPermissionKeys).size} does not match catalogue ${permissionCatalogueV2.length}`);
}

const grantsSection = sectionBetween(
  "with role_grants(role_code, permission_key, access_level, scope_type) as (",
  ")\ninsert into public.access_role_permissions_v2",
);
const sqlGrantMatches = Array.from(
  grantsSection.matchAll(/\('([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(null|'[^']+')\)/g),
);
const sqlGrants = new Set(
  sqlGrantMatches.map((match) => {
    const scope = match[4] === "null" ? "" : match[4].slice(1, -1);
    return `${match[1]}|${match[2]}|${match[3]}|${scope}`;
  }),
);
const matrixGrants = new Set(
  roleMatrixV2.flatMap((role) =>
    role.grants.map((entry) => `${role.code}|${entry.permission}|${entry.access}|${entry.scope ?? ""}`),
  ),
);

for (const expected of matrixGrants) {
  if (!sqlGrants.has(expected)) fail(`Phase 4 SQL grant seed is missing ${expected}`);
}
for (const actual of sqlGrants) {
  if (!matrixGrants.has(actual)) fail(`Phase 4 SQL grant seed contains unexpected grant ${actual}`);
}
if (sqlGrants.size !== matrixGrants.size) {
  fail(`Phase 4 SQL grant count ${sqlGrants.size} does not match matrix ${matrixGrants.size}`);
}

if (!migrationSql.includes("revoke all on table public.employee_role_assignments_v2 from anon, authenticated")) {
  fail("Phase 4 employee role assignment table must remain inaccessible to normal clients");
}
if (!migrationSql.includes("Phase 4 shadow foundation must not auto-assign employees")) {
  fail("Phase 4 migration is missing the no-auto-assignment invariant");
}

const criticalPermissions = permissionCatalogueV2.filter((permission) => permission.risk === "critical");
if (!criticalPermissions.length) fail("catalogue unexpectedly contains no critical permissions");

console.log(JSON.stringify({
  permissionCount: permissionCatalogueV2.length,
  legacyCapabilityCount: Object.keys(legacyCapabilityCompatibilityMap).length,
  criticalPermissionCount: criticalPermissions.length,
  roleCount: roleMatrixV2.length,
  assignableRoleCount: roleMatrixV2.filter((role) => role.assignable).length,
  sqlRoleGrantCount: sqlGrants.size,
  phase4SqlParity: "ok",
  status: "ok",
}, null, 2));
