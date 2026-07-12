"use client";

import { useEffect } from "react";

export function FeedbackToast({
  message,
  tone = "error",
  onClose
}: {
  message: string;
  tone?: "error" | "success" | "info";
  onClose?: () => void;
}) {
  const toneClasses = {
    error: "border-red-200 bg-white text-red-700",
    success: "border-emerald-200 bg-white text-emerald-700",
    info: "border-blue-200 bg-white text-[#174EA6]"
  }[tone];
  const iconClasses = {
    error: "bg-red-50 text-red-600",
    success: "bg-emerald-50 text-emerald-600",
    info: "bg-blue-50 text-[#174EA6]"
  }[tone];
  const icon = tone === "error" ? "!" : tone === "success" ? "✓" : "i";

  useEffect(() => {
    if (!onClose) return;
    const timer = window.setTimeout(onClose, 6500);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed right-4 top-20 z-[80] w-[min(390px,calc(100vw-2rem))] animate-[fadeIn_.18s_ease-out]">
      <div role="alert" className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-[0_14px_35px_rgba(7,29,73,0.16)] ${toneClasses}`}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${iconClasses}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#68758A]">{tone === "error" ? "Action required" : tone === "success" ? "Completed" : "Notice"}</p>
          <p className="mt-0.5 text-[12.5px] font-medium leading-5">{message}</p>
        </div>
        {onClose ? <button type="button" onClick={onClose} aria-label="Close notification" className="rounded-md px-1.5 py-0.5 text-sm text-[#7A8797] hover:bg-slate-100">×</button> : null}
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Continue",
  cancelLabel = "Stay here",
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#071D49]/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#DCE7F5] bg-white shadow-[0_24px_70px_rgba(7,29,73,0.25)]">
        <div className="border-b border-[#E8EEF6] px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-lg text-amber-600">!</span>
            <div>
              <h2 id="confirm-title" className="text-sm font-semibold text-[#071D49]">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-[#68758A]">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 bg-[#F8FAFD] px-5 py-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-[#D5E0EC] bg-white px-4 py-2 text-xs font-semibold text-[#344256] hover:bg-[#F4F7FB]">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-[#0B4C8C] px-4 py-2 text-xs font-semibold text-white hover:bg-[#083B6D]">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
