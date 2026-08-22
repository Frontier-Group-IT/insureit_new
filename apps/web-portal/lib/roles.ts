export const appRoles = [
  "super_admin",
  "admin",
  "manager",
  "claims_head",
  "sales_operations_head",
  "backoffice_executive",
  "claim_processor",
  "field_executive",
  "relationship_manager",
  "director",
  "sales_head",
  "zonal_head",
  "asm",
  "sales_manager",
  "agent",
  "customer",
  "intermediary",
  "it_super_user"
] as const;

export type AppRole = (typeof appRoles)[number];

export type Capability =
  | "view_dashboard"
  | "view_claims"
  | "manage_claims"
  | "view_intermediaries"
  | "create_intermediary_application"
  | "review_intermediary_application"
  | "approve_intermediary_application"
  | "activate_intermediary"
  | "view_customers"
  | "manage_customers"
  | "view_kyc"
  | "review_kyc"
  | "view_employees"
  | "manage_employees"
  | "view_org_tree"
  | "view_vehicles"
  | "create_vehicles"
  | "view_policies"
  | "create_policies"
  | "create_external_policies"
  | "review_policy_ocr_training"
  | "approve_policy_ocr_training"
  | "view_tasks"
  | "manage_tasks"
  | "view_reports"
  | "view_notifications"
  | "manage_users"
  | "manage_master_data"
  | "manage_system";

const ALL_OPERATIONAL: Capability[] = [
  "view_dashboard", "view_claims", "manage_claims", "view_intermediaries", "create_intermediary_application",
  "review_intermediary_application", "approve_intermediary_application", "activate_intermediary", "view_customers",
  "manage_customers", "view_kyc", "review_kyc", "view_employees", "manage_employees", "view_org_tree",
  "view_vehicles", "create_vehicles", "view_policies", "create_policies", "create_external_policies", "review_policy_ocr_training", "view_tasks", "manage_tasks", "view_reports", "view_notifications",
  "manage_master_data"
];

export const roleCapabilities: Record<AppRole, readonly Capability[]> = {
  super_admin: [...ALL_OPERATIONAL, "approve_policy_ocr_training", "manage_users", "manage_system"],
  admin: [...ALL_OPERATIONAL, "approve_policy_ocr_training", "manage_users", "manage_system"],
  it_super_user: [...ALL_OPERATIONAL, "approve_policy_ocr_training", "manage_users", "manage_system"],
  manager: ALL_OPERATIONAL,
  director: [
    "view_dashboard", "view_claims", "view_intermediaries", "review_intermediary_application",
    "approve_intermediary_application", "view_customers", "view_kyc", "review_kyc", "view_employees",
    "view_org_tree", "view_vehicles", "view_policies", "view_tasks", "manage_tasks", "view_reports",
    "view_notifications"
  ],
  sales_operations_head: [
    "view_dashboard", "view_claims", "manage_claims", "view_intermediaries", "create_intermediary_application",
    "review_intermediary_application", "approve_intermediary_application", "activate_intermediary",
    "view_customers", "manage_customers", "view_kyc", "review_kyc", "view_tasks", "manage_tasks",
    "view_reports", "view_notifications"
  ],
  sales_head: [
    "view_dashboard", "view_claims", "view_intermediaries", "create_intermediary_application",
    "review_intermediary_application", "view_customers", "manage_customers", "view_kyc", "review_kyc",
    "view_employees", "view_org_tree", "view_vehicles", "view_policies", "view_tasks", "manage_tasks",
    "view_reports", "view_notifications"
  ],
  zonal_head: [
    "view_dashboard", "view_intermediaries", "create_intermediary_application", "review_intermediary_application",
    "view_customers", "manage_customers", "view_kyc", "review_kyc", "view_org_tree", "view_tasks",
    "manage_tasks", "view_reports", "view_notifications"
  ],
  asm: [
    "view_dashboard", "view_intermediaries", "create_intermediary_application", "review_intermediary_application",
    "view_customers", "manage_customers", "view_kyc", "review_kyc", "view_org_tree", "view_tasks",
    "manage_tasks", "view_reports", "view_notifications"
  ],
  sales_manager: [
    "view_dashboard", "view_intermediaries", "create_intermediary_application", "review_intermediary_application",
    "view_customers", "manage_customers", "view_kyc", "review_kyc", "view_org_tree", "view_tasks",
    "manage_tasks", "view_reports", "view_notifications"
  ],
  relationship_manager: [
    "view_dashboard", "view_claims", "view_intermediaries", "create_intermediary_application", "view_customers",
    "manage_customers", "view_kyc", "view_vehicles", "view_policies", "view_tasks", "view_notifications"
  ],
  claims_head: ["view_dashboard", "view_claims", "manage_claims", "view_tasks", "manage_tasks", "view_reports", "view_notifications"],
  claim_processor: ["view_dashboard", "view_claims", "manage_claims", "view_tasks", "manage_tasks", "view_notifications"],
  field_executive: ["view_dashboard", "view_claims", "view_tasks", "view_notifications"],
  backoffice_executive: [
    "view_dashboard",
    "view_customers", "manage_customers",
    "view_vehicles", "create_vehicles",
    "view_policies", "create_policies", "create_external_policies",
    "view_reports", "view_notifications"
  ],
  agent: ["view_dashboard", "view_customers", "manage_customers", "view_tasks", "view_notifications"],
  customer: [],
  intermediary: []
};

