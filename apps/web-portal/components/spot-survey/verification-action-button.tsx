"use client";

import { DocumentVerificationModalButton } from "./document-verification-modal-v3";
import { InsuranceVerificationModalButton } from "./insurance-verification-modal";
import { VerifyDocumentButton } from "./verify-buttons";
import { useState } from "react";
import { createPortal } from "react-dom";

const verifyHoverOnlyClass = "[&_button]:!rounded-none [&_button]:!border-transparent [&_button]:!bg-transparent [&_button]:transition-colors [&_button:hover]:!rounded-md [&_button:hover]:!border-green-200 [&_button:hover]:!bg-[#F2FBF7]";
const verifyHeaderPillClass = "[&_button]:!h-auto [&_button]:!w-auto [&_button]:!rounded-full [&_button]:!border [&_button]:!border-slate-200 [&_button]:!bg-slate-100 [&_button]:!px-1.5 [&_button]:!py-0.5 [&_button]:!text-[9px] [&_button]:!font-semibold [&_button]:!text-slate-600 [&_button:hover]:!bg-slate-100";
const verifyHeaderAttentionPillClass = "motion-safe:[&_button]:animate-pulse [&_button]:!ring-1 [&_button]:!ring-red-300 [&_button]:!shadow-[0_0_12px_rgba(239,68,68,0.28)] [&_button]:!h-auto [&_button]:!w-auto [&_button]:!rounded-full [&_button]:!border [&_button]:!border-red-200 [&_button]:!bg-red-50 [&_button]:!px-1.5 [&_button]:!py-0.5 [&_button]:!text-[9px] [&_button]:!font-semibold [&_button]:!text-red-600 [&_button:hover]:!bg-red-100";
const verifyHeaderDisabledClass = "h-auto w-auto rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600";
const verifyHeaderAttentionDisabledClass = "motion-safe:animate-pulse ring-1 ring-red-300 shadow-[0_0_12px_rgba(239,68,68,0.28)] h-auto w-auto rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-600";

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
  prefillDetails?: Record<string, unknown> | null;
};

export function VerificationActionButton({ claimId, documentId, documentIds, itemKey, incidentDate, policyStartDate, policyEndDate, disabled = false, variant = "row", attention = false, prefillDetails = null }: Props) {
  const targetIds = Array.from(new Set((documentIds?.length ? documentIds : documentId ? [documentId] : []).map((id) => id.trim()).filter(Boolean)));

  if (disabled || targetIds.length === 0) {
    if (variant === "header") return <EmptySelectionVerifyButton attention={attention} />;
    return <button type="button" disabled className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-400">Verify</button>;
  }

  const targetDocumentId = targetIds.join(",");
  let action;

  if (itemKey === "spot") {
    action = <DocumentVerificationModalButton key={targetDocumentId} claimId={claimId} documentId={targetDocumentId} modalType="spot" incidentDate={incidentDate} initialDetails={prefillDetails} />;
  } else if (itemKey === "rc") {
    action = <DocumentVerificationModalButton key={targetDocumentId} claimId={claimId} documentId={targetDocumentId} modalType="rc" incidentDate={incidentDate} initialDetails={prefillDetails} />;
  } else if (itemKey === "insurance") {
    action = <InsuranceVerificationModalButton key={targetDocumentId} claimId={claimId} documentId={targetDocumentId} incidentDate={incidentDate} policyStartDate={policyStartDate} policyEndDate={policyEndDate} initialDetails={prefillDetails} />;
  } else if (itemKey === "dl") {
    action = <DocumentVerificationModalButton key={targetDocumentId} claimId={claimId} documentId={targetDocumentId} modalType="dl" incidentDate={incidentDate} initialDetails={prefillDetails} />;
  } else if (itemKey === "gr") {
    action = <DocumentVerificationModalButton key={targetDocumentId} claimId={claimId} documentId={targetDocumentId} modalType="gr" incidentDate={incidentDate} initialDetails={prefillDetails} />;
  } else {
    action = <VerifyDocumentButton claimId={claimId} documentId={targetDocumentId} />;
  }

  const headerClassName = attention ? verifyHeaderAttentionPillClass : verifyHeaderPillClass;
  return <div className={variant === "row" ? verifyHoverOnlyClass : headerClassName}>{action}</div>;
}


function EmptySelectionVerifyButton({ attention }: { attention: boolean }) {
  const [open, setOpen] = useState(false);
  const className = attention ? verifyHeaderAttentionDisabledClass : verifyHeaderDisabledClass;
  return <>
    <button type="button" onClick={() => setOpen(true)} className={className}>Verify</button>
    {open && typeof document !== "undefined" ? createPortal(
      <div className="fixed inset-0 z-[120] grid place-items-center bg-[#071D49]/40 px-4">
        <div role="alertdialog" aria-modal="true" aria-labelledby="verify-selection-warning" aria-describedby="verify-selection-message" className="w-full max-w-[525px] overflow-hidden rounded-[20px] bg-white shadow-[0_24px_70px_rgba(7,29,73,.24)]">
          <div className="flex flex-col items-center px-5 pb-6 pt-7 text-center">
            <div aria-hidden="true" className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#FFF1E6] text-[24px] font-medium text-[#E87525]">!</div>
            <h2 id="verify-selection-warning" className="mt-5 text-[18px] font-semibold text-[#142C4B]">Select a document</h2>
            <p id="verify-selection-message" className="mt-3 text-[13px] leading-5 text-[#77849A]">Please select a document before verifying.</p>
          </div>
          <div className="border-t border-[#E4E9F0] px-6 py-4"><button type="button" autoFocus onClick={() => setOpen(false)} className="h-[50px] w-full rounded-xl bg-[#19385E] text-[13px] font-semibold text-white">OK</button></div>
        </div>
      </div>,
      document.body,
    ) : null}
  </>;
}