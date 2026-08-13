"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resolveAssistanceRequest } from "./assistance-actions";

export function AssistanceReviewActions({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function decide(decision: "accepted" | "declined") {
    setMessage("");
    setError("");
    startTransition(async () => {
      const result = await resolveAssistanceRequest(claimId, decision, note);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      if (decision === "accepted") router.push(`/claims/${claimId}`);
      else router.push("/claims?queue=assistance");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-[#DCE5F1] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4 max-md:flex-col">
        <div>
          <p className="text-[13px] font-semibold text-[#071D49]">Claims Desk decision</p>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#5C6878]">Accept only when Sankalp is ready to take operational responsibility for this external-policy claim. Declining keeps the claim in customer self-tracking.</p>
        </div>
        <span className="rounded-full bg-[#FFF4D6] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#8A5B00]">Review required</span>
      </div>

      <label className="mt-4 block text-[11px] font-semibold text-[#071D49]">Review note <span className="font-normal text-[#7A8797]">(optional)</span></label>
      <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={4} placeholder="Add internal review context or a message relevant to the decision..." className="mt-1.5 w-full rounded-lg border border-[#CCD6E4] bg-[#FBFCFE] px-3 py-2.5 text-[12px] text-[#071D49] outline-none focus:border-[#174EA6] focus:ring-4 focus:ring-blue-100" />
      <div className="mt-1 text-right text-[10px] text-[#8B96A5]">{note.length}/1000</div>

      {error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">{error}</div> : null}
      {message ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">{message}</div> : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={pending} onClick={() => decide("declined")} className="h-9 rounded-lg border border-[#D7DEE8] bg-white px-4 text-[11px] font-semibold text-[#8B2F2F] transition hover:bg-red-50 disabled:opacity-50">Decline Assistance</button>
        <button type="button" disabled={pending} onClick={() => decide("accepted")} className="h-9 rounded-lg bg-[#003A83] px-4 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#071D49] disabled:opacity-50">{pending ? "Processing..." : "Accept Assistance"}</button>
      </div>
    </div>
  );
}
