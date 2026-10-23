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
  const role = profile?.role;
  if (!profile?.id || !isAppRole(role)) redirect("/access-denied");
  return { ...profile, role };
}

export async function requirePolicyCreator(sourceCode?: string) {
  const profile = await authenticatedPolicyProfile();
  if (profile.role === "operations_head_life") {
    if (!sourceCode) redirect("/access-denied");
    const { getOperationsHeadDownlinePolicyScope } = await import("@/lib/policy-access-scope");
    const scope = await getOperationsHeadDownlinePolicyScope(profile.id);
    if (!scope.intermediaryCodes.includes(sourceCode.trim())) redirect("/access-denied");
    return profile;
  }
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

export async function requirePolicyEditor(policyId?: string) {
  const profile = await authenticatedPolicyProfile();
  if (profile.role === "operations_head_life") {
    if (!policyId) redirect("/access-denied");
    const { canAccessPolicy } = await import("@/lib/policy-access-scope");
    if (!(await canAccessPolicy(profile.id, profile.role, policyId))) redirect("/access-denied");
    return profile;
  }
  const permission = await getEffectivePermission(profile.id, profile.role, "view_policies");
  if (accessRank[permission.access] < accessRank.edit) redirect("/access-denied");
  return profile;
}
