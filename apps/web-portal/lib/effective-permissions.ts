import type { Capability } from "@/lib/roles";
import { isAppRole } from "@/lib/roles";
import { getEffectivePermission, permissionDefinitions, type PermissionAccess } from "@/lib/permission-management";

export const accessRank: Record<PermissionAccess, number> = { none: 0, view: 1, edit: 2, approve: 3 };

export async function hasEffectiveCapability(
  profile: { id?: string | null; role?: string | null } | null | undefined,
  capability: Capability,
  minimumAccess?: Exclude<PermissionAccess, "none">,
) {
  if (!profile?.id || !isAppRole(profile.role)) return false;
  const permission = await getEffectivePermission(profile.id, profile.role, capability);
  const required = minimumAccess ?? permissionDefinitions.find((item) => item.capability === capability)?.roleAccess ?? "view";
  return accessRank[permission.access] >= accessRank[required];
}

export async function hasAnyEffectiveCapability(
  profile: { id?: string | null; role?: string | null } | null | undefined,
  capabilities: Capability[],
  minimumAccess?: Exclude<PermissionAccess, "none">,
) {
  for (const capability of capabilities) {
    if (await hasEffectiveCapability(profile, capability, minimumAccess)) return true;
  }
  return false;
}

export async function getEffectivePermissionAccessMap(
  profile: { id?: string | null; role?: string | null } | null | undefined,
): Promise<Partial<Record<Capability, PermissionAccess>>> {
  if (!profile?.id || !isAppRole(profile.role)) return {};
  const entries = await Promise.all(permissionDefinitions.map(async ({ capability }) => {
    const permission = await getEffectivePermission(profile.id!, profile.role as import("@/lib/roles").AppRole, capability);
    return [capability, permission.access] as const;
  }));
  return Object.fromEntries(entries) as Partial<Record<Capability, PermissionAccess>>;
}
