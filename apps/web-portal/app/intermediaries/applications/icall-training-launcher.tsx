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
  const [cookieNoticeOpen, setCookieNoticeOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open && !cookieNoticeOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (open) close();
      else setCookieNoticeOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, cookieNoticeOpen]);

  function close() {
    setOpen(false);
    setRedirectUrl(null);
    setError(null);
  }

  function requestLaunch() {
    setError(null);
    setCookieNoticeOpen(true);
  }

  function continueLaunch() {
    setCookieNoticeOpen(false);
    launch();
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

  const cookieNotice = cookieNoticeOpen ? (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-[#07152F]/65 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="icall-cookie-notice-title">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-2xl">
        <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 sm:px-6">
          <p className="text-[9px] font-semibold uppercase tracking-[.08em] text-blue-700">Before opening iCall</p>
          <h3 id="icall-cookie-notice-title" className="mt-1 text-[18px] font-semibold text-[#0F172A]">Allow third-party cookies</h3>
          <p className="mt-2 text-[11px] leading-5 text-[#64748B]">
            iCall Training opens securely inside INSUREIT and needs third-party cookies to keep your iCall session active.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="space-y-3">
            <Instruction number="1" text="Open your browser's third-party cookie control for this site." />
            <Instruction number="2" text="Allow third-party cookies so the embedded iCall session can stay signed in." />
            <Instruction number="3" text="Return here, then click Continue to open Training & Examination." />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] leading-4 text-amber-900">
            If third-party cookies remain blocked, iCall may return to its login page instead of opening your training dashboard. INSUREIT cannot change this browser setting automatically.
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={() => setCookieNoticeOpen(false)} className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-semibold text-[#334155] transition hover:bg-[#F1F5F9]">
            Cancel
          </button>
          <button type="button" onClick={continueLaunch} className="h-10 rounded-xl bg-[#071D49] px-4 text-[10px] font-semibold text-white transition hover:bg-[#0B2B66]">
            I&apos;ve allowed cookies — Continue
          </button>
        </div>
      </div>
    </div>
  ) : null;

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
    <button type="button" onClick={requestLaunch} disabled={isPending || !loginId} className="inline-flex h-10 items-center justify-center rounded-xl bg-[#071D49] px-4 text-[10px] font-semibold text-white transition hover:bg-[#0B2B66] disabled:cursor-not-allowed disabled:opacity-60">
      {isPending ? "Opening secure session…" : "Open training"}
    </button>
    {error ? <div className="basis-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[9.5px] text-red-700">{error}</div> : null}
    {mounted && cookieNotice ? createPortal(cookieNotice, document.body) : null}
    {mounted && modal ? createPortal(modal, document.body) : null}
  </>;
}

function Instruction({ number, text }: { number: string; text: string }) {
  return <div className="flex gap-3">
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-100 text-[9px] font-semibold text-blue-800">{number}</span>
    <p className="pt-0.5 text-[10.5px] leading-5 text-[#334155]">{text}</p>
  </div>;
}
