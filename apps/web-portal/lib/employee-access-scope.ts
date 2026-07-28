import type { AppRole } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const organizationWideRoles: AppRole[] = [
  "super_admin", "admin", "it_super_user", "manager", "director", "sales_operations_head", "backoffice_executive",
];
const hierarchyRoles: AppRole[] = ["sales_head", "zonal_head", "asm", "sales_manager"];

type EmployeeLink = { id: string; reporting_manager_id: string | null };
type ProfileLink = { id: string; employee_id: string | null };
type ApplicationLink = { application_id: string };
type IntermediaryLink = { id: string; application_id: string | null };

export type EmployeeAccessScope = {
  mode: "organization" | "hierarchy" | "self" | "none";
  employeeIds: string[];
  profileIds: string[];
};

export async function getEmployeeAccessScope(profileId: string, role: string | null | undefined): Promise<EmployeeAccessScope> {
  if (organizationWideRoles.includes(role as AppRole)) return { mode: "organization", employeeIds: [], profileIds: [] };

  const admin = createSupabaseAdminClient();
  const { data: currentProfile } = await admin.from("profiles").select("id,employee_id").eq("id", profileId).maybeSingle<ProfileLink>();
  if (!currentProfile?.employee_id) return { mode: "none", employeeIds: [], profileIds: [profileId] };

  let employeeIds = [currentProfile.employee_id];
  let mode: EmployeeAccessScope["mode"] = "self";
  if (hierarchyRoles.includes(role as AppRole)) {
    const { data: employees } = await admin.from("employees").select("id,reporting_manager_id").eq("employment_status", "active").returns<EmployeeLink[]>();
    employeeIds = descendantIds(currentProfile.employee_id, employees ?? []);
    mode = "hierarchy";
  }

  const { data: profiles } = employeeIds.length
    ? await admin.from("profiles").select("id,employee_id").in("employee_id", employeeIds).eq("is_active", true).returns<ProfileLink[]>()
    : { data: [] as ProfileLink[] };
  const profileIds = Array.from(new Set([profileId, ...(profiles ?? []).map((profile) => profile.id)]));
  return { mode, employeeIds, profileIds };
}

export async function getAccessibleIntermediaryApplicationIds(profileId: string, role: string | null | undefined) {
  const scope = await getEmployeeAccessScope(profileId, role);
  if (scope.mode === "organization") return null;
  if (!scope.employeeIds.length && !scope.profileIds.length) return [];

  const admin = createSupabaseAdminClient();
  const filters: string[] = [];
  if (scope.profileIds.length) filters.push(`associate_profile_id.in.(${scope.profileIds.join(",")})`);
  if (scope.employeeIds.length) filters.push(`associate_employee_id.in.(${scope.employeeIds.join(",")})`);
  const request = admin.from("posp_misp_onboarding_profiles").select("application_id");
  const { data } = await request.or(filters.join(",")).returns<ApplicationLink[]>();
  return Array.from(new Set((data ?? []).map((row) => row.application_id).filter(Boolean)));
}

export async function getAccessibleIntermediaryIds(profileId: string, role: string | null | undefined) {
  const applicationIds = await getAccessibleIntermediaryApplicationIds(profileId, role);
  if (applicationIds === null) return null;
  if (!applicationIds.length) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("intermediaries").select("id,application_id").in("application_id", applicationIds).returns<IntermediaryLink[]>();
  return Array.from(new Set((data ?? []).map((row) => row.id)));
}

export async function canAccessIntermediaryApplication(profileId: string, role: string | null | undefined, applicationId: string) {
  const ids = await getAccessibleIntermediaryApplicationIds(profileId, role);
  return ids === null || ids.includes(applicationId);
}

export async function canAccessIntermediary(profileId: string, role: string | null | undefined, intermediaryId: string) {
  const ids = await getAccessibleIntermediaryIds(profileId, role);
  return ids === null || ids.includes(intermediaryId);
}

export async function isEmployeeWithinAccessScope(profileId: string, role: string | null | undefined, employeeId: string) {
  const scope = await getEmployeeAccessScope(profileId, role);
  return scope.mode === "organization" || scope.employeeIds.includes(employeeId);
}

function descendantIds(rootId: string, employees: EmployeeLink[]) {
  const children = new Map<string, string[]>();
  for (const employee of employees) {
    if (!employee.reporting_manager_id) continue;
    const list = children.get(employee.reporting_manager_id) ?? [];
    list.push(employee.id);
    children.set(employee.reporting_manager_id, list);
  }
  const result: string[] = [];
  const queue = [rootId];
  const visited = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    result.push(id);
    queue.push(...(children.get(id) ?? []));
  }
  return result;
}
