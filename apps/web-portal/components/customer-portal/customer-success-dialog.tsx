"use client";

import { useEffect, useId, useRef } from "react";
import { CheckCircle2 } from "lucide-react";

/**
 * Customer workflow confirmation, matching the existing alert dialog layout.
 * Success is only shown after a confirmed server result; auto-dismiss in 1s.
 * Error dialogs intentionally remain manually dismissible.
 */
export function CustomerSuccessDialog({
  message,
  onClose,
  title = "Success",
}: {
  message: string | null;
  onClose: () => void;
  title?: string;
}) {
  const titleId = useId();
  const messageId = useId();
  const closeRef = useRef(onClose);
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!message) return;
    okRef.current?.focus();
    const timer = window.setTimeout(() => closeRef.current(), 1000);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [message]);

  if (!message) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071B3C]/60 px-4 py-6" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}
        className="w-full max-w-[505px] overflow-hidden rounded-[22px] bg-white shadow-[0_24px_75px_rgba(8,30,65,0.27)]">
        <div className="flex flex-col items-center px-6 pb-7 pt-7 text-center">
          <span className="mb-5 grid h-[54px] w-[54px] place-items-center rounded-full bg-[#E8F8ED] text-[#159653]">
            <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 id={titleId} className="text-[17px] font-bold text-[#142C50]">{title}</h2>
          <p id={messageId} className="mt-4 whitespace-pre-wrap break-words text-[13px] leading-6 text-[#75829A]">{message}</p>
        </div>
        <div className="border-t border-[#E5ECF5] bg-[#F7F9FD] px-6 py-4">
          <button ref={okRef} type="button" onClick={() => closeRef.current()}
            className="min-h-12 w-full rounded-xl bg-[#17365D] text-sm font-bold text-white transition hover:bg-[#102B4C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17365D]">
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
