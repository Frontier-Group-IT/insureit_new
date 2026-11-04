"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, X } from "lucide-react";
import { PolicyDateApprovalWidget } from "@/components/policy-date-approval-widget";

type Props = {
  issuanceDate: string;
  policyNumber: string;
  operation: "create" | "edit";
  existingPolicyId?: string | null;
  intermediaryCode?: string;
  verifiedApprovalId: string | null;
  onApproved: (id: string | null) => void;
  onClose: () => void;
  onConfirm: () => void;
  submitting?: boolean;
};

export function PolicyDateApprovalDialog(props: Props) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !props.submitting) props.onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [props.onClose, props.submitting]);

  if (typeof document === "undefined") return null;
  const formattedDate = /^\d{4}-\d{2}-\d{2}$/.test(props.issuanceDate)
    ? props.issuanceDate.slice(8, 10) + "/" + props.issuanceDate.slice(5, 7) + "/" + props.issuanceDate.slice(0, 4)
    : props.issuanceDate;
  return createPortal(
    <div className="fixed inset-0 z-[9999] grid h-[100dvh] w-full place-items-center bg-[#091C38]/60 p-3 backdrop-blur-sm sm:p-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="policy-date-approval-title" aria-describedby="policy-date-approval-description" className="w-full max-w-[540px] max-h-[min(95dvh,760px)] overflow-y-auto rounded-2xl border border-[#DDE7F2] bg-white shadow-[0_25px_85px_rgba(6,25,56,.28)]">
        <div className="flex items-start justify-between border-b border-[#E5EBF3] bg-white px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#17365D] text-white"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h2 id="policy-date-approval-title" className="text-[15px] font-bold text-[#17365D]">Policy Date Approval</h2>
              <p id="policy-date-approval-description" className="mt-0.5 text-[11px] text-[#657B97]">Approval is required because this policy is being added after the permitted submission window.</p>
            </div>
          </div>
          <button type="button" aria-label="Close approval" onClick={props.onClose} disabled={props.submitting} className="rounded-lg p-1.5 text-[#60758D] hover:bg-[#EAF0F7] disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 px-4 py-3 sm:px-5">
          <dl className="grid grid-cols-2 gap-2 rounded-xl border border-[#E0E8F3] bg-[#FAFCFF] p-3">
            <div className="min-w-0"><dt className="text-[10px] text-[#667B94]">Policy issuance date</dt><dd className="mt-1 text-[12px] font-bold text-[#19395C]">{formattedDate}</dd></div>
            <div className="min-w-0"><dt className="text-[10px] text-[#667B94]">Policy number</dt><dd className="mt-1 break-all text-[12px] font-bold text-[#19395C]">{props.policyNumber || "—"}</dd></div>
          </dl>
          <PolicyDateApprovalWidget
            key={props.operation + ":" + props.existingPolicyId + ":" + props.policyNumber + ":" + props.issuanceDate}
            issuanceDate={props.issuanceDate}
            policyNumber={props.policyNumber}
            operation={props.operation}
            existingPolicyId={props.existingPolicyId}
            intermediaryCode={props.intermediaryCode}
            verifiedApprovalId={props.verifiedApprovalId}
            onApproved={props.onApproved}
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#E5EBF3] bg-white px-4 py-3 sm:px-5">
          <button type="button" disabled={props.submitting} onClick={props.onClose} className="rounded-lg border border-[#D3DEEC] px-4 py-2.5 text-[11px] font-semibold text-[#405C78] hover:bg-white disabled:opacity-50">Cancel</button>
          <button type="button" disabled={!props.verifiedApprovalId || props.submitting} onClick={props.onConfirm} className="rounded-lg bg-[#17365D] px-4 py-2.5 text-[11px] font-bold text-white hover:bg-[#10294A] disabled:cursor-not-allowed disabled:opacity-45">{props.submitting ? "Saving…" : "Confirm & Submit"}</button>
        </div>
      </section>
    </div>, document.body,
  );
}
