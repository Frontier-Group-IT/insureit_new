import type { Claim, ClaimDocument, ClaimStatus, ClaimTask } from './types';

export type RequiredDocument = {
  type: string;
  title: string;
  body: string;
  icon: string;
};

export type FinalDocumentGroup = {
  key: string;
  title: string;
  documents: RequiredDocument[];
};

export const initialClaimDocuments: RequiredDocument[] = [
  { type: 'Accident Photo', title: 'Accident Photo', body: 'Damage, vehicle position and number plate', icon: 'camera-burst' },
  { type: 'RC Copy', title: 'RC Copy', body: 'Registration certificate copy', icon: 'card-account-details-outline' },
  { type: 'Insurance Copy', title: 'Insurance Copy', body: 'Insurance policy copy', icon: 'shield-file-outline' },
  { type: 'Driver Licence', title: 'Driver Licence', body: 'Front and back', icon: 'badge-account-horizontal-outline' },
  { type: 'GR / Load Bill', title: 'GR / Load Bill', body: 'Goods receipt or load challan', icon: 'file-document-multiple-outline' },
  { type: 'Accident Video', title: 'Accident Video', body: 'Accident scene video', icon: 'video-outline' },
];

const initialDocumentTypeAliases: Record<string, string[]> = {
  'Accident Photo': ['accident photo', 'spot photo', 'spot image', 'loss photo', 'vehicle photo'],
  'RC Copy': ['rc copy', 'registration certificate'],
  'Insurance Copy': ['insurance copy', 'policy copy'],
  'Driver Licence': ['driver licence', 'driving licence', 'driving licence copy', 'dl copy'],
  'GR / Load Bill': ['gr / load bill', 'gr copy / load challan', 'gr copy / road challan', 'gr / load challan', 'road challan', 'load challan'],
  'Accident Video': ['accident video', 'loss video', 'vehicle video'],
};

export const finalDocumentGroups: FinalDocumentGroup[] = [
  {
    key: 'forms',
    title: 'Forms',
    documents: [
      { type: 'Claim Form', title: 'Claim Form', body: 'Signed claim form', icon: 'file-sign' },
      { type: 'TP Affidavit', title: 'TP Affidavit', body: 'Third-party affidavit', icon: 'file-document-edit-outline' },
      { type: 'Towing Bill', title: 'Towing Bill', body: 'Towing bill copy', icon: 'tow-truck' },
      { type: 'Repair estimate', title: 'Repair estimate', body: 'Workshop repair estimate', icon: 'receipt-text-outline' },
      { type: 'NCB VERIFICATION', title: 'NCB VERIFICATION', body: 'NCB verification document', icon: 'shield-check-outline' },
    ],
  },
  {
    key: 'permit-tax',
    title: 'Permit / Tax',
    documents: [
      { type: 'Road Tax', title: 'Road Tax', body: 'Road tax receipt', icon: 'receipt-text-outline' },
      { type: 'Local permit A', title: 'Local permit A', body: 'Local permit A copy', icon: 'file-certificate-outline' },
      { type: 'LOCAL PERMIT B', title: 'LOCAL PERMIT B', body: 'Local permit B copy', icon: 'file-certificate-outline' },
      { type: 'National Permit', title: 'National Permit', body: 'National permit copy', icon: 'file-certificate-outline' },
      { type: 'Authorization letter', title: 'Authorization letter', body: 'Authorization letter copy', icon: 'file-document-outline' },
    ],
  },
  {
    key: 'spots-papers',
    title: 'Spots Papers',
    documents: [
      { type: 'RC Copy', title: 'RC Copy', body: 'Registration certificate copy', icon: 'card-account-details-outline' },
      { type: 'Insurance copy', title: 'Insurance copy', body: 'Insurance policy copy', icon: 'shield-file-outline' },
      { type: 'Fitness copy', title: 'Fitness copy', body: 'Vehicle fitness copy', icon: 'file-certificate-outline' },
      { type: 'GR/Load bill', title: 'GR/Load bill', body: 'GR or load bill copy', icon: 'file-document-multiple-outline' },
      { type: 'Fasttag report last 15 days', title: 'Fasttag report last 15 days', body: 'Fastag report for last 15 days', icon: 'file-document-outline' },
      { type: 'Spot Report', title: 'Spot Report', body: 'Spot survey or inspection report', icon: 'clipboard-text-outline' },
      { type: 'Estimate Copy', title: 'Estimate Copy', body: 'Workshop estimate copy', icon: 'receipt-text-outline' },
    ],
  },
  {
    key: 'driver-docs',
    title: 'Driver Docs',
    documents: [
      { type: 'Driver Licence', title: 'Driver Licence', body: 'Driver licence copy', icon: 'badge-account-horizontal-outline' },
      { type: 'Driver Aadharcard front', title: 'Driver Aadharcard front', body: 'Driver Aadhaar front side', icon: 'card-account-details-outline' },
      { type: 'Driver Aadharcard Back', title: 'Driver Aadharcard Back', body: 'Driver Aadhaar back side', icon: 'card-account-details-outline' },
      { type: 'Driver Statement', title: 'Driver Statement', body: 'Driver statement document', icon: 'file-document-edit-outline' },
    ],
  },
  {
    key: 'kyc-dealership',
    title: 'KYC DEALERSHIP',
    documents: [
      { type: 'Aadharcard', title: 'Aadharcard', body: 'Aadhaar card copy', icon: 'card-account-details-outline' },
      { type: 'Pancard', title: 'Pancard', body: 'PAN card copy', icon: 'card-account-details-outline' },
      { type: 'GST', title: 'GST', body: 'GST certificate', icon: 'file-certificate-outline' },
      { type: 'Cancel Cheque', title: 'Cancel Cheque', body: 'Cancelled cheque copy', icon: 'checkbook' },
      { type: 'KYC FORM', title: 'KYC FORM', body: 'KYC form copy', icon: 'file-sign' },
    ],
  },
];

