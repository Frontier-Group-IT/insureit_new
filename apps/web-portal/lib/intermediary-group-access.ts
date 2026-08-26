import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getEmployeeAccessScope, type EmployeeAccessScope } from "@/lib/employee-access-scope";
import { hasAnyEffectiveCapability, hasEffectiveCapability } from "@/lib/effective-permissions";
import type { AppRole, Capability } from "@/lib/roles";

const groupManagerRoles = new Set<AppRole>([
  "super_admin",
  "admin",
  "it_super_user",
  "manager",
  "sales_operations_head",
  "sales_head",
  "zonal_head",
  "asm",
  "sales_manager",
  "relationship_manager",
]);

const groupTransferRoles = new Set<AppRole>([
  "super_admin",
  "admin",
  "it_super_user",
  "manager",
  "sales_operations_head",
  "sales_head",
  "zonal_head",
  "asm",
  "sales_manager",
]);

const groupMutationCapabilities: Capability[] = [
  "create_intermediary_application",
  "review_intermediary_application",
];

type GroupProfile = {
  id: string;
  role: AppRole;
  employee_id?: string | null;
};

export async function getIntermediaryGroupViewer() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !profile.role || !(await hasEffectiveCapability(profile, "view_intermediaries"))) return null;
  return profile as GroupProfile;
}

export async function requireIntermediaryGroupViewer() {
  const profile = await getIntermediaryGroupViewer();
  if (!profile) redirect("/access-denied");
  return profile;
}

export async function getIntermediaryGroupManager() {
  const profile = await getIntermediaryGroupViewer();
  if (!profile || !groupManagerRoles.has(profile.role)) return null;
  const canChangeIntermediaryStructure = await hasAnyEffectiveCapability(profile, groupMutationCapabilities, "edit");
  return canChangeIntermediaryStructure ? profile : null;
}

export async function requireIntermediaryGroupManager() {
  const profile = await getIntermediaryGroupManager();
  if (!profile) redirect("/access-denied");
  return profile;
}

export async function getIntermediaryGroupTransferManager() {
  const profile = await getIntermediaryGroupManager();
  return profile && groupTransferRoles.has(profile.role) ? profile : null;
}

export async function requireIntermediaryGroupTransferManager() {
  const profile = await getIntermediaryGroupTransferManager();
  if (!profile) redirect("/access-denied");
  return profile;
}

export async function getIntermediaryGroupEmployeeScope(profile: GroupProfile) {
  return getEmployeeAccessScope(profile.id, profile.role, "view_intermediaries");
}

export async function canAccessIntermediaryGroupOwner(profile: GroupProfile, ownerEmployeeId: string) {
  const viewScope = await getEmployeeAccessScope(profile.id, profile.role, "view_intermediaries");
  if (!scopeIncludesEmployee(viewScope, ownerEmployeeId)) return false;

  const mutationScopes: EmployeeAccessScope[] = [];
  for (const capability of groupMutationCapabilities) {
    if (await hasEffectiveCapability(profile, capability, "edit")) {
      mutationScopes.push(await getEmployeeAccessScope(profile.id, profile.role, capability));
    }
  }

  return mutationScopes.some((scope) => scopeIncludesEmployee(scope, ownerEmployeeId));
}

export function canTransferIntermediaryGroups(role: string | null | undefined) {
  return groupTransferRoles.has(role as AppRole);
}

function scopeIncludesEmployee(scope: EmployeeAccessScope, employeeId: string) {
  return scope.mode === "organization" || scope.employeeIds.includes(employeeId);
}
