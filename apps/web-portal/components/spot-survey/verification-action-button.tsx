import { DocumentVerificationModalButton } from "./document-verification-modal";
import { VerifyDocumentButton } from "./verify-buttons";

export function VerificationActionButton({ claimId, documentId, itemKey, incidentDate }: { claimId: string; documentId: string; itemKey: string; incidentDate?: string | null }) {
  if (itemKey === "rc") {
    return <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="rc" incidentDate={incidentDate} />;
  }

  if (itemKey === "insurance") {
    return <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="insurance" incidentDate={incidentDate} />;
  }

  return <VerifyDocumentButton claimId={claimId} documentId={documentId} />;
}
