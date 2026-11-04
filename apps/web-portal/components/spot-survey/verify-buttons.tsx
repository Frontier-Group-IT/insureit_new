"use client";

import { useRouter } from "next/navigation";
import { ClaimStageErrorDialog } from "@/components/claim-manager/claim-stage-error-dialog";
import { useState, useTransition } from "react";
import { verifyClaimDocumentWithAdditionalUploadCompat } from "@/app/claims/[id]/claim-document-verification-compat-actions";
import { verifySpotSurveyDetail } from "@/app/claims/[id]/spot-survey-actions";

type ActionState = {
  ok: boolean;
  message?: string;
};

export function VerifyDocumentButton({ claimId, documentId, disabled = false }: { claimId: string; documentId: string; disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  return (
    <div className="min-w-0">
      <ClaimStageErrorDialog message={state && !state.ok ? state.message ?? "Verification failed." : null} onClose={() => setState(null)} />
      <button
        type="button"
        disabled={disabled || isPending}
        onClick={() => {
          setState(null);
          startTransition(async () => {
            const formData = new FormData();
            formData.set("claimId", claimId);
            formData.set("documentId", documentId);
            try {
              const result = await verifyClaimDocumentWithAdditionalUploadCompat(formData);
              setState(result);
              if (result.ok) router.refresh();
            } catch (error) {
              setState({ ok: false, message: error instanceof Error ? error.message : "Verification failed. Please try again." });
            }
          });
        }}
        className="h-8 w-full rounded-md border border-[#16A36A] bg-white text-[12px] font-semibold text-[#16895C] transition hover:bg-[#F2FBF7] disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
      >
        {isPending ? "Verifying..." : state?.ok ? "Verified" : "Verify"}
      </button>
      
    </div>
  );
}

export function VerifyDetailButton({ claimId, detailKey, detailLabel, detailValue, disabled = false }: { claimId: string; detailKey: string; detailLabel: string; detailValue: string; disabled?: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState | null>(null);

  return (
    <div className="min-w-0">
      <ClaimStageErrorDialog message={state && !state.ok ? state.message ?? "Verification failed." : null} onClose={() => setState(null)} />
      <button
        type="button"
        disabled={disabled || isPending}
        onClick={() => {
          setState(null);
          startTransition(async () => {
            const formData = new FormData();
            formData.set("claimId", claimId);
            formData.set("detailKey", detailKey);
            formData.set("detailLabel", detailLabel);
            formData.set("detailValue", detailValue);
            try {
              const result = await verifySpotSurveyDetail(formData);
              setState(result);
              if (result.ok) router.refresh();
            } catch (error) {
              setState({ ok: false, message: error instanceof Error ? error.message : "Verification failed. Please try again." });
            }
          });
        }}
        className="h-8 w-full rounded-md border border-[#16A36A] bg-white text-[12px] font-semibold text-[#16895C] transition hover:bg-[#F2FBF7] disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
      >
        {isPending ? "Verifying..." : state?.ok ? "Verified" : "Verify"}
      </button>
      
    </div>
  );
}
