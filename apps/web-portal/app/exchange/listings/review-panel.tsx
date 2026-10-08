"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, XCircle } from "lucide-react";

export function ExchangeReviewPanel({
  listingId,
  photoCount,
  defaultDocumentVerified,
  defaultInspectionScore,
}: {
  listingId: string;
  photoCount: number;
  defaultDocumentVerified: boolean;
  defaultInspectionScore: number | null;
}) {
  const router = useRouter();
  const [documentVerified, setDocumentVerified] = useState(defaultDocumentVerified);
  const [inspectionScore, setInspectionScore] = useState(defaultInspectionScore == null ? "" : String(defaultInspectionScore));
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(decision: "approve" | "reject") {
    setMessage(null);
    if (decision === "reject" && !notes.trim()) {
      setMessage({ type: "error", text: "Enter a rejection reason before rejecting the listing." });
      return;
    }

    const score = inspectionScore.trim() ? Number(inspectionScore) : null;
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) {
      setMessage({ type: "error", text: "Inspection score must be a whole number between 0 and 100." });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/exchange/listings/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            listingId,
            decision,
            notes: notes.trim() || null,
            documentVerified,
            inspectionScore: score,
          }),
        });
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) throw new Error(body.error || "Exchange listing review could not be completed.");

        setMessage({
          type: "success",
          text: decision === "approve" ? "Listing approved and published." : "Listing rejected.",
        });
        router.refresh();
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Exchange listing review could not be completed.",
        });
      }
    });
  }

  return (
    <details className="min-w-[245px] rounded-xl border border-[#DFE5ED] bg-[#FBFCFE] p-2.5">
      <summary className="cursor-pointer list-none text-[10px] font-black text-[#3156B8]">Review listing</summary>
      <div className="mt-3 space-y-2">
        <label className="flex items-center gap-2 text-[9px] font-bold text-[#536078]">
          <input
            type="checkbox"
            checked={documentVerified}
            onChange={(event) => setDocumentVerified(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-[#BBC6D6]"
          />
          Documents verified
        </label>

        <label className="block text-[9px] font-bold text-[#536078]">
          Inspection score
          <input
            value={inspectionScore}
            onChange={(event) => setInspectionScore(event.target.value)}
            inputMode="numeric"
            placeholder="Optional 0–100"
            className="mt-1 h-8 w-full rounded-lg border border-[#DCE3EC] bg-white px-2 text-[10px] font-semibold outline-none focus:border-[#3156B8]"
          />
        </label>

        <button
          type="button"
          onClick={() => submit("approve")}
          disabled={photoCount < 6 || pending}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#164BB8] text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-[#AEB8C8]"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
          Approve & publish
        </button>

        {photoCount < 6 ? (
          <p className="text-[8.5px] font-semibold leading-3 text-[#9A6500]">Approval unlocks after all 6 guided photos are present.</p>
        ) : null}

        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder="Rejection reason (required to reject)"
          className="w-full resize-none rounded-lg border border-[#DCE3EC] bg-white px-2 py-2 text-[9.5px] font-semibold outline-none focus:border-[#B54B5A]"
        />

        <button
          type="button"
          onClick={() => submit("reject")}
          disabled={pending}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[#E6C5CB] bg-[#FFF7F8] text-[9.5px] font-black text-[#A43E50] disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          Reject listing
        </button>

        {message ? (
          <p className={`rounded-lg px-2 py-1.5 text-[8.5px] font-bold leading-3 ${message.type === "success" ? "bg-[#EAF7F0] text-[#147A55]" : "bg-[#FFF0F2] text-[#A43E50]"}`}>
            {message.text}
          </p>
        ) : null}
      </div>
    </details>
  );
}
