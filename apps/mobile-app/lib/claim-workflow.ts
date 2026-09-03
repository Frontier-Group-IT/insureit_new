import { projectInternalClaim } from '@insureit/claim-journey';

import type { ClaimStatus } from './types';

export const terminalClaimStatuses: ClaimStatus[] = ['Settled', 'Rejected', 'Closed'];

export const claimQueueDefinitions = [
  {
    key: 'new',
    label: 'New claims',
    shortLabel: 'New',
    statuses: ['Draft', 'Accident Reported'] as ClaimStatus[],
    icon: 'alert-plus-outline',
    tone: 'info',
  },
  {
    key: 'documents',
    label: 'Initial documents',
    shortLabel: 'Docs',
    statuses: ['Initial Documents Pending', 'Initial Documents Verification Pending', 'Initial Documents Submitted', 'Initial Documents Verified', 'Documents Pending', 'Documents Submitted'] as ClaimStatus[],
    icon: 'file-alert-outline',
    tone: 'danger',
  },
  {
    key: 'survey',
    label: 'Survey pending',
    shortLabel: 'Survey',
    statuses: ['Claim Intimated', 'Surveyor Appointed', 'Vehicle Inspected'] as ClaimStatus[],
    icon: 'clipboard-search-outline',
    tone: 'info',
  },
  {
    key: 'approval',
    label: 'Approval pending',
    shortLabel: 'Approval',
    statuses: ['Final Documents Awaited', 'Final Documents Verification Pending', 'Final Documents Submitted', 'Final Documents Verified', 'Claim Intimation', 'Final Surveyor Details', 'Work Approval Received'] as ClaimStatus[],
    icon: 'shield-alert-outline',
    tone: 'warning',
  },
  {
    key: 'repair',
    label: 'Repair and final bill',
    shortLabel: 'Repair',
    statuses: ['Under Repair', 'Repair Done', 'RA Intimation', 'RA Intimation Done', 'DO Status'] as ClaimStatus[],
    icon: 'car-wrench',
    tone: 'info',
  },
  {
    key: 'payment',
    label: 'Settlement and payment',
    shortLabel: 'Payment',
    statuses: ['Payment Stage', 'Claim Completion In Progress', 'Claim Complete'] as ClaimStatus[],
    icon: 'bank-transfer',
    tone: 'warning',
  },
  {
    key: 'closed',
    label: 'Completed',
    shortLabel: 'Closed',
    statuses: ['Settled', 'Closed'] as ClaimStatus[],
    icon: 'check-decagram-outline',
    tone: 'success',
  },
] as const;
export const operationsQueueDefinitions = [
  { key: 'vehicle-intimation', label: 'Vehicle claims intimated', icon: 'car-emergency', tone: 'info', amount: 'none', statuses: ['Draft', 'Accident Reported', 'Initial Documents Pending', 'Initial Documents Verification Pending', 'Initial Documents Submitted', 'Documents Pending', 'Documents Submitted'] as ClaimStatus[] },
  { key: 'spot-deputation', label: 'Spot deputation pending', icon: 'map-marker-account-outline', tone: 'warning', amount: 'none', statuses: ['Initial Documents Verified', 'Claim Intimated', 'Surveyor Appointed', 'Vehicle Inspected'] as ClaimStatus[] },
  { key: 'claim-intimation', label: 'Claim intimation pending', icon: 'file-send-outline', tone: 'info', amount: 'estimated', statuses: ['Final Documents Awaited', 'Final Documents Verification Pending', 'Final Documents Submitted', 'Final Documents Verified', 'Claim Intimation'] as ClaimStatus[] },
  { key: 'work-approval', label: 'Work approval pending', icon: 'clipboard-check-outline', tone: 'success', amount: 'approved', statuses: ['Estimate Submitted', 'Approval Pending', 'Work Approval Status', 'Work Approval Received'] as ClaimStatus[] },
  { key: 'reinspection', label: 'Re-inspection pending', icon: 'clipboard-search-outline', tone: 'info', amount: 'none', statuses: ['Final Surveyor Details', 'Survey Status', 'Survey Done'] as ClaimStatus[] },
  { key: 'delivery-order', label: 'Delivery order pending', icon: 'file-document-edit-outline', tone: 'warning', amount: 'approved', statuses: ['Under Repair', 'Repair Started', 'Repair Done', 'Repair Completed', 'RA Intimation', 'RA Intimation Done', 'DO Status', 'DO Submitted', 'Final Bill Submitted'] as ClaimStatus[] },
  { key: 'payment', label: 'Payment pending', icon: 'cash-multiple', tone: 'danger', amount: 'settlement', statuses: ['Payment Stage', 'Claim Completion In Progress', 'Claim Complete', 'Settlement Under Process'] as ClaimStatus[] },
  { key: 'closed-claims', label: 'Closed Claims', icon: 'check-circle-outline', tone: 'success', amount: 'none', statuses: ['Closed'] as ClaimStatus[] },
] as const;

export type OperationsQueueKey = (typeof operationsQueueDefinitions)[number]['key'];

export function operationsQueueForKey(key?: string) {
  return operationsQueueDefinitions.find((queue) => queue.key === key);
}

export function isOpenClaimStatus(status: ClaimStatus) {
  return !terminalClaimStatuses.includes(status);
}

export function queueForStatus(status: ClaimStatus) {
  return claimQueueDefinitions.find((queue) => queue.statuses.includes(status)) ?? claimQueueDefinitions[0];
}

export function customerStageCopy(status: ClaimStatus) {
  return projectInternalClaim(status).customerMessage;
}

export function stageAgeLabel(updatedAt?: string | null) {
  if (!updatedAt) return 'New';
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const days = Math.max(0, Math.floor(ageMs / 86_400_000));
  if (days === 0) return 'Updated today';
  if (days === 1) return '1 day in stage';
  return `${days} days in stage`;
}




