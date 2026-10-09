"use client";

import { useState } from "react";
type Doc={id:string;document_type:string;verification_status:string|null;created_at:string};
const groups=[
 {name:"Vehicle Docs",match:/\brc\b|insurance|fitness|vehicle|estimate/i},
 {name:"Driver Docs",match:/driver|licen[cs]e|dl copy/i},
 {name:"Permit / Tax",match:/permit|tax|puc/i},
 {name:"KYC / Other",match:/kyc|aadhaar|pan|other/i},
 {name:"Forms",match:/form|discharge|voucher|claim form/i},
];
export function CustomerClaimDocumentGroups({documents}:{documents:Doc[]}){
 const [active,setActive]=useState(0);
 const filtered=documents.filter(x=>groups[active].match.test(x.document_type));
 return <section className="rounded-2xl border border-[#DCE5F3] bg-white p-4">
  <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-[17px] font-semibold text-[#071D49]">Document Verification</h2><span className="rounded-lg bg-[#F2F5FB] px-3 py-2 text-[10px] uppercase text-[#75819A]">Documents verified {documents.filter(d=>["verified","approved","valid"].includes((d.verification_status||"").toLowerCase())).length} / {documents.length}</span></div>
  <div role="tablist" aria-label="Claim document groups" className="grid grid-cols-5 overflow-hidden rounded-lg border border-[#D9E3F0]">
   {groups.map((group,i)=><button type="button" role="tab" aria-selected={i===active} key={group.name} onClick={()=>setActive(i)} className={`flex min-h-11 items-center gap-2 border-r border-[#D9E3F0] px-3 text-left text-[10px] font-semibold last:border-r-0 ${active===i?"bg-gradient-to-r from-[#6853EE] to-[#4E95E9] text-white":"bg-[#FAFCFF] text-[#183257] hover:bg-[#EDF4FF]"}`}><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/85 text-[#164E9B]">{i+1}</span>{group.name}</button>)}
  </div>
  <div role="tabpanel" className="mt-3 rounded-lg border border-[#DCE5F3] bg-[#FAFCFF] p-3">
   {filtered.length? <div className="divide-y divide-[#DFE6EF]">{filtered.map(doc=><div key={doc.id} className="flex items-center justify-between gap-4 py-2 text-[11px]"><span className="font-semibold text-[#173253]">{doc.document_type}</span><span className="capitalize text-[#6E7F99]">{doc.verification_status||"Pending verification"}</span></div>)}</div>:<p className="py-4 text-center text-[11px] text-[#6B7C95]">No {groups[active].name.toLowerCase()} recorded for this claim.</p>}
  </div>
 </section>;
}
