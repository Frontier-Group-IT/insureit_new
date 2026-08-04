import type { AppRole, Capability } from "@/lib/roles";
import { hasCapability, roleCapabilities } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PermissionAccess = "none" | "view" | "edit" | "approve";
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
  view_customers: { module: "Customers", label: "View customers", description: "Open customer records and customer details.", risk: "standard" },
  manage_customers: { module: "Customers", label: "Edit customers", description: "Create and modify customer and related fleet records.", risk: "sensitive" },
  view_kyc: { module: "KYC", label: "View KYC", description: "Open customer KYC records and documents.", risk: "sensitive" },
  review_kyc: { module: "KYC", label: "Review KYC", description: "Review and update KYC verification status.", risk: "high" },
  view_employees: { module: "Employees", label: "View employees", description: "Open the employee directory and employee details.", risk: "sensitive" },
  manage_employees: { module: "Employees", label: "Edit employees", description: "Create, modify or deactivate employee records.", risk: "high" },
  view_org_tree: { module: "Employees", label: "View organisation tree", description: "View reporting hierarchy and organisation structure.", risk: "sensitive" },
  view_vehicles: { module: "Fleet", label: "View vehicles", description: "Open vehicle and fleet records.", risk: "standard" },
  view_policies: { module: "Policies", label: "View policies", description: "Open policy records and policy information.", risk: "standard" },
  view_tasks: { module: "Tasks", label: "View tasks", description: "Open assigned and accessible tasks.", risk: "standard" },
  manage_tasks: { module: "Tasks", label: "Edit and assign tasks", description: "Create, assign, update and close tasks.", risk: "sensitive" },
  view_reports: { module: "Reports", label: "View reports", description: "Open reports and management summaries.", risk: "sensitive" },
  view_notifications: { module: "Notifications", label: "View notifications", description: "Open system and workflow notifications.", risk: "standard" },
  manage_users: { module: "Administration", label: "Manage portal users", description: "Create and manage internal portal user access.", risk: "critical" },
  manage_master_data: { module: "Administration", label: "Manage master data", description: "Create and edit operational master data.", risk: "high" },
  manage_system: { module: "Administration", label: "Manage system settings", description: "Access development, configuration and system controls.", risk: "critical" },
};

export const permissionDefinitions: PermissionDefinition[] = Object.entries(labels).map(([capability, definition]) => ({
  capability: capability as Capability,
  ...definition,
  roleAccess: capability.startsWith("view_") ? "view" : capability.startsWith("approve_") || capability.startsWith("activate_") ? "approve" : "edit",
}));

export function rolePermissionAccess(role: string | null | undefined, capability: Capability): PermissionAccess {
  if (!hasCapability(role, capability)) return "none";
  return permissionDefinitions.find((item) => item.capability === capability)?.roleAccess ?? "view";
}

export function permissionModules() {
  return Array.from(new Set(permissionDefinitions.map((item) => item.module)));
}

export async function getEffectivePermission(profileId: string, role: AppRole, capability: Capability) {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const [{ data: employeeOverride }, { data: roleOverride }] = await Promise.all([
    admin.from("employee_permission_overrides").select("access_level,scope_type,expires_at").eq("profile_id", profileId).eq("capability", capability).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle(),
    admin.from("role_permission_overrides").select("access_level,scope_type").eq("role", role).eq("capability", capability).maybeSingle(),
  ]);
  if (employeeOverride && employeeOverride.access_level !== "inherit") return { access: employeeOverride.access_level as PermissionAccess, scope: employeeOverride.scope_type as PermissionScope, source: "employee_override" as const };
  if (roleOverride) return { access: roleOverride.access_level as PermissionAccess, scope: roleOverride.scope_type as PermissionScope, source: "role_override" as const };
  return { access: rolePermissionAccess(role, capability), scope: "role_default" as const, source: "role" as const };
}

export function roleCapabilityCount(role: AppRole) {
  return roleCapabilities[role].length;
}
