import type { Capability } from "@/lib/roles";
import { isAppRole } from "@/lib/roles";
import { getEffectivePermissionAccessMapForRole, permissionDefinitions, type PermissionAccess } from "@/lib/permission-management";

export const accessRank: Record<PermissionAccess, number> = { none: 0, view: 1, edit: 2, approve: 3 };
const accountsServerCapabilities = new Set<Capability>(["view_accounts", "view_reports"]);

function requiredAccess(capability: Capability, minimumAccess?: Exclude<PermissionAccess, "none">) {
  return minimumAccess ?? permissionDefinitions.find((item) => item.capability === capability)?.roleAccess ?? "view";
}

export async function hasEffectiveCapability(
  profile: { id?: string | null; role?: string | null } | null | undefined,
  capability: Capability,
  minimumAccess?: Exclude<PermissionAccess, "none">,
) {
  if (!profile?.id || !isAppRole(profile.role)) return false;
  const required = requiredAccess(capability, minimumAccess);
  if (profile.role === "accounts") {
    return accountsServerCapabilities.has(capability) && accessRank.view >= accessRank[required];
  }

  // Resolve the complete effective map once per request/render boundary. The
  // underlying loader is React-cached by (profileId, role), so multiple
  // capability checks reuse the same employee + role override reads instead of
  // issuing another pair of Supabase queries for every capability.
  const accessMap = await getEffectivePermissionAccessMapForRole(profile.id, profile.role);
  const access = accessMap[capability] ?? "none";
  return accessRank[access] >= accessRank[required];
}

export async function hasAnyEffectiveCapability(
  profile: { id?: string | null; role?: string | null } | null | undefined,
  capabilities: Capability[],
  minimumAccess?: Exclude<PermissionAccess, "none">,
) {
  if (!profile?.id || !isAppRole(profile.role)) return false;
  if (profile.role === "accounts") {
    return capabilities.some((capability) => {
      const required = requiredAccess(capability, minimumAccess);
      return accountsServerCapabilities.has(capability) && accessRank.view >= accessRank[required];
    });
  }

  const accessMap = await getEffectivePermissionAccessMapForRole(profile.id, profile.role);
  return capabilities.some((capability) => {
    const required = requiredAccess(capability, minimumAccess);
    const access = accessMap[capability] ?? "none";
    return accessRank[access] >= accessRank[required];
  });
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
