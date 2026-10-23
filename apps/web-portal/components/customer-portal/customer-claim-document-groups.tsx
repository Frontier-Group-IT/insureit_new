"use client";
import { useState } from "react";
import { CustomerClaimCompactDocument, type CustomerClaimFile } from "./customer-claim-compact-document";
const groups = [
  { name: "Vehicle Docs", types: [
    { label: "RC Copy", type: "RC Copy" },
    { label: "Insurance Copy", type: "Insurance Copy" },
    { label: "Fitness Copy", type: "Fitness Copy" },
    { label: "GR/Load Bill", type: "GR / Load Bill" },
    { label: "Fasttag report last 15 days", type: "Fasttag report last 15 days" },
    { label: "Spot Report", type: "Spot Report" },
    { label: "Estimate Copy", type: "Estimate Copy" },
  ] },
  { name: "Driver Docs", types: [{ label: "Driver Licence", type: "Driver Licence" }] },
  { name: "Permit / Tax", types: [{ label: "Permit Copy", type: "Permit Copy" }, { label: "Tax Receipt", type: "Tax Receipt" }, { label: "PUC Copy", type: "PUC Copy" }] },
  { name: "KYC / Other", types: [{ label: "KYC Document", type: "KYC Document" }, { label: "Other Document", type: "Other Document" }] },
  { name: "Forms", types: [{ label: "Claim Form", type: "Claim Form" }, { label: "Discharge Voucher", type: "Discharge Voucher" }] },
] as const;

const normalized=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
export function CustomerClaimDocumentGroups({documents,claimId,accountId,stage,showSaveDetails=false,allowUpload=true}:{
  documents:CustomerClaimFile[];claimId:string;accountId:string;stage:string;showSaveDetails?:boolean;allowUpload?:boolean;
}) {
  const [active,setActive]=useState(0);
  return <section className="rounded-2xl border border-[#DCE5F3] bg-white p-4">
    <h2 className="mb-3 text-[17px] font-semibold text-[#071D49]">Claim Documents</h2>
    <div role="tablist" aria-label="Claim document groups" className="grid grid-cols-2 overflow-hidden rounded-lg border border-[#D9E3F0] sm:grid-cols-5">
      {groups.map((group,i)=><button key={group.name} type="button" role="tab" aria-selected={i===active} onClick={()=>setActive(i)} className={`flex min-h-11 items-center gap-2 border-r border-[#D9E3F0] px-3 text-left text-[11px] font-semibold ${i===active?"bg-[#1253A7] text-white":"bg-[#FAFCFF] text-[#183257] hover:bg-[#EDF4FF]"}`}>{group.name}</button>)}
    </div>
    <div role="tabpanel" className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {groups[active].types.map(item=><CustomerClaimCompactDocument key={item.type} label={item.label} type={item.type} documents={documents.filter(doc=>normalized(doc.document_type)===normalized(item.type))} claimId={claimId} accountId={accountId} stage={stage} allowUpload={allowUpload}/>)}
    </div>
    {showSaveDetails?<div className="mt-4 flex justify-end border-t border-[#E5EBF5] pt-4"><button type="submit" form="customer-claim-stage-details-form" className="rounded-lg bg-[#1253A7] px-5 py-2.5 text-[12px] font-semibold text-white">Save Details</button></div>:null}
  </section>;
}
