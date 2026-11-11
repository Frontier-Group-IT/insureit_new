"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareText, Pencil, X } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/** Edits the existing remarks field locally; the enclosing case form persists it. */
export function LifeHealthRemarksEditor({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  const show = () => { setDraft(value); setOpen(true); };
  const save = () => { onChange(draft.trim()); setOpen(false); };

  return <>
    <div className="min-w-0">
      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]">Remarks</div>
      <button type="button" disabled={disabled} onClick={show} aria-label={value.trim() ? "View or edit remarks" : "Add remarks"} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#BFD3EE] bg-[#EFF5FF] px-3 text-[11px] font-bold text-[#17365D] transition-colors hover:bg-[#E0EDFF] disabled:opacity-50">
        {value.trim() ? <Pencil className="h-3.5 w-3.5" /> : <MessageSquareText className="h-3.5 w-3.5" />}
        {value.trim() ? "Edit Remarks" : "Add Remarks"}
      </button>
      {value.trim() ? <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-[#E0E7F0] bg-[#F8FAFD] px-3 py-2 text-[10px] leading-4 text-[#344054]" aria-label="Current remarks">{value}</p> : <p className="mt-1 text-[9px] text-[#98A2B3]">No remarks added</p>}
    </div>
    {mounted && open ? createPortal(
      <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-[#101828]/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="life-health-remarks-title" className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#E6ECF5] px-5 py-4">
            <h2 id="life-health-remarks-title" className="flex items-center gap-2 text-[15px] font-bold text-[#17365D]"><MessageSquareText className="h-4 w-4" />Remarks</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close remarks" className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F3F6FB]"><X className="h-4 w-4" /></button>
          </div>
          <div className="p-5">
            <label htmlFor="life-health-remarks-input" className="mb-2 block text-[11px] font-semibold text-[#344054]">Servicing / underwriting remarks</label>
            <textarea id="life-health-remarks-input" autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} rows={5} maxLength={4000} placeholder="Enter remarks for this Life / Health case" className="w-full resize-y rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-[12px] text-[#17203A] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" />
            <p className="mt-2 text-[10px] text-[#667085]">Remarks are saved to the case when you create it or save the case details.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[11px] font-semibold text-[#344054]">Cancel</button>
              <button type="button" onClick={save} className="h-10 rounded-xl bg-[#17365D] px-5 text-[11px] font-bold text-white">Add Remark</button>
            </div>
          </div>
        </div>
      </div>, document.body
    ) : null}
  </>;
}
