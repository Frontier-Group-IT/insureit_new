"use client";

import { DocumentVerificationModalButton } from "./document-verification-modal-v3";
import { InsuranceVerificationModalButton } from "./insurance-verification-modal";
import { VerifyDocumentButton } from "./verify-buttons";

const verifyHoverOnlyClass = "[&_button]:!rounded-none [&_button]:!border-transparent [&_button]:!bg-transparent [&_button]:transition-colors [&_button:hover]:!rounded-md [&_button:hover]:!border-green-200 [&_button:hover]:!bg-[#F2FBF7]";
const verifyHeaderPillClass = "[&_button]:!h-auto [&_button]:!w-auto [&_button]:!rounded-full [&_button]:!border [&_button]:!border-slate-200 [&_button]:!bg-slate-100 [&_button]:!px-1.5 [&_button]:!py-0.5 [&_button]:!text-[9px] [&_button]:!font-semibold [&_button]:!text-slate-600 [&_button:hover]:!bg-slate-100";
const verifyHeaderAttentionPillClass = "[&_button]:!h-auto [&_button]:!w-auto [&_button]:!rounded-full [&_button]:!border [&_button]:!border-red-200 [&_button]:!bg-red-50 [&_button]:!px-1.5 [&_button]:!py-0.5 [&_button]:!text-[9px] [&_button]:!font-semibold [&_button]:!text-red-600 [&_button:hover]:!bg-red-100";
const verifyHeaderDisabledClass = "h-auto w-auto rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600";
const verifyHeaderAttentionDisabledClass = "h-auto w-auto rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-600";

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
  attention?: boolean;
};

export function VerificationActionButton({ claimId, documentId, documentIds, itemKey, incidentDate, policyStartDate, policyEndDate, disabled = false, variant = "row", attention = false }: Props) {
  const targetIds = Array.from(new Set((documentIds?.length ? documentIds : documentId ? [documentId] : []).map((id) => id.trim()).filter(Boolean)));

  if (disabled || targetIds.length === 0) {
    const disabledClassName = variant === "header"
      ? attention ? verifyHeaderAttentionDisabledClass : verifyHeaderDisabledClass
      : "h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-400";
    return <button type="button" disabled className={disabledClassName}>Verify</button>;
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

  const headerClassName = attention ? verifyHeaderAttentionPillClass : verifyHeaderPillClass;
  return <div className={variant === "row" ? verifyHoverOnlyClass : headerClassName}>{action}</div>;
}
