import type { Capability } from "@/lib/roles";
import { isAppRole } from "@/lib/roles";
import { getEffectivePermission } from "@/lib/permission-management";

export async function hasEffectiveCapability(profile: { id?: string | null; role?: string | null } | null | undefined, capability: Capability) {
  if (!profile?.id || !isAppRole(profile.role)) return false;
  const permission = await getEffectivePermission(profile.id, profile.role, capability);
  return permission.access !== "none";
}

export async function hasAnyEffectiveCapability(profile: { id?: string | null; role?: string | null } | null | undefined, capabilities: Capability[]) {
  for (const capability of capabilities) {
    if (await hasEffectiveCapability(profile, capability)) return true;
  }
  return false;
}
