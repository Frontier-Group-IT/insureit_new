import type { Capability as LegacyCapability } from "@/lib/roles";

export const accessLevels = ["none", "view", "edit", "approve"] as const;
export type AccessLevel = (typeof accessLevels)[number];

export const dataScopes = [
  "self",
  "assigned",
  "team",
  "hierarchy",
  "branch",
  "zone",
  "department",
  "vertical",
  "selected_locations",
  "selected_employees",
  "organization",
] as const;
export type DataScope = (typeof dataScopes)[number];

export type PermissionRisk = "standard" | "sensitive" | "high" | "critical";
export type PermissionModule =
  | "Dashboard"
  | "Claims"
  | "Intermediaries"
  | "Customers"
  | "KYC"
  | "Employees"
  | "Organisation"
  | "Fleet"
  | "Policies"
  | "Tasks"
  | "Reports"
  | "Notifications"
  | "Administration"
  | "Master Data"
  | "System";

export type PermissionDefinitionV2 = {
  key: string;
  module: PermissionModule;
  label: string;
  description: string;
  risk: PermissionRisk;
  allowedAccess: readonly Exclude<AccessLevel, "none">[];
  allowedScopes: readonly DataScope[];
  scopeRequired: boolean;
};

const recordScopes = ["self", "assigned", "team", "hierarchy", "branch", "zone", "department", "vertical", "selected_locations", "selected_employees", "organization"] as const satisfies readonly DataScope[];
const hierarchyScopes = ["self", "team", "hierarchy", "branch", "zone", "department", "vertical", "selected_locations", "selected_employees", "organization"] as const satisfies readonly DataScope[];
const adminScope = ["organization"] as const satisfies readonly DataScope[];

