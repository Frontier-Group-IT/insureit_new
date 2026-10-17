"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
type Partner={id:string;partner_code:string;display_name:string;source_application_id:string|null};
export function GroupRegisterTabs({associates,partners}:{associates:ReactNode;partners:Partner[]}) {
 const [tab,setTab]=useState<"associate"|"partner">("associate");
 return <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white">
  <nav aria-label="Group register category" role="tablist" className="flex gap-1 border-b border-[#E7ECF3] bg-[#FAFBFD] p-2">
   <button type="button" role="tab" aria-selected={tab==="associate"} onClick={()=>setTab("associate")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${tab==="associate"?"bg-[#17365D] text-white":"text-[#526178]"}`}>Associate Accounts</button>
   <button type="button" role="tab" aria-selected={tab==="partner"} onClick={()=>setTab("partner")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${tab==="partner"?"bg-[#17365D] text-white":"text-[#526178]"}`}>Partner</button>
  </nav>
  <div role="tabpanel" hidden={tab!=="associate"}>{associates}</div>
  <div role="tabpanel" hidden={tab!=="partner"}>
   <h2 className="border-b px-4 py-3 text-[12px] font-semibold text-[#17365D]">Partner Register</h2>
   <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[11px]">
    <thead className="bg-slate-50 text-[#64748B]"><tr><th className="px-4 py-3">Partner Name / Code</th><th className="px-4 py-3">Details</th></tr></thead>
    <tbody className="divide-y">{partners.map(p=><tr key={p.id} className="hover:bg-[#F1F6FF]"><td colSpan={2} className="p-0">{p.source_application_id?
      <Link href={`/intermediaries/applications/${p.source_application_id}`} className="flex w-full items-center justify-between px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"><span><strong className="block">{p.display_name}</strong><span className="text-[9px] text-[#64748B]">{p.partner_code}</span></span><span className="text-[10px] text-[#315FEA]">View details →</span></Link>:
      <div className="flex items-center justify-between px-4 py-3"><span>{p.display_name} · {p.partner_code}</span><span className="text-[9px] text-[#64748B]">Details unavailable</span></div>}</td></tr>)}
     {!partners.length?<tr><td colSpan={2} className="p-6 text-center text-[#64748B]">No Partners are assigned to this Group.</td></tr>:null}
    </tbody></table></div>
  </div>
 </section>;
}
