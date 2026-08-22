import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getEffectivePermission, type PermissionAccess } from "@/lib/permission-management";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { isAppRole } from "@/lib/roles";

const accessRank: Record<PermissionAccess, number> = {
  none: 0,
  view: 1,
  edit: 2,
  approve: 3,
};

async function authenticatedPolicyProfile() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || !isAppRole(profile.role)) redirect("/access-denied");
  return profile;
}

export async function requirePolicyCreator() {
  const profile = await authenticatedPolicyProfile();
  const legacy = await getEffectivePermission(profile.id, profile.role, "view_policies");
  const createOnly = await hasEffectiveCapability(profile, "create_policies", "edit");
  if (accessRank[legacy.access] < accessRank.edit && !createOnly) redirect("/access-denied");
  return profile;
}

export async function requireExternalPolicyCreator() {
  const profile = await authenticatedPolicyProfile();
  const legacy = await getEffectivePermission(profile.id, profile.role, "view_policies");
  const createOnly = await hasEffectiveCapability(profile, "create_external_policies", "edit");
  if (accessRank[legacy.access] < accessRank.edit && !createOnly) redirect("/access-denied");
  return profile;
}

export async function requirePolicyEditor() {
  const profile = await authenticatedPolicyProfile();
  const permission = await getEffectivePermission(profile.id, profile.role, "view_policies");
  if (accessRank[permission.access] < accessRank.edit) redirect("/access-denied");
  return profile;
}
