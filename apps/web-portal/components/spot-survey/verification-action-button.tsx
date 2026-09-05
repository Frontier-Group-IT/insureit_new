import { DocumentVerificationModalButton } from "./document-verification-modal-v3";
import { VerifyDocumentButton } from "./verify-buttons";

export function VerificationActionButton({ claimId, documentId, itemKey, incidentDate, policyStartDate, policyEndDate }: { claimId: string; documentId: string; itemKey: string; incidentDate?: string | null; policyStartDate?: string | null; policyEndDate?: string | null }) {
  let action;

  if (itemKey === "spot") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="spot" incidentDate={incidentDate} />;
  } else if (itemKey === "rc") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="rc" incidentDate={incidentDate} />;
  } else if (itemKey === "insurance") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="insurance" incidentDate={incidentDate} policyStartDate={policyStartDate} policyEndDate={policyEndDate} />;
  } else if (itemKey === "dl") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="dl" incidentDate={incidentDate} />;
  } else if (itemKey === "gr") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="gr" incidentDate={incidentDate} />;
  } else {
    return <VerifyDocumentButton claimId={claimId} documentId={documentId} />;
  }

  return (
    <div className="claim-document-verification-action">
      {action}
      <style>{`
        main:has(.claim-document-verification-action .fixed.inset-0.z-50),
        section:has(.claim-document-verification-action .fixed.inset-0.z-50) {
          overflow: visible !important;
        }

        .animate-portal-enter:has(.claim-document-verification-action .fixed.inset-0.z-50) {
          animation: none !important;
          transform: none !important;
        }

        .claim-document-verification-action .fixed.inset-0.z-50 {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100dvh !important;
          max-width: none !important;
        }
      `}</style>
    </div>
  );
}
