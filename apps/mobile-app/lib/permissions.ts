import type { AppRole } from './types';
import { isSalesHierarchyRole } from './roles';

const claimHandlers: AppRole[] = ['claim_processor', 'manager'];
const fieldSupport: AppRole[] = ['field_executive', 'claim_processor', 'manager', 'admin', 'super_admin'];
const admins: AppRole[] = ['admin', 'super_admin'];
const businessRecordManagers: AppRole[] = ['backoffice_executive', ...claimHandlers, ...admins];

export function canHandleClaim(role?: AppRole | null) {
  return Boolean(role && claimHandlers.includes(role));
}

export function canVerifyDocument(role?: AppRole | null) {
  return Boolean(role && claimHandlers.includes(role));
}

export function canUpdateClaimStage(role?: AppRole | null) {
  return Boolean(role && claimHandlers.includes(role));
}

export function canUploadOpsDocument(role?: AppRole | null) {
  return Boolean(role && fieldSupport.includes(role));
}

export function canCommunicateWithCustomer(role?: AppRole | null) {
  return Boolean(role && (role === 'agent' || fieldSupport.includes(role)));
}

export function canViewManagementReports(role?: AppRole | null) {
  return Boolean(role && (isSalesHierarchyRole(role) || ['manager', 'admin', 'super_admin'].includes(role)));
}

export function isReadOnlyClaimViewer(role?: AppRole | null) {
  return Boolean(role && (isSalesHierarchyRole(role) || role === 'it_super_user') && !claimHandlers.includes(role));
}

export function canManageBusinessRecords(role?: AppRole | null) {
  return Boolean(role && businessRecordManagers.includes(role));
}

export function canCreateCustomers(role?: AppRole | null) {
  return canManageBusinessRecords(role) || role === 'it_super_user';
}
