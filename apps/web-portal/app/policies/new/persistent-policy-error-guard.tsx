"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type CapturedError = { title: string; message: string };

function isPolicyErrorDialog(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const role = element.getAttribute("role");
  if (role !== "dialog" && role !== "alertdialog") return false;
  const text = element.textContent ?? "";
  return /check details|unable to save policy|policy.*(?:error|could not|unable)|(?:error|unable).*policy/i.test(text);
}

function readError(element: HTMLElement): CapturedError {
  const title = element.querySelector("h1,h2,h3,[aria-labelledby]")?.textContent?.trim() || "Check details";
  const paragraphs = Array.from(element.querySelectorAll("p"))
    .map((item) => item.textContent?.trim() ?? "")
    .filter(Boolean);
  return { title, message: paragraphs.at(-1) || "Please review the details and try again." };
}

export function PersistentPolicyErrorGuard() {
  const [fallback, setFallback] = useState<CapturedError | null>(null);
  const activeErrorRef = useRef<CapturedError | null>(null);
  const acknowledgedRef = useRef(false);

  useEffect(() => {
    const captureVisibleError = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]'));
      const dialog = dialogs.find(isPolicyErrorDialog);
      if (!dialog) return false;
      activeErrorRef.current = readError(dialog);
      acknowledgedRef.current = false;
      return true;
    };

    captureVisibleError();

    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest("button");
      if (!button) return;
      const dialog = button.closest('[role="dialog"],[role="alertdialog"]');
      const isFallbackOk = button.hasAttribute("data-policy-error-ok");
      const isOriginalOk = Boolean(dialog && isPolicyErrorDialog(dialog) && button.textContent?.trim().toUpperCase() === "OK");
      if (!isFallbackOk && !isOriginalOk) return;
      acknowledgedRef.current = true;
      activeErrorRef.current = null;
      setFallback(null);
    };

    document.addEventListener("click", onClick, true);
    const observer = new MutationObserver(() => {
      if (captureVisibleError()) {
        setFallback(null);
        return;
      }
      if (activeErrorRef.current && !acknowledgedRef.current) setFallback(activeErrorRef.current);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", onClick, true);
      observer.disconnect();
    };
  }, []);

  if (!fallback || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[11000] grid min-h-[100dvh] w-screen place-items-center bg-[#071D49]/60 p-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-labelledby="persistent-policy-error-title">
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_70px_rgba(7,29,73,.38)]">
        <div className="px-6 pb-5 pt-6 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#FFF3E8] text-[19px] font-bold text-[#D45B16] ring-6 ring-[#FFF8F2]">!</div>
          <h2 id="persistent-policy-error-title" className="mt-4 text-[15px] font-bold text-[#102A4C]">{fallback.title}</h2>
          <p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-[#667085]">{fallback.message}</p>
        </div>
        <div className="border-t border-[#E6EBF2] bg-[#F8FAFC] px-5 py-3.5">
          <button data-policy-error-ok type="button" onClick={() => { acknowledgedRef.current = true; activeErrorRef.current = null; setFallback(null); }} className="h-10 w-full rounded-xl bg-[#17365D] px-5 text-[10px] font-bold text-white">OK</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
