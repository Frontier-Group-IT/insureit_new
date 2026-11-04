"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertCircle } from "lucide-react";

/** Shared claim-stage error dialog: no inline validation banners. */
export function ClaimStageErrorDialog({
  message,
  onClose,
  title = "Check details",
}: {
  message: string | null | undefined;
  onClose: () => void;
  title?: string;
}) {
  const titleId = useId();
  const messageId = useId();
  const okRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!message) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    okRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      }
      if (event.key === "Tab") {
        event.preventDefault();
        event.stopImmediatePropagation();
        okRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [message]);

  if (!message || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-[#07152F]/60 px-4 py-6" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}
        className="w-full max-w-[490px] overflow-hidden rounded-[20px] border border-[#DFE6F0] bg-white shadow-[0_20px_70px_rgba(7,21,47,.24)]">
        <div className="flex flex-col items-center px-6 pb-6 pt-7 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#FFF1E9] text-[#D9732C]" aria-hidden="true">
            <AlertCircle className="h-7 w-7" />
          </span>
          <h2 id={titleId} className="mt-4 text-[18px] font-semibold text-[#17365D]">{title}</h2>
          <p id={messageId} className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-6 text-[#53657F]">{message}</p>
        </div>
        <div className="border-t border-[#E4E9F0] px-6 py-4">
          <button ref={okRef} type="button" onClick={onClose}
            className="h-11 w-full rounded-xl bg-[#19385E] text-[13px] font-semibold text-white transition-colors hover:bg-[#27558B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#19385E]/30">
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
