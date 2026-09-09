import { DocumentVerificationModalButton } from "./document-verification-modal-v3";
import { InsuranceVerificationModalButton } from "./insurance-verification-modal";
import { VerifyDocumentButton } from "./verify-buttons";

const verifyHoverOnlyClass = "[&_button]:!rounded-none [&_button]:!border-transparent [&_button]:!bg-transparent [&_button]:transition-colors [&_button:hover]:!rounded-md [&_button:hover]:!border-green-200 [&_button:hover]:!bg-[#F2FBF7]";

export function VerificationActionButton({ claimId, documentId, itemKey, incidentDate, policyStartDate, policyEndDate }: { claimId: string; documentId: string; itemKey: string; incidentDate?: string | null; policyStartDate?: string | null; policyEndDate?: string | null }) {
  let action;

  if (itemKey === "spot") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="spot" incidentDate={incidentDate} />;
  } else if (itemKey === "rc") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="rc" incidentDate={incidentDate} />;
  } else if (itemKey === "insurance") {
    action = <InsuranceVerificationModalButton claimId={claimId} documentId={documentId} incidentDate={incidentDate} policyStartDate={policyStartDate} policyEndDate={policyEndDate} />;
  } else if (itemKey === "dl") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="dl" incidentDate={incidentDate} />;
  } else if (itemKey === "gr") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={documentId} modalType="gr" incidentDate={incidentDate} />;
  } else {
    action = <VerifyDocumentButton claimId={claimId} documentId={documentId} />;
  }

  return <div className={verifyHoverOnlyClass}>{action}</div>;
}
