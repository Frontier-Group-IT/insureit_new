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
  { key: 'delivery-order', label: 'Delivery order pending', icon: 'file-document-edit-outline', tone: 'warning', amount: 'none', statuses: ['Under Repair', 'Repair Started', 'Repair Done', 'Repair Completed', 'RA Intimation', 'RA Intimation Done', 'DO Status', 'DO Submitted', 'Final Bill Submitted'] as ClaimStatus[] },
  { key: 'payment', label: 'Payment pending', icon: 'cash-multiple', tone: 'danger', amount: 'settlement', statuses: ['Payment Stage', 'Claim Completion In Progress', 'Claim Complete', 'Settlement Under Process'] as ClaimStatus[] },
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
  if (status === 'Accident Reported') return 'Your accident report has been received. Upload clear documents so the claim desk can begin verification.';
  if (status === 'Initial Documents Pending' || status === 'Documents Pending') return 'The claim desk needs corrected or missing initial documents from you.';
  if (status === 'Initial Documents Verification Pending' || status === 'Initial Documents Submitted' || status === 'Documents Submitted') return 'Your initial documents are waiting for claim desk verification.';
  if (status === 'Initial Documents Verified') return 'Initial documents are verified. The claim team will appoint the surveyor next.';
  if (status === 'Claim Intimated') return 'The insurer has been informed and the claim reference process has started.';
  if (status === 'Surveyor Appointed') return 'A surveyor has been assigned. Keep the vehicle and repair estimate ready.';
  if (status === 'Vehicle Inspected') return 'Inspection is complete. The repair estimate and approval steps are next.';
  if (status === 'Final Documents Awaited') return 'The claim desk needs the final claim documents from you.';
  if (status === 'Final Documents Verification Pending' || status === 'Final Documents Submitted') return 'Your final documents are waiting for claim desk verification.';
    if (status === 'Final Documents Verified') return 'Final documents are verified. The claim desk will draft the insurer intimation next.';
  if (status === 'Claim Intimation') return 'The insurer intimation draft is ready with the final document links for manager review.';
  if (status === 'Final Surveyor Details') return 'Final surveyor details have been recorded by the claim desk.';
  if (status === 'Survey Status') return 'The final survey is being tracked by the claim desk.';
  if (status === 'Survey Done') return 'The final survey is complete. Work approval is the next checkpoint.';
  if (status === 'Work Approval Status') return 'Work approval is being followed up with the insurer.';
  if (status === 'Work Approval Received') return 'Work approval is complete. Repair will begin next.';
  if (status === 'Repair Done') return 'Repair work is complete. RA intimation is the next step.';
  if (status === 'Under Repair') return 'The vehicle is under repair. RA intimation will follow after invoice details.';
  if (status === 'RA Intimation') return 'RA intimation is being prepared with invoice and repair amount details.';
  if (status === 'RA Intimation Done') return 'RA intimation is complete. Delivery order details are next.';
  if (status === 'DO Status') return 'Delivery order amount and assessment report are being recorded.';
  if (status === 'Payment Stage') return 'Payment advice and bill difference details are being tracked.';
  if (status === 'Claim Completion In Progress') return 'Payment is complete. The claim desk is recording closure details.';
  if (status === 'Claim Complete') return 'Final receipt details are recorded. The claim desk will close the file.';
  if (status === 'Estimate Submitted' || status === 'Approval Pending') return 'Repair approval is under review. The team will update you once approval is received.';
  if (status === 'Repair Started' || status === 'Repair Completed') return 'Repair work is being tracked. Final billing will follow.';
  if (status === 'DO Submitted') return 'Delivery order details are submitted. Settlement processing is next.';
  if (status === 'Final Bill Submitted') return 'Final bills are with the claim team for settlement processing.';
  if (status === 'Settlement Under Process') return 'Settlement is being processed. Payment advice will appear once available.';
  if (status === 'Settled' || status === 'Closed') return 'The claim journey is complete and available for reference.';
  if (status === 'Rejected') return 'The claim needs support attention. Contact the claims desk for the reason and next options.';
  return 'The claim is being prepared.';
}

export function stageAgeLabel(updatedAt?: string | null) {
  if (!updatedAt) return 'New';
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const days = Math.max(0, Math.floor(ageMs / 86_400_000));
  if (days === 0) return 'Updated today';
  if (days === 1) return '1 day in stage';
  return `${days} days in stage`;
}


