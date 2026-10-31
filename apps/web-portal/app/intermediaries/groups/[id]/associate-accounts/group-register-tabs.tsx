"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { removeBusinessGroupMembers } from "../../business-group-actions";
import type { GroupPartnerRow } from "./group-partner-data";
export function GroupRegisterTabs({associates,partners,addPartner,groupId,allowRemoval=false}:{associates:ReactNode;partners:GroupPartnerRow[];addPartner?:ReactNode;groupId:string;allowRemoval?:boolean}) {
 const [tab,setTab]=useState<"associate"|"partner">("associate");
 const [removeCandidate,setRemoveCandidate]=useState<GroupPartnerRow|null>(null);
 const money=(v:number|null)=>v===null?"—":new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(v);
 return <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white">
  <nav aria-label="Group register category" role="tablist" className="flex gap-1 border-b border-[#E7ECF3] bg-[#FAFBFD] p-2">
   <button type="button" role="tab" aria-selected={tab==="associate"} onClick={()=>setTab("associate")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${tab==="associate"?"bg-[#17365D] text-white":"text-[#526178]"}`}>Associate Accounts</button>
   <button type="button" role="tab" aria-selected={tab==="partner"} onClick={()=>setTab("partner")} className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${tab==="partner"?"bg-[#17365D] text-white":"text-[#526178]"}`}>Partner</button>
  </nav>
  <div role="tabpanel" hidden={tab!=="associate"}>{associates}</div>
  <div role="tabpanel" hidden={tab!=="partner"}>
   <div className="flex items-center justify-between gap-3 border-b px-4 py-3"><h2 className="text-[12px] font-semibold text-[#17365D]">Partner Register</h2>{addPartner}</div>
   {!partners.length ? (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <Image src="/illustrations/group-associate-no-results.png" alt="No Result Found" width={215} height={197}/>
      <p className="mb-2 text-[11px] text-[#8190A4]">No Partners have been assigned to this Group.</p>
    </div>
   ) : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] table-fixed text-left text-[10.5px]">
    <thead className="border-b bg-[#F8FAFC] text-[8.5px] uppercase text-[#64748B]"><tr>
      <th className="w-[22%] px-4 py-3">Partner Name</th><th className="w-[13%] px-3 py-3">Mobile Number</th><th className="w-[15%] px-3 py-3">Assigned RM</th><th className="w-[12%] px-3 py-3">Status</th><th className="w-[9%] px-3 py-3 text-right">Customers</th><th className="w-[10%] px-3 py-3 text-right">Net Premium</th><th className="w-[10%] px-3 py-3 text-right">Payout</th>{allowRemoval ? <th className="w-[9%] px-3 py-3 text-center">Action</th> : null}
    </tr></thead>
    <tbody className="divide-y divide-[#E7ECF3]">{partners.map(p=><tr key={p.id} className="h-[52px] hover:bg-[#F8FAFF]">
     <td className="px-4 py-3">{p.detailHref?<Link href={p.detailHref} className="block truncate font-semibold text-[#0F2A55] hover:text-[#315FEA] hover:underline">{p.name}</Link>:<span className="block truncate font-semibold text-[#0F2A55]">{p.name}</span>}<span className="text-[9px] text-[#8190A4]">{p.code}</span></td>
     <td className="px-3 py-3">{p.mobile}</td><td className="truncate px-3 py-3">{p.assignedRm}</td>
     <td className="px-3 py-3"><span className={`inline-flex rounded-md px-2 py-1 text-[9px] font-semibold ${p.status==="POSP Active"?"border border-emerald-200 bg-emerald-50 text-emerald-700":"border border-amber-200 bg-amber-50 text-amber-700"}`}>{p.status}</span></td>
     <td className="px-3 py-3 text-right tabular-nums">{p.customers===null?"—":p.customers.toLocaleString("en-IN")}</td>
     <td className="px-3 py-3 text-right tabular-nums">{money(p.netPremium)}</td>
     <td className="px-3 py-3 text-right tabular-nums">{money(p.payout)}</td>
     {allowRemoval ? <td className="px-3 py-3 text-center"><button type="button" aria-label={`Remove ${p.name} from group`} title="Remove from Group" onClick={()=>setRemoveCandidate(p)} className="inline-grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-500"><Trash2 size={15}/></button></td> : null}
    </tr>)}
    </tbody></table></div>}
  </div>
  {removeCandidate && allowRemoval ? <div role="presentation" className="fixed inset-0 z-[130] grid place-items-center bg-[#071D49]/55 px-4" onMouseDown={(event)=>{if(event.target===event.currentTarget)setRemoveCandidate(null);}}>
    <div role="alertdialog" aria-modal="true" aria-labelledby="remove-group-partner-title" aria-describedby="remove-group-partner-description" className="w-full max-w-[440px] rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-2xl">
      <h3 id="remove-group-partner-title" className="text-base font-bold text-[#17365D]">Remove Partner from Group?</h3>
      <p id="remove-group-partner-description" className="mt-3 text-sm leading-6 text-[#526178]">Remove <strong>{removeCandidate.name}</strong> from this group only? Their partner account, customers, policies, premiums, payouts and RM assignment will remain unchanged.</p>
      <form action={removeBusinessGroupMembers} className="mt-5 flex justify-end gap-2">
        <input type="hidden" name="group_id" value={groupId}/>
        <input type="hidden" name="partner_id" value={removeCandidate.id}/>
        <input type="hidden" name="reason" value="Removed from Group Partner Register"/>
        <button type="button" autoFocus onClick={()=>setRemoveCandidate(null)} className="rounded-lg border border-[#CBD7E7] px-4 py-2 text-xs font-semibold text-[#17365D]">Cancel</button>
        <button type="submit" className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700">Remove from Group</button>
      </form>
    </div>
  </div> : null}
 </section>;
}
