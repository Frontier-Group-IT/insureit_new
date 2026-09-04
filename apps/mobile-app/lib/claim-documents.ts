import type { Claim, ClaimDocument, ClaimStatus, ClaimTask } from './types';
import {
  CLAIM_INTIMATION_DOCUMENT_GROUPS,
  matchesClaimIntimationDocument,
} from '@insureit/claim-journey';

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

export const finalDocumentGroups: FinalDocumentGroup[] = CLAIM_INTIMATION_DOCUMENT_GROUPS.map((group) => ({
  key: group.key,
  title: group.label,
  documents: group.documents.map((document) => ({ ...document })),
}));

export const finalClaimDocuments: RequiredDocument[] = finalDocumentGroups.flatMap((group) => group.documents);

const finalDocumentStatuses: ClaimStatus[] = ['Final Documents Awaited', 'Final Documents Verification Pending', 'Final Documents Submitted', 'Final Documents Verified', 'Claim Intimation', 'Final Surveyor Details', 'Survey Status', 'Survey Done', 'Work Approval Status', 'Work Approval Received', 'Under Repair', 'Repair Done', 'RA Intimation', 'RA Intimation Done', 'DO Status', 'Payment Stage', 'Claim Completion In Progress', 'Claim Complete', 'DO Submitted', 'Settlement Under Process', 'Settled', 'Closed'];

export function requiredDocumentsForStatus(status?: ClaimStatus | null, requestedFinalDocumentTypes: string[] = []) {
  if (!status || !finalDocumentStatuses.includes(status)) return initialClaimDocuments;
  if (!requestedFinalDocumentTypes.length) return finalClaimDocuments;
  return finalClaimDocuments.filter((document) =>
    requestedFinalDocumentTypes.some((requestedType) =>
      matchesClaimIntimationDocument(requestedType, document.type),
    ),
  );
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
  if (matchesClaimIntimationDocument(documentType, requiredType)) return true;
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
  const requestedTypes = tasks
    .filter((task) => task.claim_id === claimId && task.status === 'open' && task.title.startsWith('Final document: '))
    .map((task) => task.title.slice('Final document: '.length));
  if (!requestedTypes.length) return [];

  const canonicalTypes = finalClaimDocuments
    .filter((document) => requestedTypes.some((requestedType) => matchesClaimIntimationDocument(requestedType, document.type)))
    .map((document) => document.type);

  // A task set from the retired Operations catalogue is not a partial request.
  // Fall back to the complete current catalogue instead of silently omitting rows.
  return canonicalTypes.length === requestedTypes.length ? canonicalTypes : [];
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
