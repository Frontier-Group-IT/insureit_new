"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const INLINE_ERROR_SELECTOR = ".border-red-200.bg-red-50";

export function LifeHealthCaseErrorPopupGuard() {
  const [message, setMessage] = useState<string | null>(null);
  const dismissedErrorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => {
      const inlineError = document.querySelector<HTMLElement>(INLINE_ERROR_SELECTOR);
      if (!inlineError) {
        dismissedErrorRef.current = null;
        return;
      }
      if (inlineError === dismissedErrorRef.current) return;
      const text = inlineError.textContent?.trim();
      if (!text) return;
      inlineError.style.display = "none";
      setMessage((current) => current ?? text);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const dismiss = () => {
    dismissedErrorRef.current = document.querySelector<HTMLElement>(INLINE_ERROR_SELECTOR);
    setMessage(null);
  };

  if (!message || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[11000] grid min-h-[100dvh] w-screen place-items-center bg-[#071D49]/60 p-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-labelledby="life-health-case-error-title">
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_70px_rgba(7,29,73,.38)]">
        <div className="px-6 pb-5 pt-6 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#FFF3E8] text-[19px] font-bold text-[#D45B16] ring-6 ring-[#FFF8F2]">!</div>
          <h2 id="life-health-case-error-title" className="mt-4 text-[15px] font-bold text-[#102A4C]">Check details</h2>
          <p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-[#667085]">{message}</p>
        </div>
        <div className="border-t border-[#E6EBF2] bg-[#F8FAFC] px-5 py-3.5">
          <button type="button" onClick={dismiss} className="h-10 w-full rounded-xl bg-[#17365D] px-5 text-[10px] font-bold text-white">OK</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
