import { cache } from "react";
import type { AppRole, Capability } from "@/lib/roles";
import { hasCapability, roleCapabilities } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PermissionAccess = "none" | "view" | "edit" | "approve";
export type EmployeePermissionAccess = PermissionAccess | "inherit";
export type PermissionScope = "role_default" | "inherit" | "self" | "hierarchy" | "organization";

export type PermissionDefinition = {
  capability: Capability;
  module: string;
  label: string;
  description: string;
  risk: "standard" | "sensitive" | "high" | "critical";
  roleAccess: PermissionAccess;
};

const labels: Record<Capability, Omit<PermissionDefinition, "capability" | "roleAccess">> = {
  view_dashboard: { module: "Dashboard", label: "View dashboard", description: "Open the operational dashboard and summary cards.", risk: "standard" },
  view_claims: { module: "Claims", label: "View claims", description: "Open claim records and claim workspaces.", risk: "standard" },
  manage_claims: { module: "Claims", label: "Edit and process claims", description: "Update claim information, documents and workflow stages.", risk: "high" },
  view_intermediaries: { module: "Intermediaries", label: "View Partners, POSP and MISP", description: "Open intermediary registers and onboarding records.", risk: "standard" },
  create_intermediary_application: { module: "Intermediaries", label: "Create onboarding applications", description: "Create new Partner, POSP or MISP onboarding records.", risk: "sensitive" },
  review_intermediary_application: { module: "Intermediaries", label: "Review onboarding applications", description: "Review and edit submitted onboarding information and documents.", risk: "sensitive" },
  approve_intermediary_application: { module: "Intermediaries", label: "Approve onboarding applications", description: "Give final onboarding approval before activation.", risk: "high" },
  activate_intermediary: { module: "Intermediaries", label: "Activate intermediary", description: "Activate approved Partner, POSP or MISP accounts.", risk: "critical" },
  view_customers: { module: "Customers", label: "View customers", description: "Open customer register records within the permitted scope.", risk: "standard" },
  create_customers: { module: "Customers", label: "Add customers", description: "Create new operational customer records without granting authority to edit existing customer identity or KYC records.", risk: "sensitive" },
  manage_customers: { module: "Customers", label: "Edit customers", description: "Create and modify customer and related fleet records.", risk: "sensitive" },
  view_kyc: { module: "KYC", label: "View KYC", description: "Open customer KYC records and documents.", risk: "sensitive" },
  review_kyc: { module: "KYC", label: "Review KYC", description: "Review and update KYC verification status.", risk: "high" },
  view_employees: { module: "Employees", label: "View employees", description: "Open the employee directory and employee details.", risk: "sensitive" },
  manage_employees: { module: "Employees", label: "Edit employees", description: "Create, modify or deactivate employee records.", risk: "high" },
  view_org_tree: { module: "Employees", label: "View organisation tree", description: "View reporting hierarchy and organisation structure.", risk: "sensitive" },
  view_vehicles: { module: "Fleet", label: "View vehicles", description: "Open vehicle and fleet records.", risk: "standard" },
  create_vehicles: { module: "Fleet", label: "Add vehicles", description: "Create new vehicle records without granting authority to modify established vehicle identity records.", risk: "sensitive" },
  view_policies: { module: "Policies", label: "View policies", description: "Open policy records and policy information.", risk: "standard" },
  create_policies: { module: "Policies", label: "Add policies", description: "Create new managed policy records without granting edit authority over existing policies or financial settlement controls.", risk: "sensitive" },
  create_external_policies: { module: "Policies", label: "Add external policies", description: "Create new external policy records without granting edit authority over existing policy records.", risk: "sensitive" },
  review_policy_ocr_training: { module: "Policies", label: "Operate premium OCR training", description: "Run Google OCR, inspect comparisons and approve sanitized Section 03 training candidates.", risk: "high" },
  approve_policy_ocr_training: { module: "Policies", label: "Operate premium OCR training (legacy)", description: "Compatibility permission for the single-operator OCR training workflow.", risk: "critical" },
  view_tasks: { module: "Tasks", label: "View tasks", description: "Open assigned and accessible tasks.", risk: "standard" },
  manage_tasks: { module: "Tasks", label: "Edit and assign tasks", description: "Create, assign, update and close tasks.", risk: "sensitive" },
  view_reports: { module: "Reports", label: "View reports", description: "Open permitted operational and general reports.", risk: "sensitive" },
  view_notifications: { module: "Notifications", label: "View notifications", description: "Open system and workflow notifications.", risk: "standard" },
  manage_users: { module: "Administration", label: "Manage portal users", description: "Create and manage internal portal user access.", risk: "critical" },
  manage_master_data: { module: "Administration", label: "Manage master data", description: "Create and edit operational master data.", risk: "high" },
  manage_system: { module: "Administration", label: "Manage system settings", description: "Access development, configuration and system controls.", risk: "critical" },
};

