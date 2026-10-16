"use client";
import { useState, type ReactNode } from "react";

export function AccountTabs({associateForm,associateRegister,branchForm,branchRegister,initialTab="associate"}:{associateForm:ReactNode;associateRegister:ReactNode;branchForm:ReactNode;branchRegister:ReactNode;initialTab?:"associate"|"branch"}) {
 const [tab,setTab]=useState<"associate"|"branch">(initialTab);
 return <div className="space-y-4">
   <div className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
   <nav aria-label="Account category" className="flex gap-1 border-b border-[#E7ECF3] bg-[#FAFBFD] p-1.5">
     {([{id:"associate",label:"Associate Account"},{id:"branch",label:"Branch"}] as const).map(item=><button key={item.id} type="button" aria-selected={tab===item.id} role="tab" onClick={()=>{setTab(item.id);const u=new URL(window.location.href);if(item.id==="branch")u.searchParams.set("tab","branch");else u.searchParams.delete("tab");window.history.replaceState(null,"",u.toString());}} className={`rounded-lg px-4 py-2 text-[11px] font-bold transition ${tab===item.id?"bg-[#17365D] text-white":"text-[#526178] hover:bg-[#F1F5F9]"}`}>{item.label}</button>)}
   </nav>
   <div role="tabpanel" hidden={tab!=="associate"} className={tab==="associate"?"space-y-4":"hidden"}>{associateForm}</div>
   <div role="tabpanel" hidden={tab!=="branch"} className={tab==="branch"?"space-y-4":"hidden"}>{branchForm}</div>
   </div>
   <div hidden={tab!=="associate"}>{associateRegister}</div>
   <div hidden={tab!=="branch"}>{branchRegister}</div>
 </div>;
}
