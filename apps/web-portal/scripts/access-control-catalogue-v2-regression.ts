import {
  accessLevels,
  dataScopes,
  legacyCapabilityCompatibilityMap,
  permissionCatalogueV2,
} from "../lib/access-control-catalogue-v2.ts";

function fail(message: string): never {
  throw new Error(`[access-control-v2] ${message}`);
}

const keys = permissionCatalogueV2.map((permission) => permission.key);
const uniqueKeys = new Set(keys);
if (uniqueKeys.size !== keys.length) {
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);
  fail(`duplicate permission keys: ${Array.from(new Set(duplicates)).join(", ")}`);
}

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

const criticalPermissions = permissionCatalogueV2.filter((permission) => permission.risk === "critical");
if (!criticalPermissions.length) fail("catalogue unexpectedly contains no critical permissions");

console.log(
  JSON.stringify(
    {
      permissionCount: permissionCatalogueV2.length,
      legacyCapabilityCount: Object.keys(legacyCapabilityCompatibilityMap).length,
      criticalPermissionCount: criticalPermissions.length,
      status: "ok",
    },
    null,
    2,
  ),
);
