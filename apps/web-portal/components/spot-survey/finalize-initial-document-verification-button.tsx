"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { finalizeInitialDocumentVerification } from "@/app/claims/[id]/spot-survey-actions";

export function FinalizeInitialDocumentVerificationButton({ claimId }: { claimId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const router = useRouter();

  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-[#071D49]">Documents verified — finalize claim stage</h2>
          <p className="mt-1 text-[12px] text-[#526178]">These documents were verified before the automatic stage update was available.</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            setResult(null);
            const actionResult = await finalizeInitialDocumentVerification(claimId);
            setResult({ ok: actionResult.ok, message: actionResult.message ?? (actionResult.ok ? "Verification finalized." : "Could not finalize verification.") });
            if (!actionResult.ok) return;
            router.refresh();
          })}
          className="inline-flex h-10 items-center rounded-lg bg-[#071D49] px-5 text-[13px] font-semibold text-white transition hover:bg-[#12356C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Finalizing..." : "Finalize verification"}
        </button>
      </div>
      {result ? <p className={`mt-3 text-[12px] font-semibold ${result.ok ? "text-emerald-700" : "text-red-700"}`}>{result.message}</p> : null}
    </div>
  );
}
