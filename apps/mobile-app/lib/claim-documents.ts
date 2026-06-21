import type { Claim, ClaimDocument, ClaimStatus } from './types';

export type RequiredDocument = {
  type: string;
  title: string;
  body: string;
  icon: string;
};

export const initialClaimDocuments: RequiredDocument[] = [
  { type: 'Accident photos', title: 'Accident photos', body: 'Damage and number plate', icon: 'camera-burst' },
  { type: 'Registration certificate', title: 'Registration certificate', body: 'RC copy', icon: 'card-account-details-outline' },
  { type: 'Driving licence', title: 'Driving licence', body: 'Front and back', icon: 'badge-account-horizontal-outline' },
  { type: 'Policy copy', title: 'Policy copy', body: 'Policy PDF or photo', icon: 'shield-file-outline' },
  { type: 'GR Copy / Road Challan', title: 'GR Copy / Road Challan', body: 'Goods receipt or road challan', icon: 'file-document-multiple-outline' },
];

export const finalClaimDocuments: RequiredDocument[] = [
  { type: 'Repair estimate', title: 'Repair estimate', body: 'Workshop repair estimate', icon: 'receipt-text-outline' },
  { type: 'Claim form', title: 'Claim form', body: 'Duly filled and signed claim form', icon: 'file-sign' },
  { type: 'Driver KYC', title: 'Driver KYC', body: 'Driver Aadhaar card or KYC document', icon: 'card-account-details-outline' },
  { type: 'Tax paid receipt', title: 'Tax paid receipt', body: 'Valid tax paid receipt', icon: 'receipt-text-outline' },
  { type: 'Permit copy A', title: 'Permit copy A', body: 'Permit copy A', icon: 'file-certificate-outline' },
  { type: 'Permit copy B', title: 'Permit copy B', body: 'Permit copy B', icon: 'file-certificate-outline' },
  { type: 'Permit authorization letter', title: 'Permit authorization letter', body: 'Permit authorization letter', icon: 'file-document-outline' },
  { type: 'Vehicle fitness certificate', title: 'Vehicle fitness certificate', body: 'Valid vehicle fitness certificate', icon: 'file-certificate-outline' },
  { type: 'Pollution certificate', title: 'Pollution certificate', body: 'Pollution certificate', icon: 'file-certificate-outline' },
  { type: 'Insured CKYC documents', title: 'Insured CKYC documents', body: 'CKYC form and insured/firm KYC documents', icon: 'card-account-details-outline' },
  { type: 'FIR / Police report', title: 'FIR / Police report', body: 'FIR, police intimation, or GD report if any', icon: 'file-document-outline' },
  { type: 'Affidavit if no FIR', title: 'Affidavit if no FIR', body: 'Affidavit on stamp paper when FIR is not lodged', icon: 'file-sign' },
  { type: 'MLC report', title: 'MLC report', body: 'Required for injury or death cases', icon: 'file-document-outline' },
  { type: 'Driver fitness report', title: 'Driver fitness report', body: 'Required when MLC report is not available', icon: 'file-document-outline' },
  { type: 'Fastag summary report', title: 'Fastag summary report', body: 'Fastag summary report', icon: 'file-document-outline' },
  { type: 'ETP clarification', title: 'ETP clarification', body: 'Electronic transit pass clarification if expired at accident time', icon: 'file-document-outline' },
  { type: 'Final tax invoice', title: 'Final tax invoice', body: 'Final tax invoice copy with seal and signature', icon: 'receipt-text-outline' },
  { type: 'Workshop KYC documents', title: 'Workshop KYC documents', body: 'Workshop PAN, GST, and cancelled cheque copy', icon: 'card-account-details-outline' },
  { type: 'Towing NOC and bill', title: 'Towing NOC and bill', body: 'Customer NOC, towing bill, and towing photos if applicable', icon: 'file-document-multiple-outline' },
  { type: 'Discharge / Satisfaction voucher', title: 'Discharge / Satisfaction voucher', body: 'Discharge voucher or satisfaction voucher', icon: 'file-certificate-outline' },
  { type: 'Previous year policy for NCB', title: 'Previous year policy for NCB', body: 'Previous policy document for NCB confirmation', icon: 'shield-file-outline' },
  { type: 'New vehicle purchase invoice', title: 'New vehicle purchase invoice', body: 'Purchase tax invoice with delivery gate pass', icon: 'receipt-text-outline' },
  { type: 'Highway report', title: 'Highway report', body: 'NHAI highway report for major accidents', icon: 'file-document-outline' },
  { type: 'GPS tracking details', title: 'GPS tracking details', body: 'Vehicle GPS tracking details', icon: 'crosshairs-gps' },
  { type: 'Insurer additional documents', title: 'Insurer additional documents', body: 'Any additional documents requested by insurer', icon: 'file-document-multiple-outline' },
];

