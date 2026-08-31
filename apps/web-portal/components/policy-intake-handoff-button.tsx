"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { preparePolicyIntakeHandoff } from "@/app/policy-intakes/handoff-actions";

export function PolicyIntakeHandoffButton({ id, status }: { id: string; status?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [takeoverReviewer, setTakeoverReviewer] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function continueToOnboarding(takeOver = false) {
    setError(null);
    startTransition(async () => {
      const result = await preparePolicyIntakeHandoff(id, takeOver);
      if (!result.ok) {
        if (result.conflict) {
          setTakeoverReviewer(result.reviewerName);
          return;
        }
        setError(result.error);
        return;
      }
      setTakeoverReviewer(null);
      router.push(`/policies/new?intake_id=${encodeURIComponent(id)}`);
    });
  }

  return <>
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={() => continueToOnboarding(false)} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#17365D] text-[10px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.20)] disabled:opacity-60">
        <CheckCircle2 className="h-4 w-4" />{pending ? "Preparing…" : status === "in_review" ? "Resume Policy Onboarding" : "Review & Finalize"}<ArrowRight className="h-4 w-4" />
      </button>
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-semibold text-red-700">{error}</p> : null}
    </div>

    {takeoverReviewer ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4" role="dialog" aria-modal="true" aria-labelledby="policy-intake-reviewer-change-title">
      <div className="w-full max-w-[420px] rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,.28)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700"><AlertTriangle className="h-4.5 w-4.5" /></span>
            <div>
              <h2 id="policy-intake-reviewer-change-title" className="text-[14px] font-semibold text-[#17365D]">Change reviewer?</h2>
              <p className="mt-1.5 text-[10px] leading-5 text-[#64748B]">This intake is currently being reviewed by <span className="font-semibold text-[#334155]">{takeoverReviewer}</span>. If you continue, the reviewer will be changed to you and you can proceed with Policy Onboarding.</p>
            </div>
          </div>
          <button type="button" disabled={pending} onClick={() => setTakeoverReviewer(null)} className="rounded-lg p-1 text-[#7A8798] hover:bg-slate-100" aria-label="Close reviewer change dialog"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button type="button" disabled={pending} onClick={() => setTakeoverReviewer(null)} className="h-10 rounded-xl border border-[#D8E0EA] bg-white text-[9px] font-bold text-[#475569] disabled:opacity-60">Keep current reviewer</button>
          <button type="button" disabled={pending} onClick={() => continueToOnboarding(true)} className="h-10 rounded-xl bg-[#17365D] text-[9px] font-bold text-white disabled:opacity-60">{pending ? "Changing…" : "Change reviewer & continue"}</button>
        </div>
      </div>
    </div> : null}
  </>;
}
