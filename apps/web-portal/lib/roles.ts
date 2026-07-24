export const appRoles = [
  "super_admin",
  "admin",
  "manager",
  "claims_head",
  "sales_operations_head",
  "backoffice_executive",
  "claim_processor",
  "field_executive",
  "director",
  "sales_head",
  "zonal_head",
  "asm",
  "sales_manager",
  "agent",
  "customer",
  "it_super_user"
] as const;

export type AppRole = (typeof appRoles)[number];

export const salesHierarchyRoles: AppRole[] = [
  "director",
  "sales_head",
  "zonal_head",
  "asm",
  "sales_manager",
  "agent"
];

export const portalRoles: AppRole[] = [
  "super_admin",
  "admin",
  "manager",
  "claims_head",
  "sales_operations_head",
  "backoffice_executive",
  "claim_processor",
  "field_executive",
  "director",
  "sales_head",
  "zonal_head",
  "asm",
  "sales_manager",
  "agent",
  "it_super_user"
];

export const userManagementRoles: AppRole[] = ["it_super_user", "admin", "super_admin"];
export const masterDataManagementRoles: AppRole[] = ["manager", "it_super_user", "admin", "super_admin"];
export const pospMispManagementRoles: AppRole[] = [
  "manager",
  "it_super_user",
  "admin",
  "super_admin",
  "sales_head",
  "sales_operations_head",
  "backoffice_executive"
];

export const organizationTreeRoles: AppRole[] = [
  "it_super_user",
  "admin",
  "super_admin",
  "director",
  "sales_head",
  "zonal_head",
  "asm",
  "sales_manager"
];

export const roleLabels: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  claims_head: "Claims Head",
  sales_operations_head: "Sales Operations Head",
  backoffice_executive: "Backoffice Executive",
  claim_processor: "Claim Processor",
  field_executive: "Field Executive",
  director: "Director",
  sales_head: "Sales Head",
  zonal_head: "Zonal Head",
  asm: "ASM",
  sales_manager: "Sales Manager",
  agent: "Agent",
  customer: "Customer",
  it_super_user: "IT Super User"
};

export const designationOptions = [
  "Super Admin",
  "Admin",
  "IT Super User",
  "Manager",
  "Claim Processor",
  "Field Executive",
  "Director",
  "Sales Head",
  "Zonal Head",
  "Area Sales Manager",
  "ASM",
  "Sales Manager",
  "Agent",
  "Customer",
  "Claims Manager",
  "Administrator"
];

export function isAppRole(role: string | null | undefined): role is AppRole {
  return Boolean(role && appRoles.includes(role as AppRole));
}

export function isPortalRole(role: string | null | undefined): role is AppRole {
  return Boolean(role && isAppRole(role) && portalRoles.includes(role));
}

export function canManageUsers(role: string | null | undefined) {
  return Boolean(role && isAppRole(role) && userManagementRoles.includes(role));
}

export function canManageMasterData(role: string | null | undefined) {
  return Boolean(role && isAppRole(role) && masterDataManagementRoles.includes(role));
}

export function canManagePospMispOnboarding(role: string | null | undefined) {
  return Boolean(role && isAppRole(role) && pospMispManagementRoles.includes(role));
}

export function canViewOrganizationTree(role: string | null | undefined) {
  return Boolean(role && isAppRole(role) && organizationTreeRoles.includes(role));
}

export const claimWorkflowRoles: AppRole[] = ["manager", "claim_processor", "admin", "super_admin", "it_super_user"];
export const claimViewRoles: AppRole[] = ["manager", "claim_processor", "field_executive", "admin", "super_admin", "it_super_user"];

export function canUpdateClaimStage(role: string | null | undefined) {
  return Boolean(role && isAppRole(role) && claimWorkflowRoles.includes(role));
}

export function canVerifyClaimDocuments(role: string | null | undefined) {
  return canUpdateClaimStage(role);
}

export function canViewClaimWorkspace(role: string | null | undefined) {
  return Boolean(role && isAppRole(role) && (claimViewRoles.includes(role) || portalRoles.includes(role)));
}
