import { initialClaimDocuments, matchesRequiredDocument } from './claim-documents';
import type { ClaimDocument } from './types';
import type { ClaimMilestoneKey } from './claim-service-mode';

export type ClaimReuploadNotice = {
  id: string;
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// Only these stages expose an editable claim-document upload section.
const validStages: ClaimMilestoneKey[] = [
  'spot_intimation', 'claim_intimation', 'work_approval', 'billing', 'delivery_order',
];

export function reuploadDocumentType(notice: ClaimReuploadNotice): string {
  const type = notice.metadata?.document_type;
  return typeof type === 'string' && type.trim() ? type.trim() : notice.title.trim();
}

export function outstandingClaimReuploads(notices: ClaimReuploadNotice[], documents: ClaimDocument[]) {
  // Most recent upload wins; a verified/pending replacement clears an old reject notice.
  const newest = [...documents].sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''));
  const seen: string[] = [];
  return [...notices]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .filter((notice) => {
      const type = reuploadDocumentType(notice);
      if (!type || seen.some((other) => matchesRequiredDocument(type, other) || matchesRequiredDocument(other, type))) return false;
      seen.push(type);
      const latest = newest.find((document) => matchesRequiredDocument(document.document_type, type) || matchesRequiredDocument(type, document.document_type));
      return latest?.verification_status === 'rejected';
    });
}

export function reuploadDocumentStage(documentType: string, documents: ClaimDocument[]): ClaimMilestoneKey {
  const latest = [...documents].sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''))
    .find((doc) => matchesRequiredDocument(doc.document_type, documentType) || matchesRequiredDocument(documentType, doc.document_type));
  const normalized = documentType.toLowerCase();
  // Initial documents always belong to Spot Intimation even if older imports
  // lack a milestone or saved an inconsistent one.
  if (normalized.includes('incident voice note') || normalized.includes('spot intimation attachment') ||
    initialClaimDocuments.some((required) => matchesRequiredDocument(documentType, required.type))) return 'spot_intimation';
  const stage = (latest as ClaimDocument & { milestone_key?: string | null } | undefined)?.milestone_key;
  if (stage && validStages.includes(stage as ClaimMilestoneKey)) return stage as ClaimMilestoneKey;
  if (normalized.includes('approval pdf') || normalized.includes('surveyor approval') || normalized.includes('work approval attachment')) return 'work_approval';
  if (normalized.includes('final workshop bill')) return 'billing';
  if (normalized.includes('assessment report')) return 'delivery_order';
  return 'claim_intimation';
}
