"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationDialog({ open, title, message, confirmLabel, cancelLabel = "Cancel", tone = "primary", busy = false, busyLabel = "Processing…", onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => cancelRef.current?.focus());
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel(); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [open, busy, onCancel]);

  if (!open) return null;
  const confirmClass = tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-[#0F2A55] hover:bg-[#071D49]";

  return (
    <div className="fixed inset-0 z-[250] grid place-items-center bg-[#07152D]/55 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_28px_90px_rgba(7,21,45,.28)]">
        <div className="border-b border-[#E2E8F0] px-5 py-4">
          <h2 id="confirmation-title" className="text-[15px] font-semibold text-[#0F172A]">{title}</h2>
          <p className="mt-1.5 text-[11px] leading-5 text-[#64748B]">{message}</p>
        </div>
        <div className="flex justify-end gap-2 bg-[#F8FAFC] px-5 py-3">
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="h-10 rounded-lg border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#334155] disabled:opacity-50">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-lg px-4 text-[10.5px] font-semibold text-white disabled:cursor-wait disabled:opacity-75 ${confirmClass}`}>
            {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" /> : null}
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
      {busy ? <div className="absolute inset-0 cursor-wait" aria-hidden="true" /> : null}
    </div>
  );
}
