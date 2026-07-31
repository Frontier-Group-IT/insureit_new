"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { launchIcallTrainingSso } from "./icall-training-actions";

type Props = {
  applicationId: string;
  loginId: string;
};

export function IcallTrainingLauncher({ applicationId, loginId }: Props) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setRedirectUrl(null);
    setError(null);
  }

  function launch() {
    setError(null);
    startTransition(async () => {
      const result = await launchIcallTrainingSso(applicationId, loginId);
      if (!result.ok || !result.redirectUrl) {
        setError(result.message || "Unable to open iCall training.");
        return;
      }
      setRedirectUrl(result.redirectUrl);
      setOpen(true);
    });
  }

  function openFreshTab() {
    setError(null);
    const popup = window.open("about:blank", "_blank");
    startTransition(async () => {
      const result = await launchIcallTrainingSso(applicationId, loginId);
      if (!result.ok || !result.redirectUrl) {
        popup?.close();
        setError(result.message || "Unable to open iCall training in a new tab.");
        return;
      }
      if (popup) {
        popup.opener = null;
        popup.location.replace(result.redirectUrl);
      } else {
        window.location.href = result.redirectUrl;
      }
    });
  }

  const modal = open && redirectUrl ? (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-[#07152F]" role="dialog" aria-modal="true" aria-label="iCall training portal">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-white/15 bg-[#071D49] px-4 py-2 text-white sm:px-5">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[.08em] text-blue-200">Secure iCall session</p>
          <p className="mt-0.5 truncate text-[12px] font-semibold">Training &amp; Examination · {loginId}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={openFreshTab} disabled={isPending} className="hidden h-9 items-center rounded-xl border border-white/25 px-3 text-[9.5px] font-semibold text-white hover:bg-white/10 disabled:opacity-60 sm:inline-flex">{isPending ? "Preparing…" : "Open in new tab"}</button>
          <button type="button" onClick={close} className="grid h-9 w-9 place-items-center rounded-xl border border-white/25 text-lg leading-none text-white hover:bg-white/10" aria-label="Close iCall training">×</button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1 bg-white">
        <div className="absolute inset-0 grid place-items-center bg-white text-[11px] font-medium text-[#64748B]">Loading iCall training portal…</div>
        <iframe
          src={redirectUrl}
          title="iCall training and examination portal"
          className="relative z-10 h-full w-full border-0 bg-white"
          referrerPolicy="no-referrer"
          allow="fullscreen"
        />
      </div>
    </div>
  ) : null;

  return <>
    <button type="button" onClick={launch} disabled={isPending || !loginId} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#071D49] px-4 text-[10px] font-semibold text-white transition hover:bg-[#0B2B66] disabled:cursor-not-allowed disabled:opacity-60">
      {isPending ? "Opening secure session…" : "Open training"}
    </button>
    {error ? <div className="basis-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[9.5px] text-red-700">{error}</div> : null}
    {mounted && modal ? createPortal(modal, document.body) : null}
  </>;
}
