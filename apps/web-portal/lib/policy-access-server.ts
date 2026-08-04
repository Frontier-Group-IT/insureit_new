import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getEffectivePermission, type PermissionAccess } from "@/lib/permission-management";
import { isAppRole } from "@/lib/roles";

const accessRank: Record<PermissionAccess, number> = {
  none: 0,
  view: 1,
  edit: 2,
  approve: 3,
};

export async function requirePolicyEditor() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || !isAppRole(profile.role)) redirect("/access-denied");

  const permission = await getEffectivePermission(profile.id, profile.role, "view_policies");
  if (accessRank[permission.access] < accessRank.edit) redirect("/access-denied");

  return profile;
}
