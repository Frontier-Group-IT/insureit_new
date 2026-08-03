"use client";

import { useEffect, useState } from "react";

type Props = {
  message: string;
  durationMs?: number;
};

export function WorkflowSuccessToast({ message, durationMs = 4000 }: Props) {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("success")) {
      url.searchParams.delete("success");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }

    const fadeTimer = window.setTimeout(() => setLeaving(true), Math.max(0, durationMs - 350));
    const hideTimer = window.setTimeout(() => setVisible(false), durationMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [durationMs]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-4 top-20 z-[210] w-[min(92vw,380px)] rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-[10.5px] font-medium text-emerald-800 shadow-[0_18px_55px_rgba(15,23,42,.18)] transition duration-300 sm:right-6 ${leaving ? "translate-y-[-6px] opacity-0" : "translate-y-0 opacity-100"}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">✓</span>
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-[.06em] text-emerald-600">Saved</p>
          <p className="mt-0.5 leading-5">{message}</p>
        </div>
        <button type="button" onClick={() => setVisible(false)} className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[14px] text-slate-400 transition hover:bg-slate-100 hover:text-slate-600" aria-label="Dismiss notification">×</button>
      </div>
    </div>
  );
}
