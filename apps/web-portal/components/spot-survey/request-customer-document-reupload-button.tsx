"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { requestSpotSurveyDocumentReupload } from "@/app/claims/[id]/spot-survey-actions";

/** Ask the customer to re-upload: never opens an Operations file picker. */
export function RequestCustomerDocumentReuploadButton({ claimId, documentId, fileName }: {
  claimId: string;
  documentId: string;
  fileName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const requestReupload = () => {
    const formData = new FormData();
    formData.set("claimId", claimId);
    formData.set("documentId", documentId);
    formData.set("reason", reason.trim() || "Please re-upload this document with a clear, valid copy.");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await requestSpotSurveyDocumentReupload(formData);
        if (!result.ok) { setMessage(result.message ?? "Could not send re-upload request."); return; }
        setOpen(false);
        setReason("");
        router.refresh();
      } catch {
        setMessage("Could not send re-upload request.");
      }
    });
  };

  return (
    <>
      <button type="button" aria-label="Request customer to re-upload document" title="Request customer re-upload"
        onClick={() => { setMessage(""); setOpen(true); }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[#C68A22] transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30">
        <RefreshCw aria-hidden="true" size={16} strokeWidth={2} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 px-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="request-reupload-heading" className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h2 id="request-reupload-heading" className="text-base font-bold text-[#071D49]">Request document re-upload</h2>
            <p className="mt-2 text-xs text-slate-600">The customer will receive a re-upload request in their Customer App for <strong>{fileName}</strong>.</p>
            <label htmlFor={`reupload-reason-${documentId}`} className="mt-4 block text-xs font-semibold text-slate-700">Message to customer</label>
            <textarea id={`reupload-reason-${documentId}`} value={reason} onChange={(event) => setReason(event.target.value)}
              placeholder="Please re-upload this document with a clear, valid copy." rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-800" />
            {message ? <p role="alert" className="mt-2 text-xs text-red-600">{message}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-semibold">Cancel</button>
              <button type="button" disabled={pending} onClick={requestReupload} className="rounded-lg bg-[#123F73] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Sending..." : "Send request"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
