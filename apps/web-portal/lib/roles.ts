export const appRoles = [
  "super_admin",
  "admin",
  "manager",
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
  "Director",
  "Sales Head",
  "Zonal Head",
  "Area Sales Manager",
  "Sales Manager",
  "Agent",
  "Claims Manager",
  "Claim Processor",
  "Field Executive",
  "IT Super User",
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

export function canViewOrganizationTree(role: string | null | undefined) {
  return Boolean(role && isAppRole(role) && organizationTreeRoles.includes(role));
}