export const permissionCatalogueV2 = [
  { key: "dashboard.view", module: "Dashboard", label: "View dashboard", description: "View operational dashboard summaries.", risk: "standard", allowedAccess: ["view"], allowedScopes: adminScope, scopeRequired: false },

  { key: "claims.view", module: "Claims", label: "View claims", description: "View claim records within the permitted data scope.", risk: "standard", allowedAccess: ["view"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "claims.edit", module: "Claims", label: "Edit claims", description: "Create or update operational claim information.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "claims.verify_documents", module: "Claims", label: "Verify claim documents", description: "Verify or reject claim documents and verification details.", risk: "high", allowedAccess: ["edit", "approve"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "claims.assign_surveyor", module: "Claims", label: "Assign surveyor", description: "Assign or depute surveyors for accessible claims.", risk: "high", allowedAccess: ["edit", "approve"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "claims.change_stage", module: "Claims", label: "Change claim stage", description: "Move a claim between controlled workflow stages.", risk: "high", allowedAccess: ["edit", "approve"], allowedScopes: recordScopes, scopeRequired: true },

  { key: "intermediaries.view", module: "Intermediaries", label: "View intermediaries", description: "View Partner, POSP and MISP records.", risk: "standard", allowedAccess: ["view"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "intermediaries.application.create", module: "Intermediaries", label: "Create intermediary applications", description: "Create new Partner, POSP and MISP onboarding applications.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "intermediaries.application.review", module: "Intermediaries", label: "Review intermediary applications", description: "Review and update onboarding information and documents.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "intermediaries.application.approve", module: "Intermediaries", label: "Approve intermediary applications", description: "Give final onboarding approval before activation.", risk: "high", allowedAccess: ["approve"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "intermediaries.activate", module: "Intermediaries", label: "Activate intermediary accounts", description: "Activate approved Partner, POSP or MISP accounts.", risk: "critical", allowedAccess: ["approve"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "intermediaries.portal_users.manage", module: "Intermediaries", label: "Manage intermediary portal users", description: "Create, enable, disable or repair intermediary portal access.", risk: "critical", allowedAccess: ["edit", "approve"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "intermediaries.training.manage", module: "Intermediaries", label: "Manage training and exam", description: "Assign, launch, synchronize or update training and examination workflow.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "intermediaries.agreement.manage", module: "Intermediaries", label: "Manage agreements", description: "Manage intermediary agreement workflow and documents.", risk: "sensitive", allowedAccess: ["edit", "approve"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "intermediaries.iib.manage", module: "Intermediaries", label: "Manage IIB workflow", description: "Manage IIB submission and registration workflow.", risk: "high", allowedAccess: ["edit", "approve"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "intermediaries.delete", module: "Intermediaries", label: "Permanently delete intermediary accounts", description: "Permanently delete intermediary accounts and related portal identities/documents.", risk: "critical", allowedAccess: ["approve"], allowedScopes: hierarchyScopes, scopeRequired: true },

  { key: "customers.view", module: "Customers", label: "View customers", description: "View customer records within the permitted portfolio or hierarchy.", risk: "standard", allowedAccess: ["view"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "customers.create", module: "Customers", label: "Create customers", description: "Create new customer records.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "customers.edit", module: "Customers", label: "Edit customers", description: "Update accessible customer records.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: recordScopes, scopeRequired: true },

  { key: "kyc.view", module: "KYC", label: "View KYC", description: "View KYC applications and supporting documents.", risk: "sensitive", allowedAccess: ["view"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "kyc.review", module: "KYC", label: "Review KYC", description: "Review KYC information and request corrections.", risk: "high", allowedAccess: ["edit"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "kyc.approve", module: "KYC", label: "Approve KYC", description: "Give final KYC approval or rejection.", risk: "critical", allowedAccess: ["approve"], allowedScopes: recordScopes, scopeRequired: true },

  { key: "employees.view", module: "Employees", label: "View employee directory", description: "View employee records within the permitted organisation scope.", risk: "sensitive", allowedAccess: ["view"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "employees.create", module: "Employees", label: "Create employees", description: "Create employee directory records without automatically granting portal access.", risk: "high", allowedAccess: ["edit"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "employees.edit", module: "Employees", label: "Edit employees", description: "Update employee HR/organisation attributes.", risk: "high", allowedAccess: ["edit"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "employees.deactivate", module: "Employees", label: "Deactivate employees", description: "Deactivate employee records and trigger portal-access suspension workflow.", risk: "critical", allowedAccess: ["approve"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "organisation.view", module: "Organisation", label: "View organisation structure", description: "View reporting hierarchy and organisation structure.", risk: "sensitive", allowedAccess: ["view"], allowedScopes: hierarchyScopes, scopeRequired: true },

  { key: "vehicles.view", module: "Fleet", label: "View vehicles", description: "View vehicles attached to accessible customers.", risk: "standard", allowedAccess: ["view"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "vehicles.create", module: "Fleet", label: "Add vehicles", description: "Add vehicles for accessible customers.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "vehicles.edit", module: "Fleet", label: "Edit vehicles", description: "Update accessible vehicle records.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: recordScopes, scopeRequired: true },

  { key: "policies.view", module: "Policies", label: "View policies", description: "View policies for accessible customers and vehicles.", risk: "standard", allowedAccess: ["view"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "policies.create", module: "Policies", label: "Add policies", description: "Create policies for accessible customers and vehicles.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "policies.edit", module: "Policies", label: "Edit policies", description: "Update accessible policy records.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "policies.ocr_training.review", module: "Policies", label: "Operate premium OCR training", description: "Run Google OCR, inspect comparisons and approve sanitized Section 03 training candidates.", risk: "high", allowedAccess: ["edit"], allowedScopes: adminScope, scopeRequired: false },
  { key: "policies.ocr_training.approve", module: "Policies", label: "Operate premium OCR training (legacy)", description: "Compatibility permission for the single-operator OCR training workflow.", risk: "critical", allowedAccess: ["approve"], allowedScopes: adminScope, scopeRequired: false },

  { key: "tasks.view", module: "Tasks", label: "View tasks", description: "View assigned or otherwise accessible tasks.", risk: "standard", allowedAccess: ["view"], allowedScopes: recordScopes, scopeRequired: true },
  { key: "tasks.create", module: "Tasks", label: "Create tasks", description: "Create operational follow-up tasks.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "tasks.assign", module: "Tasks", label: "Assign tasks", description: "Assign tasks to employees inside the permitted scope.", risk: "sensitive", allowedAccess: ["edit", "approve"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "tasks.edit", module: "Tasks", label: "Update tasks", description: "Update or close accessible tasks.", risk: "sensitive", allowedAccess: ["edit"], allowedScopes: recordScopes, scopeRequired: true },

  { key: "reports.view", module: "Reports", label: "View reports", description: "View management reports when the reporting workspace is enabled.", risk: "sensitive", allowedAccess: ["view"], allowedScopes: hierarchyScopes, scopeRequired: true },
  { key: "notifications.view", module: "Notifications", label: "View notifications", description: "View notifications relevant to the signed-in user.", risk: "standard", allowedAccess: ["view"], allowedScopes: ["self"], scopeRequired: true },

  { key: "admin.portal_users.manage", module: "Administration", label: "Manage employee portal users", description: "Invite, enable, suspend and restore employee portal identities.", risk: "critical", allowedAccess: ["approve"], allowedScopes: adminScope, scopeRequired: false },
  { key: "admin.roles.manage", module: "Administration", label: "Manage roles", description: "Create, update, assign and retire business security roles.", risk: "critical", allowedAccess: ["approve"], allowedScopes: adminScope, scopeRequired: false },
  { key: "admin.permissions.manage", module: "Administration", label: "Manage permissions", description: "Change role permissions and employee-specific access exceptions.", risk: "critical", allowedAccess: ["approve"], allowedScopes: adminScope, scopeRequired: false },
  { key: "admin.audit.view", module: "Administration", label: "View access audit", description: "View role, permission and portal-user security history.", risk: "high", allowedAccess: ["view"], allowedScopes: adminScope, scopeRequired: false },

  { key: "master_data.manage", module: "Master Data", label: "Manage master data", description: "Create and update operational reference/master data.", risk: "high", allowedAccess: ["edit", "approve"], allowedScopes: adminScope, scopeRequired: false },
  { key: "system.manage", module: "System", label: "Manage system settings", description: "Manage protected system configuration.", risk: "critical", allowedAccess: ["approve"], allowedScopes: adminScope, scopeRequired: false },
  { key: "system.integrations.configure", module: "System", label: "Configure integrations", description: "Configure or test protected external service integrations and UAT tooling.", risk: "critical", allowedAccess: ["approve"], allowedScopes: adminScope, scopeRequired: false },
] as const satisfies readonly PermissionDefinitionV2[];

export type PermissionKeyV2 = (typeof permissionCatalogueV2)[number]["key"];

export const legacyCapabilityCompatibilityMap: Record<LegacyCapability, readonly PermissionKeyV2[]> = {
  view_dashboard: ["dashboard.view"],
  view_claims: ["claims.view"],
  manage_claims: ["claims.edit", "claims.verify_documents", "claims.assign_surveyor", "claims.change_stage"],
  view_intermediaries: ["intermediaries.view"],
  create_intermediary_application: ["intermediaries.application.create", "intermediaries.training.manage", "intermediaries.agreement.manage", "intermediaries.iib.manage"],
  review_intermediary_application: ["intermediaries.application.review", "intermediaries.training.manage", "intermediaries.agreement.manage", "intermediaries.iib.manage"],
  approve_intermediary_application: ["intermediaries.application.approve"],
  activate_intermediary: ["intermediaries.activate"],
  view_customers: ["customers.view"],
  create_customers: ["customers.create"],
  manage_customers: ["customers.create", "customers.edit"],
  view_kyc: ["kyc.view"],
  review_kyc: ["kyc.review"],
  view_employees: ["employees.view"],
  manage_employees: ["employees.create", "employees.edit", "employees.deactivate"],
  view_org_tree: ["organisation.view"],
  view_vehicles: ["vehicles.view"],
  create_vehicles: ["vehicles.create"],
  view_policies: ["policies.view"],
  create_policies: ["policies.create"],
  create_external_policies: ["policies.create"],
  review_policy_ocr_training: ["policies.ocr_training.review"],
  approve_policy_ocr_training: ["policies.ocr_training.approve"],
  view_tasks: ["tasks.view"],
  manage_tasks: ["tasks.create", "tasks.assign", "tasks.edit"],
  view_reports: ["reports.view"],
  view_notifications: ["notifications.view"],
  manage_users: ["admin.portal_users.manage"],
  manage_master_data: ["master_data.manage"],
  manage_system: ["admin.roles.manage", "admin.permissions.manage", "admin.audit.view", "intermediaries.delete", "system.manage", "system.integrations.configure"],
};

export const permissionCatalogueV2ByKey = new Map<PermissionKeyV2, PermissionDefinitionV2>(
  permissionCatalogueV2.map((permission) => [permission.key, permission]),
);

export function permissionsForLegacyCapability(capability: LegacyCapability) {
  return legacyCapabilityCompatibilityMap[capability];
}
