"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
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
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!pending) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, pending]);

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

  const dialog = open && mounted ? createPortal(
    <div className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-black/50 px-4 py-6" role="presentation">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={dialogId} aria-describedby={`${dialogId}-description`}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
        <h2 id={dialogId} className="text-base font-bold text-[#071D49]">Request document re-upload</h2>
        <p id={`${dialogId}-description`} className="mt-2 text-xs text-slate-600">
          The customer will receive a re-upload request in their Customer App for <strong className="break-all">{fileName}</strong>.
        </p>
        <label htmlFor={`${dialogId}-reason`} className="mt-4 block text-xs font-semibold text-slate-700">Message to customer</label>
        <textarea id={`${dialogId}-reason`} value={reason} onChange={(event) => setReason(event.target.value)}
          placeholder="Please re-upload this document with a clear, valid copy." rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-800" />
        {message ? <p role="alert" className="mt-2 text-xs text-red-600">{message}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button ref={closeRef} type="button" disabled={pending} onClick={() => setOpen(false)}
            className="rounded-lg border px-4 py-2 text-xs font-semibold">Cancel</button>
          <button type="button" disabled={pending} onClick={requestReupload}
            className="rounded-lg bg-[#123F73] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
            {pending ? "Sending..." : "Send request"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <button ref={triggerRef} type="button" aria-label="Request customer to re-upload document" title="Request customer re-upload"
        onClick={() => { setMessage(""); setOpen(true); }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-[#C68A22] transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30">
        <RefreshCw aria-hidden="true" size={16} strokeWidth={2} />
      </button>
      {dialog}
    </>
  );
}
