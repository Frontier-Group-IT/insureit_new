"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveFinalDocuments, processFinalDocuments, returnFinalDocuments } from "./final-stage-actions";

type Result = { ok: boolean; message?: string };

export function FinalStageDecisionPanel({ claimId, role, decision }: { claimId: string; role: string | null; decision: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Result | null>(null);
  const canProcess = role === "admin" || role === "claim_processor";
  const canReview = role === "super_admin" || role === "manager" || role === "it_super_user";

  function run(action: (formData: FormData) => Promise<Result>) {
    const formData = new FormData();
    formData.set("claimId", claimId);
    setMessage(null);
    startTransition(async () => {
      const response = await action(formData);
      setMessage(response);
      if (response.ok) router.refresh();
    });
  }

  if (!canProcess && !canReview) return null;

  return (
    <section className="rounded-2xl border border-[#DFE8F4] bg-white p-4 shadow-[0_8px_22px_rgba(7,29,73,0.035)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#071D49]">Stage Decision</h2>
          <p className="mt-1 text-[12px] font-medium text-[#526178]">Current status: <span className="font-semibold text-[#071D49]">{decision ?? "draft"}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canProcess ? <button type="button" disabled={pending || decision === "processed" || decision === "approved"} onClick={() => run(processFinalDocuments)} className="rounded-lg bg-[#071D49] px-5 py-2 text-[12px] font-semibold text-white disabled:bg-[#A9B4C5]">{pending ? "Working..." : "Process"}</button> : null}
          {canReview ? <button type="button" disabled={pending || decision === "approved"} onClick={() => run(approveFinalDocuments)} className="rounded-lg bg-green-700 px-5 py-2 text-[12px] font-semibold text-white disabled:bg-[#A9B4C5]">Approve</button> : null}
          {canReview ? <button type="button" disabled={pending || decision === "returned"} onClick={() => run(returnFinalDocuments)} className="rounded-lg border border-red-200 bg-red-50 px-5 py-2 text-[12px] font-semibold text-red-700 disabled:opacity-60">Send Back</button> : null}
        </div>
      </div>
      {message ? <p className={`mt-3 rounded-lg border px-3 py-2 text-[12px] font-semibold ${message.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message.message}</p> : null}
    </section>
  );
}
