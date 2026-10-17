"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { GroupPartnerRow } from "./group-partner-data";
export function GroupRegisterTabs({associates,partners,addPartner}:{associates:ReactNode;partners:GroupPartnerRow[];addPartner?:ReactNode}) {
 const [tab,setTab]=useState<"associate"|"partner">("associate");
 const money=(v:number|null)=>v===null?"—":new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(v);
 return <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white">
  <nav aria-label="Group register category" role="tablist" className="flex gap-1 border-b border-[#E7ECF3] bg-[#FAFBFD] p-2">
   <button type="button" role="tab" aria-selected={tab==="associate"} onClick={()=>setTab("associate")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${tab==="associate"?"bg-[#17365D] text-white":"text-[#526178]"}`}>Associate Accounts</button>
   <button type="button" role="tab" aria-selected={tab==="partner"} onClick={()=>setTab("partner")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${tab==="partner"?"bg-[#17365D] text-white":"text-[#526178]"}`}>Partner</button>
  </nav>
  <div role="tabpanel" hidden={tab!=="associate"}>{associates}</div>
  <div role="tabpanel" hidden={tab!=="partner"}>
   <div className="flex items-center justify-between gap-3 border-b px-4 py-3"><h2 className="text-[12px] font-semibold text-[#17365D]">Partner Register</h2>{addPartner}</div>
   <div className="overflow-x-auto"><table className="w-full min-w-[1000px] table-fixed text-left text-[10.5px]">
    <thead className="border-b bg-[#F8FAFC] text-[8.5px] uppercase text-[#64748B]"><tr>
      <th className="w-[24%] px-4 py-3">Partner Name</th><th className="w-[14%] px-3 py-3">Mobile Number</th><th className="w-[17%] px-3 py-3">Assigned RM</th><th className="w-[13%] px-3 py-3">Status</th><th className="w-[10%] px-3 py-3 text-right">Customers</th><th className="w-[11%] px-3 py-3 text-right">Net Premium</th><th className="w-[11%] px-3 py-3 text-right">Payout</th>
    </tr></thead>
    <tbody className="divide-y divide-[#E7ECF3]">{partners.map(p=><tr key={p.id} className="h-[52px] hover:bg-[#F8FAFF]">
     <td className="px-4 py-3">{p.detailHref?<Link href={p.detailHref} className="block truncate font-semibold text-[#0F2A55] hover:text-[#315FEA] hover:underline">{p.name}</Link>:<span className="block truncate font-semibold text-[#0F2A55]">{p.name}</span>}<span className="text-[9px] text-[#8190A4]">{p.code}</span></td>
     <td className="px-3 py-3">{p.mobile}</td><td className="truncate px-3 py-3">{p.assignedRm}</td>
     <td className="px-3 py-3"><span className={`inline-flex rounded-md px-2 py-1 text-[9px] font-semibold ${p.status==="POSP Active"?"border border-emerald-200 bg-emerald-50 text-emerald-700":"border border-amber-200 bg-amber-50 text-amber-700"}`}>{p.status}</span></td>
     <td className="px-3 py-3 text-right tabular-nums">{p.customers===null?"—":p.customers.toLocaleString("en-IN")}</td>
     <td className="px-3 py-3 text-right tabular-nums">{money(p.netPremium)}</td>
     <td className="px-3 py-3 text-right tabular-nums">{money(p.payout)}</td>
    </tr>)}
    {!partners.length?<tr><td colSpan={7} className="p-8 text-center text-[#64748B]">No Partners are assigned to this Group.</td></tr>:null}
    </tbody></table></div>
  </div>
 </section>;
}
