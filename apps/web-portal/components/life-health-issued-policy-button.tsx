"use client";

import { useState } from "react";
import Link from "next/link";

export function LifeHealthIssuedPolicyButton({ policyId: _policyId }: { policyId: string }) {
  const [open, setOpen] = useState(false);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-[#CAD7E7] bg-white px-2.5 py-1.5 text-[8.5px] font-bold text-[#315B9A]">View</button>
    {open ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/25 px-4" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="issued-policy-title" className="w-full max-w-[390px] rounded-2xl border border-[#D9E2F0] bg-white p-5 text-left shadow-2xl">
        <div className="flex items-start gap-3 text-left">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF7F2] text-[#18794E]">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true"><path d="m7 12 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/></svg>
          </div>
          <div className="min-w-0 text-left">
            <h2 id="issued-policy-title" className="text-[14px] font-semibold text-[#17365D]">Policy already issued</h2>
            <p className="mt-1 text-[10px] leading-5 text-[#667085]">This case has already been issued as a policy. You can view the issued policy in the Policy Register.</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-[#E8EDF3] pt-3">
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-[#CAD7E7] bg-white px-3.5 py-2 text-[9px] font-bold text-[#475467]">Close</button>
          <Link href="/policies" className="rounded-lg bg-[#17365D] px-3.5 py-2 text-[9px] font-bold text-white">View Policy</Link>
        </div>
      </div>
    </div> : null}
  </>;
}
