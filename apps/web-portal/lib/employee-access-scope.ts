import type { AppRole, Capability } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { cache } from "react";

const organizationWideRoles: AppRole[] = [
  "super_admin", "admin", "it_super_user", "manager", "director", "sales_operations_head", "backoffice_executive",
];
const hierarchyRoles: AppRole[] = ["sales_head", "zonal_head", "asm", "sales_manager"];

type EmployeeLink = { id: string; reporting_manager_id: string | null };
type ProfileLink = { id: string; employee_id: string | null };
type ApplicationLink = { application_id: string };
type IntermediaryLink = {
  id: string;
  application_id: string | null;
  intermediary_code?: string | null;
  associate_employee_id?: string | null;
  associate_profile_id?: string | null;
};
type ImportRowLink = { import_batch_id: string; normalized_data: Record<string, unknown> | null };
type CustomerLink = { id: string };
type CustomerIdLink = { customer_id: string };
type ScopeOverride = { scope_type: string; expires_at: string | null };

export type EmployeeAccessScope = {
  mode: "organization" | "hierarchy" | "self" | "none";
  employeeIds: string[];
  profileIds: string[];
};

export const getEmployeeAccessScope = cache(async (profileId: string, role: string | null | undefined, capability?: Capability): Promise<EmployeeAccessScope> => {
  const admin = createSupabaseAdminClient();
  let requestedMode: EmployeeAccessScope["mode"] = organizationWideRoles.includes(role as AppRole)
    ? "organization"
    : hierarchyRoles.includes(role as AppRole)
      ? "hierarchy"
      : "self";

  if (capability) {
    const { data: override } = await admin
      .from("employee_permission_overrides")
      .select("scope_type,expires_at")
      .eq("profile_id", profileId)
      .eq("capability", capability)
      .maybeSingle<ScopeOverride>();
    const valid = override && (!override.expires_at || new Date(override.expires_at).getTime() > Date.now());
    if (valid && override.scope_type !== "inherit") {
      requestedMode = override.scope_type === "organization" ? "organization" : override.scope_type === "hierarchy" ? "hierarchy" : "self";
    }
  }

  if (requestedMode === "organization") return { mode: "organization", employeeIds: [], profileIds: [] };

  const { data: currentProfile } = await admin.from("profiles").select("id,employee_id").eq("id", profileId).maybeSingle<ProfileLink>();
  if (!currentProfile?.employee_id) return { mode: "none", employeeIds: [], profileIds: [profileId] };

  let employeeIds = [currentProfile.employee_id];
  if (requestedMode === "hierarchy") {
    const { data: employees } = await admin.from("employees").select("id,reporting_manager_id").eq("employment_status", "active").returns<EmployeeLink[]>();
    employeeIds = descendantIds(currentProfile.employee_id, employees ?? []);
  }

  const { data: profiles } = employeeIds.length
    ? await admin.from("profiles").select("id,employee_id").in("employee_id", employeeIds).eq("is_active", true).returns<ProfileLink[]>()
    : { data: [] as ProfileLink[] };
  const profileIds = Array.from(new Set([profileId, ...(profiles ?? []).map((profile) => profile.id)]));
  return { mode: requestedMode, employeeIds, profileIds };
});

export async function getAccessibleCustomerIds(profileId: string, role: string | null | undefined, capability: Capability = "view_customers") {
  const scope = await getEmployeeAccessScope(profileId, role, capability);
  if (scope.mode === "organization") return null;
  if (!scope.profileIds.length && !scope.employeeIds.length) return [];

  const admin = createSupabaseAdminClient();
  const customerIds = new Set<string>();

  if (scope.profileIds.length) {
    const filters = [
      `created_by.in.(${scope.profileIds.join(",")})`,
      `assigned_agent_id.in.(${scope.profileIds.join(",")})`,
    ];
    const { data } = await admin.from("customers").select("id").or(filters.join(",")).returns<CustomerLink[]>();
    for (const row of data ?? []) if (row.id) customerIds.add(row.id);
  }

  const intermediaryIds = await getAccessibleIntermediaryIds(profileId, role, capability);
  if (intermediaryIds?.length) {
    const [{ data: customerLinks }, { data: intermediaries }] = await Promise.all([
      admin
        .from("intermediary_customer_links")
        .select("customer_id")
        .in("intermediary_id", intermediaryIds)
        .returns<CustomerIdLink[]>(),
      admin
        .from("intermediaries")
        .select("id,application_id,intermediary_code")
        .in("id", intermediaryIds)
        .returns<IntermediaryLink[]>(),
    ]);

    for (const row of customerLinks ?? []) if (row.customer_id) customerIds.add(row.customer_id);

    const intermediaryCodes = Array.from(new Set(
      (intermediaries ?? []).map((row) => row.intermediary_code).filter((code): code is string => Boolean(code))
    ));
    if (intermediaryCodes.length) {
      const { data: policyCustomers } = await admin
        .from("policies")
        .select("customer_id")
        .in("intermediary_code", intermediaryCodes)
        .returns<CustomerIdLink[]>();
      for (const row of policyCustomers ?? []) if (row.customer_id) customerIds.add(row.customer_id);
    }
  }

  return Array.from(customerIds);
}

