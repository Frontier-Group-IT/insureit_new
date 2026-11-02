"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

export function CustomerErrorDialog({ message, onClose, title = "Check details" }: {
  message: string | null;
  onClose: () => void;
  title?: string;
}) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!message) return;
    okRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071B3C]/60 px-4 py-6" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="customer-error-title" aria-describedby="customer-error-message"
        className="w-full max-w-[505px] overflow-hidden rounded-[22px] bg-white shadow-[0_24px_75px_rgba(8,30,65,0.27)]">
        <div className="flex flex-col items-center px-6 pb-7 pt-7 text-center">
          <span className="mb-5 grid h-[54px] w-[54px] place-items-center rounded-full bg-[#FFF1E7] text-[#D86A17]">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 id="customer-error-title" className="text-[17px] font-bold text-[#142C50]">{title}</h2>
          <p id="customer-error-message" className="mt-4 text-[13px] leading-6 text-[#75829A]">{message}</p>
        </div>
        <div className="border-t border-[#E5ECF5] bg-[#F7F9FD] px-6 py-4">
          <button ref={okRef} type="button" onClick={onClose}
            className="min-h-12 w-full rounded-xl bg-[#17365D] text-sm font-bold text-white transition hover:bg-[#102B4C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17365D]">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
