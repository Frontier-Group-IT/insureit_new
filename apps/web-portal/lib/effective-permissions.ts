import type { Capability } from "@/lib/roles";
import { isAppRole } from "@/lib/roles";
import { getEffectivePermission, getEffectivePermissionAccessMapForRole, permissionDefinitions, type PermissionAccess } from "@/lib/permission-management";

export const accessRank: Record<PermissionAccess, number> = { none: 0, view: 1, edit: 2, approve: 3 };
const accountsServerCapabilities = new Set<Capability>(["view_accounts", "view_reports"]);

export async function hasEffectiveCapability(
  profile: { id?: string | null; role?: string | null } | null | undefined,
  capability: Capability,
  minimumAccess?: Exclude<PermissionAccess, "none">,
) {
  if (!profile?.id || !isAppRole(profile.role)) return false;
  if (profile.role === "accounts") {
    const required = minimumAccess ?? permissionDefinitions.find((item) => item.capability === capability)?.roleAccess ?? "view";
    return accountsServerCapabilities.has(capability) && accessRank.view >= accessRank[required];
  }
  const permission = await getEffectivePermission(profile.id, profile.role, capability);
  const required = minimumAccess ?? permissionDefinitions.find((item) => item.capability === capability)?.roleAccess ?? "view";
  return accessRank[permission.access] >= accessRank[required];
}

export async function hasAnyEffectiveCapability(
  profile: { id?: string | null; role?: string | null } | null | undefined,
  capabilities: Capability[],
  minimumAccess?: Exclude<PermissionAccess, "none">,
) {
  const checks = await Promise.all(capabilities.map((capability) => hasEffectiveCapability(profile, capability, minimumAccess)));
  return checks.some(Boolean);
}

export async function getEffectivePermissionAccessMap(
  profile: { id?: string | null; role?: string | null } | null | undefined,
): Promise<Partial<Record<Capability, PermissionAccess>>> {
  if (!profile?.id || !isAppRole(profile.role)) return {};
  // Accounts is deliberately UI-scoped to the Accounts workspace only. The
  // server-only view_reports allowance above exists solely for Accounts Reports
  // routes, which are independently constrained by middleware.
  if (profile.role === "accounts") return { view_accounts: "view" };
  return getEffectivePermissionAccessMapForRole(profile.id, profile.role);
}