export async function getAccessibleIntermediaryApplicationIds(profileId: string, role: string | null | undefined, capability: Capability = "view_intermediaries") {
  const scope = await getEmployeeAccessScope(profileId, role, capability);
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

export async function getAccessibleImportBatchIds(profileId: string, role: string | null | undefined, capability: Capability = "view_intermediaries") {
  const scope = await getEmployeeAccessScope(profileId, role, capability);
  if (scope.mode === "organization") return null;
  if (!scope.employeeIds.length && !scope.profileIds.length) return [];

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("posp_misp_import_rows")
    .select("import_batch_id,normalized_data")
    .returns<ImportRowLink[]>();

  const employeeIds = new Set(scope.employeeIds);
  const profileIds = new Set(scope.profileIds);
  return Array.from(new Set((data ?? []).filter((row) => {
    const employeeId = stringValue(row.normalized_data?.associate_employee_id);
    const profileIdValue = stringValue(row.normalized_data?.associate_profile_id);
    return Boolean((employeeId && employeeIds.has(employeeId)) || (profileIdValue && profileIds.has(profileIdValue)));
  }).map((row) => row.import_batch_id)));
}

export async function getAccessibleIntermediaryIds(profileId: string, role: string | null | undefined, capability: Capability = "view_intermediaries") {
  const scope = await getEmployeeAccessScope(profileId, role, capability);
  if (scope.mode === "organization") return null;
  if (!scope.employeeIds.length && !scope.profileIds.length) return [];

  const admin = createSupabaseAdminClient();
  const intermediaryIds = new Set<string>();
  const directFilters: string[] = [];
  if (scope.profileIds.length) directFilters.push(`associate_profile_id.in.(${scope.profileIds.join(",")})`);
  if (scope.employeeIds.length) directFilters.push(`associate_employee_id.in.(${scope.employeeIds.join(",")})`);

  if (directFilters.length) {
    const { data: directIntermediaries } = await admin
      .from("intermediaries")
      .select("id,application_id,associate_employee_id,associate_profile_id")
      .or(directFilters.join(","))
      .returns<IntermediaryLink[]>();
    for (const row of directIntermediaries ?? []) if (row.id) intermediaryIds.add(row.id);
  }

  const applicationIds = await getAccessibleIntermediaryApplicationIds(profileId, role, capability);
  if (applicationIds?.length) {
    const { data: applicationIntermediaries } = await admin
      .from("intermediaries")
      .select("id,application_id")
      .in("application_id", applicationIds)
      .returns<IntermediaryLink[]>();
    for (const row of applicationIntermediaries ?? []) if (row.id) intermediaryIds.add(row.id);
  }

  return Array.from(intermediaryIds);
}

export async function canAccessCustomer(profileId: string, role: string | null | undefined, customerId: string, capability: Capability = "view_customers") {
  const ids = await getAccessibleCustomerIds(profileId, role, capability);
  return ids === null || ids.includes(customerId);
}

export async function canAccessIntermediaryApplication(profileId: string, role: string | null | undefined, applicationId: string, capability: Capability = "view_intermediaries") {
  const ids = await getAccessibleIntermediaryApplicationIds(profileId, role, capability);
  return ids === null || ids.includes(applicationId);
}

export async function canAccessImportBatch(profileId: string, role: string | null | undefined, batchId: string, capability: Capability = "view_intermediaries") {
  const ids = await getAccessibleImportBatchIds(profileId, role, capability);
  return ids === null || ids.includes(batchId);
}

export async function canAccessIntermediary(profileId: string, role: string | null | undefined, intermediaryId: string, capability: Capability = "view_intermediaries") {
  const ids = await getAccessibleIntermediaryIds(profileId, role, capability);
  return ids === null || ids.includes(intermediaryId);
}

export async function isEmployeeWithinAccessScope(profileId: string, role: string | null | undefined, employeeId: string) {
  const scope = await getEmployeeAccessScope(profileId, role);
  return scope.mode === "organization" || scope.employeeIds.includes(employeeId);
}

export async function isProfileWithinAccessScope(profileId: string, role: string | null | undefined, targetProfileId: string) {
  const scope = await getEmployeeAccessScope(profileId, role);
  return scope.mode === "organization" || scope.profileIds.includes(targetProfileId);
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

function stringValue(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
