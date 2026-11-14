"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareText, X } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
};

/**
 * Add-only remarks for Create Case. Entries remain read-only after being added
 * to the draft and are persisted with the case when Create Case succeeds.
 */
export function LifeHealthRemarksEditor({ value, onChange, disabled = false, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  const show = () => { setDraft(""); setOpen(true); };
  const save = () => {
    const next = draft.trim();
    if (!next) return;
    const timestamp = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).format(new Date());
    const addition = `[${timestamp}] ${next}`;
    const previous = value.trim();
    onChange(previous ? `${previous}\n\n${addition}` : addition);
    setDraft("");
    setOpen(false);
  };

  return <>
    <div className="min-w-0">
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]">Remarks</div>
      {compact ? (
        <button type="button" disabled={disabled} onClick={show} aria-label="Add Remark" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#BFD3EE] bg-[#EFF5FF] px-3 text-[11px] font-semibold text-[#17365D] hover:bg-[#E0EDFF] disabled:opacity-50">
          <MessageSquareText className="h-4 w-4" />Add Remark
        </button>
      ) : (
        <>
          <div className="flex h-10 items-center justify-between gap-2 rounded-xl border border-[#D8DEE9] bg-white px-2.5">
            <span className="min-w-0 truncate text-[10px] text-[#667085]" aria-label="Remarks status">{value.trim() ? "Remarks added · Read only" : "No remarks added"}</span>
            <button type="button" disabled={disabled} onClick={show} aria-label="Add Remark" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#BFD3EE] bg-[#EFF5FF] px-2.5 py-1.5 text-[10px] font-bold text-[#17365D] hover:bg-[#E0EDFF] disabled:opacity-50">
              <MessageSquareText className="h-3.5 w-3.5" />Add Remark
            </button>
          </div>
          {value.trim() ? <div className="mt-2 rounded-xl border border-[#E0E7F0] bg-[#F8FAFD] px-3 py-2.5" aria-label="Added remarks"><p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#667085]">Added remarks · Read only</p><p className="whitespace-pre-wrap break-words text-[11px] leading-5 text-[#344054]">{value}</p></div> : null}
        </>
      )}
    </div>
    {mounted && open ? createPortal(
      <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-[#101828]/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="life-health-remarks-title" className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#E6ECF5] px-5 py-4">
            <h2 id="life-health-remarks-title" className="flex items-center gap-2 text-[15px] font-bold text-[#17365D]"><MessageSquareText className="h-4 w-4" />Add Remark</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close remarks" className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F3F6FB]"><X className="h-4 w-4" /></button>
          </div>
          <div className="space-y-4 p-5">
            {value.trim() ? <div className="rounded-xl border border-[#E0E7F0] bg-[#F8FAFD] p-3"><p className="mb-2 text-[9px] font-bold uppercase text-[#667085]">Existing remarks · Read only</p><p className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-[#344054]" aria-label="Existing remarks">{value}</p></div> : null}
            <div>
              <label htmlFor="life-health-remarks-input" className="mb-2 block text-[11px] font-semibold text-[#344054]">New remark</label>
              <textarea id="life-health-remarks-input" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} maxLength={2000} placeholder="Enter a new remark" className="w-full resize-y rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-[12px] text-[#17203A] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[11px] font-semibold text-[#344054]">Cancel</button>
              <button type="button" onClick={save} disabled={!draft.trim()} className="h-10 rounded-xl bg-[#17365D] px-5 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Add Remark</button>
            </div>
          </div>
        </div>
      </div>, document.body
    ) : null}
  </>;
}