export const permissionDefinitions: PermissionDefinition[] = Object.entries(labels).map(([capability, definition]) => ({
  capability: capability as Capability,
  ...definition,
  roleAccess: capability.startsWith("view_") ? "view" : definition.risk === "critical" || capability.startsWith("approve_") || capability.startsWith("activate_") ? "approve" : "edit",
}));

const backofficePermissionCeiling: Partial<Record<Capability, PermissionAccess>> = {
  view_dashboard: "view",
  view_customers: "view",
  create_customers: "edit",
  view_vehicles: "view",
  create_vehicles: "edit",
  view_policies: "view",
  create_policies: "edit",
  create_external_policies: "edit",
  view_reports: "view",
  view_notifications: "view",
};
const accessRank: Record<PermissionAccess, number> = { none: 0, view: 1, edit: 2, approve: 3 };
function capBackofficeAccess(role: AppRole, capability: Capability, access: PermissionAccess): PermissionAccess {
  if (role !== "backoffice_executive") return access;
  const ceiling = backofficePermissionCeiling[capability] ?? "none";
  return accessRank[access] > accessRank[ceiling] ? ceiling : access;
}

export function rolePermissionAccess(role: string | null | undefined, capability: Capability): PermissionAccess {
  if (role === "it_super_user") return "approve";
  if (!hasCapability(role, capability)) return "none";
  return permissionDefinitions.find((item) => item.capability === capability)?.roleAccess ?? "view";
}

export function permissionModules() {
  return Array.from(new Set(permissionDefinitions.map((item) => item.module)));
}

export const getEffectivePermission = cache(async (profileId: string, role: AppRole, capability: Capability) => {
  if (role === "it_super_user") {
    return { access: "approve" as const, scope: "organization" as const, source: "protected_role" as const };
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const [{ data: employeeOverride }, { data: roleOverride }] = await Promise.all([
    admin.from("employee_permission_overrides").select("access_level,scope_type,expires_at").eq("profile_id", profileId).eq("capability", capability).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle(),
    admin.from("role_permission_overrides").select("access_level,scope_type").eq("role", role).eq("capability", capability).maybeSingle(),
  ]);
  if (employeeOverride && employeeOverride.access_level !== "inherit") return { access: capBackofficeAccess(role, capability, employeeOverride.access_level as PermissionAccess), scope: employeeOverride.scope_type as PermissionScope, source: "employee_override" as const };
  if (roleOverride) return { access: capBackofficeAccess(role, capability, roleOverride.access_level as PermissionAccess), scope: roleOverride.scope_type as PermissionScope, source: "role_override" as const };
  return { access: capBackofficeAccess(role, capability, rolePermissionAccess(role, capability)), scope: "role_default" as const, source: "role" as const };
});

export const getEffectivePermissionAccessMapForRole = cache(async (profileId: string, role: AppRole) => {
  if (role === "it_super_user") {
    return Object.fromEntries(permissionDefinitions.map(({ capability }) => [capability, "approve" as const])) as Partial<Record<Capability, PermissionAccess>>;
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const [{ data: employeeOverrides }, { data: roleOverrides }] = await Promise.all([
    admin
      .from("employee_permission_overrides")
      .select("capability,access_level,scope_type,expires_at")
      .eq("profile_id", profileId)
      .or(`expires_at.is.null,expires_at.gt.${now}`),
    admin
      .from("role_permission_overrides")
      .select("capability,access_level,scope_type")
      .eq("role", role),
  ]);

  const employeeOverrideByCapability = new Map(
    (employeeOverrides ?? [])
      .filter((row) => row.access_level !== "inherit")
      .map((row) => [row.capability as Capability, row.access_level as PermissionAccess]),
  );
  const roleOverrideByCapability = new Map(
    (roleOverrides ?? []).map((row) => [row.capability as Capability, row.access_level as PermissionAccess]),
  );

  return Object.fromEntries(permissionDefinitions.map(({ capability }) => {
    const access = employeeOverrideByCapability.get(capability)
      ?? roleOverrideByCapability.get(capability)
      ?? rolePermissionAccess(role, capability);
    return [capability, capBackofficeAccess(role, capability, access)] as const;
  })) as Partial<Record<Capability, PermissionAccess>>;
});

export function roleCapabilityCount(role: AppRole) {
  return roleCapabilities[role].length;
}
