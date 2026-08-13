"use client";

import { LockKeyhole, X } from "lucide-react";
import { useState } from "react";

export function CloseMonthConfirmation({ monthLabel }: { monthLabel: string }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed) {
    return (
      <button type="submit" className="report-primary-action inline-flex h-9 items-center gap-2 rounded-lg bg-[#172a5c] px-3 text-[10px] font-bold text-white">
        <LockKeyhole className="h-3.5 w-3.5" /> Create Frozen Pack
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="report-primary-action inline-flex h-9 items-center gap-2 rounded-lg bg-[#172a5c] px-3 text-[10px] font-bold text-white">
        <LockKeyhole className="h-3.5 w-3.5" /> Close Month
      </button>
      {open ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0c1830]/45 p-4 backdrop-blur-[2px]">
          <section role="dialog" aria-modal="true" aria-labelledby="close-month-title" className="w-full max-w-[470px] overflow-hidden rounded-2xl border border-[#d8e0eb] bg-white shadow-[0_24px_80px_rgba(12,31,62,.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#e8edf3] px-5 py-4">
              <div><p className="text-[9px] font-black uppercase tracking-[.09em] text-[#7a8799]">Month-end archive</p><h2 id="close-month-title" className="mt-1 text-[18px] font-bold tracking-[-.02em] text-[#172640]">Close {monthLabel}?</h2></div>
              <button type="button" aria-label="Cancel" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#dfe5ed] text-[#607089]"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 px-5 py-5 text-[10.5px] leading-5 text-[#536176]">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-semibold text-amber-800">This creates an immutable month-end snapshot for your current reporting scope.</div>
              <p>The frozen pack cannot be edited or replaced later.</p>
              <p>The live Management Pack remains available separately and may continue changing after the snapshot is captured.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-[#e8edf3] bg-[#fafbfd] px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} className="report-secondary-action inline-flex h-10 items-center justify-center rounded-lg border border-[#dfe5ed] bg-white px-4 text-[10.5px] font-bold text-[#526174]">Cancel</button>
              <button type="button" onClick={() => { setConfirmed(true); setOpen(false); }} className="report-primary-action inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#172a5c] px-4 text-[10.5px] font-bold text-white"><LockKeyhole className="h-3.5 w-3.5" />Confirm Close</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