export function hasCapability(role: string | null | undefined, capability: Capability) {
  return Boolean(role && isAppRole(role) && roleCapabilities[role].includes(capability));
}

export const salesHierarchyRoles: AppRole[] = ["director", "sales_head", "zonal_head", "asm", "sales_manager", "agent"];

export const portalRoles: AppRole[] = appRoles.filter((role) => role !== "customer" && role !== "intermediary");
export const userManagementRoles: AppRole[] = ["it_super_user", "admin", "super_admin"];
export const masterDataManagementRoles: AppRole[] = ["manager", "it_super_user", "admin", "super_admin"];
export const pospMispManagementRoles: AppRole[] = [
  "manager", "it_super_user", "admin", "super_admin", "director", "sales_head", "zonal_head", "asm",
  "sales_manager", "relationship_manager", "sales_operations_head"
];
export const organizationTreeRoles: AppRole[] = [
  "it_super_user", "admin", "super_admin", "director", "sales_head", "zonal_head", "asm", "sales_manager"
];

export const roleLabels: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  claims_head: "Claims Head",
  sales_operations_head: "Operations Head",
  backoffice_executive: "Backoffice Executive",
  claim_processor: "Claim Processor",
  field_executive: "Field Executive",
  relationship_manager: "Relationship Manager",
  director: "Director",
  sales_head: "Sales Head",
  zonal_head: "Zonal Head",
  asm: "Area Sales Head",
  sales_manager: "Sales Manager",
  agent: "Agent",
  customer: "Customer",
  intermediary: "Intermediary",
  it_super_user: "IT Super User"
};

export const designationOptions = [
  "Super Admin", "Admin", "IT Super User", "Manager", "Backoffice Executive", "Claim Processor", "Field Executive",
  "Relationship Manager", "Senior Relationship Manager", "Director", "CPO", "Operations Head",
  "Sales Head", "Zonal Head", "Area Sales Head", "Area Sales Manager", "ASM", "Sales Manager",
  "Agent", "Customer", "Claims Manager", "Administrator"
];

export function isAppRole(role: string | null | undefined): role is AppRole {
  return Boolean(role && appRoles.includes(role as AppRole));
}
export function isPortalRole(role: string | null | undefined): role is AppRole {
  return Boolean(role && isAppRole(role) && portalRoles.includes(role));
}
export function isIntermediaryRole(role: string | null | undefined) { return role === "intermediary"; }
export function canManageUsers(role: string | null | undefined) { return hasCapability(role, "manage_users"); }
export function canManageMasterData(role: string | null | undefined) { return hasCapability(role, "manage_master_data"); }
export function canManagePospMispOnboarding(role: string | null | undefined) { return hasCapability(role, "create_intermediary_application") || hasCapability(role, "review_intermediary_application"); }
export function canReviewPospMispOnboarding(role: string | null | undefined) { return hasCapability(role, "review_intermediary_application"); }
export function canApprovePospMispOnboarding(role: string | null | undefined) { return hasCapability(role, "approve_intermediary_application"); }
export function canActivateIntermediary(role: string | null | undefined) { return hasCapability(role, "activate_intermediary"); }
export function canViewOrganizationTree(role: string | null | undefined) { return hasCapability(role, "view_org_tree"); }

export const claimWorkflowRoles: AppRole[] = appRoles.filter((role) => hasCapability(role, "manage_claims"));
export const claimViewRoles: AppRole[] = appRoles.filter((role) => hasCapability(role, "view_claims"));
export function canUpdateClaimStage(role: string | null | undefined) { return hasCapability(role, "manage_claims"); }
export function canVerifyClaimDocuments(role: string | null | undefined) { return canUpdateClaimStage(role); }
export function canViewClaimWorkspace(role: string | null | undefined) { return hasCapability(role, "view_claims"); }