const finalDocumentStatuses: ClaimStatus[] = ['Final Documents Awaited', 'Final Documents Verification Pending', 'Final Documents Submitted', 'Final Documents Verified', 'Claim Intimation', 'Final Surveyor Details', 'Survey Status', 'Survey Done', 'Work Approval Status', 'Work Approval Received', 'Under Repair', 'Repair Done', 'RA Intimation', 'RA Intimation Done', 'DO Status', 'Payment Stage', 'Claim Completion In Progress', 'Claim Complete', 'DO Submitted', 'Settlement Under Process', 'Settled', 'Closed'];

export function requiredDocumentsForStatus(status?: ClaimStatus | null, requestedFinalDocumentTypes: string[] = []) {
  if (!status || !finalDocumentStatuses.includes(status)) return initialClaimDocuments;
  if (!requestedFinalDocumentTypes.length) return finalClaimDocuments;
  const requested = new Set(requestedFinalDocumentTypes);
  return finalClaimDocuments.filter((document) => requested.has(document.type));
}

export function hasAllRequiredDocuments(claim: Pick<Claim, 'current_status'>, documents: ClaimDocument[], requestedFinalDocumentTypes: string[] = []) {
  const required = requiredDocumentsForStatus(claim.current_status, requestedFinalDocumentTypes);
  return required.every((section) => documents.some((document) => document.document_type === section.type && document.verification_status !== 'rejected'));
}

export function hasAllRequiredDocumentsVerified(claim: Pick<Claim, 'current_status'>, documents: ClaimDocument[], requestedFinalDocumentTypes: string[] = []) {
  const required = requiredDocumentsForStatus(claim.current_status, requestedFinalDocumentTypes);
  return required.every((section) => documents.some((document) => document.document_type === section.type && document.verification_status === 'verified'));
}

export function submittedStatusFor(claim: Pick<Claim, 'current_status'>): ClaimStatus | null {
  if (claim.current_status === 'Initial Documents Pending' || claim.current_status === 'Documents Pending' || claim.current_status === 'Accident Reported') return 'Initial Documents Verification Pending';
  if (claim.current_status === 'Final Documents Awaited') return 'Final Documents Verification Pending';
  return null;
}

export function verifiedStatusFor(claim: Pick<Claim, 'current_status'>): ClaimStatus | null {
  if (claim.current_status === 'Initial Documents Pending' || claim.current_status === 'Initial Documents Verification Pending' || claim.current_status === 'Initial Documents Submitted' || claim.current_status === 'Documents Pending' || claim.current_status === 'Documents Submitted' || claim.current_status === 'Accident Reported') return 'Initial Documents Verified';
  if (claim.current_status === 'Final Documents Awaited' || claim.current_status === 'Final Documents Verification Pending' || claim.current_status === 'Final Documents Submitted') return 'Final Documents Verified';
  return null;
}

export function replacementStatusFor(claim: Pick<Claim, 'current_status'>): ClaimStatus {
  return finalDocumentStatuses.includes(claim.current_status) ? 'Final Documents Awaited' : 'Initial Documents Pending';
}

export function documentDrivenStatusFor(claim: Pick<Claim, 'current_status'>, documents: ClaimDocument[], requestedFinalDocumentTypes: string[] = []) {
  const verifiedStatus = verifiedStatusFor(claim);
  if (verifiedStatus && hasAllRequiredDocumentsVerified(claim, documents, requestedFinalDocumentTypes)) return verifiedStatus;

  const submittedStatus = submittedStatusFor(claim);
  if (submittedStatus && hasAllRequiredDocuments(claim, documents, requestedFinalDocumentTypes)) return submittedStatus;

  return null;
}

export function documentStatusLabel(status: ClaimDocument['verification_status']) {
  if (status === 'verified') return 'Verified';
  if (status === 'rejected') return 'Replacement needed';
  return 'Pending review';
}




