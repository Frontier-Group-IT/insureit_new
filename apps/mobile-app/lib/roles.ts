import type { AppRole } from './types';

export const appRoles: AppRole[] = [
  'super_admin',
  'admin',
  'manager',
  'backoffice_executive',
  'claim_processor',
  'field_executive',
  'director',
  'sales_head',
  'zonal_head',
  'asm',
  'sales_manager',
  'agent',
  'customer',
  'it_super_user',
];

export const salesHierarchyRoles: AppRole[] = [
  'director',
  'sales_head',
  'zonal_head',
  'asm',
  'sales_manager',
  'agent',
];

export const staffRoles: AppRole[] = [
  ...salesHierarchyRoles,
  'field_executive',
  'backoffice_executive',
  'claim_processor',
  'manager',
  'admin',
  'super_admin',
];

export const userManagementRoles: AppRole[] = ['it_super_user', 'admin', 'super_admin'];

export const roleLabels: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  backoffice_executive: 'Back Office Executive',
  claim_processor: 'Claim Processor',
  field_executive: 'Field Executive',
  director: 'Director',
  sales_head: 'Sales Head',
  zonal_head: 'Zonal Head',
  asm: 'ASM',
  sales_manager: 'Sales Manager',
  agent: 'Agent',
  customer: 'Customer',
  it_super_user: 'IT Super User',
};

export const designationOptions = [
  'Super Admin',
  'Admin',
  'IT Super User',
  'Manager',
  'Back Office Executive',
  'Claim Processor',
  'Field Executive',
  'Director',
  'Sales Head',
  'Zonal Head',
  'Area Sales Manager',
  'ASM',
  'Sales Manager',
  'Agent',
  'Customer',
  'Claims Manager',
  'Administrator',
];

export function canManageUsers(role?: AppRole | null) {
  return Boolean(role && userManagementRoles.includes(role));
}

export function isStaffRole(role?: AppRole | null) {
  return Boolean(role && staffRoles.includes(role));
}

export function isSalesHierarchyRole(role?: AppRole | null) {
  return Boolean(role && salesHierarchyRoles.includes(role));
}
