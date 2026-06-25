import { DocumentVerificationModalButton } from "./document-verification-modal";
import { VerifyDocumentButton } from "./verify-buttons";

export function VerificationActionButton({ claimId, documentId, itemKey }: { claimId: string; documentId: string; itemKey: string }) {
  if (itemKey === "rc") {
    return <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="rc" />;
  }

  if (itemKey === "insurance") {
    return <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="insurance" />;
  }

  return <VerifyDocumentButton claimId={claimId} documentId={documentId} />;
}
