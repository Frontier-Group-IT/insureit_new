"use client";

import { AlertTriangle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updatePolicyIntakeStatus } from "@/app/policy-intakes/actions";

export function PolicyIntakeReviewActions({ id }: { id:string }) {
  const router=useRouter(); const [reason,setReason]=useState(""); const [error,setError]=useState<string|null>(null); const [pending,startTransition]=useTransition();
  function run(status:"needs_attention"|"rejected") { setError(null); startTransition(async()=>{const result=await updatePolicyIntakeStatus(id,status,reason);if(!result.ok){setError(result.error);return;}setReason("");router.refresh();}); }
  return <div className="space-y-2 rounded-2xl border border-[#E2E8F0] bg-white p-3">
    <label className="block text-[8px] font-bold uppercase tracking-[.08em] text-[#64748B]">Operations note</label>
    <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={2} placeholder="Explain what Sales should correct, or why this is rejected" className="w-full resize-none rounded-xl border border-[#D8E0EA] px-3 py-2 text-[10px] outline-none focus:border-[#315B9A]"/>
    {error?<p className="text-[9px] font-semibold text-red-600">{error}</p>:null}
    <div className="grid grid-cols-2 gap-2"><button type="button" disabled={pending} onClick={()=>run("needs_attention")} className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-50 text-[9px] font-bold text-amber-800"><AlertTriangle className="h-3.5 w-3.5"/>Request info</button><button type="button" disabled={pending} onClick={()=>run("rejected")} className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-red-50 text-[9px] font-bold text-red-700"><XCircle className="h-3.5 w-3.5"/>Reject</button></div>
  </div>;
}
