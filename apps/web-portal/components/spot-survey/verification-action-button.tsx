"use client";

import { DocumentVerificationModalButton } from "./document-verification-modal-v3";
import { InsuranceVerificationModalButton } from "./insurance-verification-modal";
import { VerifyDocumentButton } from "./verify-buttons";

const verifyHoverOnlyClass = "[&_button]:!rounded-none [&_button]:!border-transparent [&_button]:!bg-transparent [&_button]:transition-colors [&_button:hover]:!rounded-md [&_button:hover]:!border-green-200 [&_button:hover]:!bg-[#F2FBF7]";

type Props = {
  claimId: string;
  documentId?: string;
  documentIds?: string[];
  itemKey: string;
  incidentDate?: string | null;
  policyStartDate?: string | null;
  policyEndDate?: string | null;
  disabled?: boolean;
  variant?: "row" | "header";
};

export function VerificationActionButton({ claimId, documentId, documentIds, itemKey, incidentDate, policyStartDate, policyEndDate, disabled = false, variant = "row" }: Props) {
  const targetIds = Array.from(new Set((documentIds?.length ? documentIds : documentId ? [documentId] : []).map((id) => id.trim()).filter(Boolean)));

  if (disabled || targetIds.length === 0) {
    return <button type="button" disabled className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-400">Verify</button>;
  }

  const targetDocumentId = targetIds.join(",");
  let action;

  if (itemKey === "spot") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={targetDocumentId} modalType="spot" incidentDate={incidentDate} />;
  } else if (itemKey === "rc") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={targetDocumentId} modalType="rc" incidentDate={incidentDate} />;
  } else if (itemKey === "insurance") {
    action = <InsuranceVerificationModalButton claimId={claimId} documentId={targetDocumentId} incidentDate={incidentDate} policyStartDate={policyStartDate} policyEndDate={policyEndDate} />;
  } else if (itemKey === "dl") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={targetDocumentId} modalType="dl" incidentDate={incidentDate} />;
  } else if (itemKey === "gr") {
    action = <DocumentVerificationModalButton claimId={claimId} documentId={targetDocumentId} modalType="gr" incidentDate={incidentDate} />;
  } else {
    action = <VerifyDocumentButton claimId={claimId} documentId={targetDocumentId} />;
  }

  return <div className={variant === "row" ? verifyHoverOnlyClass : "min-w-[62px]"}>{action}</div>;
}
