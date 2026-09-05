import { DocumentVerificationModalButton } from "./document-verification-modal-v3";
import { VerifyDocumentButton } from "./verify-buttons";

export function VerificationActionButton({ claimId, documentId, itemKey, incidentDate, policyStartDate, policyEndDate }: { claimId: string; documentId: string; itemKey: string; incidentDate?: string | null; policyStartDate?: string | null; policyEndDate?: string | null }) {
  if (itemKey === "spot") {
    return <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="spot" incidentDate={incidentDate} />;
  }

  if (itemKey === "rc") {
    return <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="rc" incidentDate={incidentDate} />;
  }

  if (itemKey === "insurance") {
    return <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="insurance" incidentDate={incidentDate} policyStartDate={policyStartDate} policyEndDate={policyEndDate} />;
  }

  if (itemKey === "dl") {
    return <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="dl" incidentDate={incidentDate} />;
  }

  if (itemKey === "gr") {
    return <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="gr" incidentDate={incidentDate} />;
  }

  return <VerifyDocumentButton claimId={claimId} documentId={documentId} />;
}