export const finalClaimDocuments: RequiredDocument[] = finalDocumentGroups.flatMap((group) => group.documents);

const finalDocumentStatuses: ClaimStatus[] = ['Final Documents Awaited', 'Final Documents Verification Pending', 'Final Documents Submitted', 'Final Documents Verified', 'Claim Intimation', 'Final Surveyor Details', 'Survey Status', 'Survey Done', 'Work Approval Status', 'Work Approval Received', 'Under Repair', 'Repair Done', 'RA Intimation', 'RA Intimation Done', 'DO Status', 'Payment Stage', 'Claim Completion In Progress', 'Claim Complete', 'DO Submitted', 'Settlement Under Process', 'Settled', 'Closed'];

export function requiredDocumentsForStatus(status?: ClaimStatus | null, requestedFinalDocumentTypes: string[] = []) {
  if (!status || !finalDocumentStatuses.includes(status)) return initialClaimDocuments;
  if (!requestedFinalDocumentTypes.length) return finalClaimDocuments;
  const requested = new Set(requestedFinalDocumentTypes);
  return finalClaimDocuments.filter((document) => requested.has(document.type));
}

export function hasAllRequiredDocuments(claim: Pick<Claim, 'current_status'>, documents: ClaimDocument[], requestedFinalDocumentTypes: string[] = []) {
  const required = requiredDocumentsForStatus(claim.current_status, requestedFinalDocumentTypes);
  return required.every((section) => documents.some((document) => matchesRequiredDocument(document.document_type, section.type) && document.verification_status !== 'rejected'));
}

export function hasAllRequiredDocumentsVerified(claim: Pick<Claim, 'current_status'>, documents: ClaimDocument[], requestedFinalDocumentTypes: string[] = []) {
  const required = requiredDocumentsForStatus(claim.current_status, requestedFinalDocumentTypes);
  return required.every((section) => documents.some((document) => matchesRequiredDocument(document.document_type, section.type) && document.verification_status === 'verified'));
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

export function matchesRequiredDocument(documentType: string, requiredType: string) {
  const normalized = documentType.trim().toLowerCase();
  const aliases = initialDocumentTypeAliases[requiredType];
  return aliases ? aliases.some((alias) => normalized.includes(alias)) : normalized === requiredType.trim().toLowerCase();
}

export function hasOutstandingRejectedDocuments(documents: ClaimDocument[]) {
  const latestByType = new Map<string, ClaimDocument>();
  for (const document of documents) {
    const key = canonicalDocumentType(document.document_type);
    const current = latestByType.get(key);
    if (!current || timestamp(document.created_at) > timestamp(current.created_at)) {
      latestByType.set(key, document);
    }
  }
  return [...latestByType.values()].some((document) => document.verification_status === 'rejected');
}

export function hasOutstandingRejectedDocumentsForStatus(
  claim: Pick<Claim, 'current_status'>,
  documents: ClaimDocument[],
  requestedFinalDocumentTypes: string[] = [],
) {
  const required = requiredDocumentsForStatus(claim.current_status, requestedFinalDocumentTypes);
  const relevantDocuments = documents.filter((document) => required.some((requiredDocument) => matchesRequiredDocument(document.document_type, requiredDocument.type)));
  return hasOutstandingRejectedDocuments(relevantDocuments);
}

export function requestedFinalDocumentTypesFor(claimId: string, tasks: ClaimTask[]) {
  return tasks
    .filter((task) => task.claim_id === claimId && task.status === 'open' && task.title.startsWith('Final document: '))
    .map((task) => task.title.slice('Final document: '.length));
}

function canonicalDocumentType(documentType: string) {
  const normalized = documentType.trim().toLowerCase();
  const initialType = Object.entries(initialDocumentTypeAliases)
    .find(([, aliases]) => aliases.some((alias) => normalized.includes(alias)))?.[0];
  return initialType ?? normalized;
}

function timestamp(value?: string) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}
