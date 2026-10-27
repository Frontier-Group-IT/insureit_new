"use client";
import { useState } from "react";
import { FolderOpen, CarFront, UserRound, ScrollText, ShieldCheck, ClipboardList } from "lucide-react";
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
  { name: "Driver Docs", types: [
    { label: "Driver Licence", type: "Driver Licence" },
    { label: "Driver Aadhaar front", type: "Driver Aadhaar Front" },
    { label: "Driver Aadhaar back", type: "Driver Aadhaar Back" },
    { label: "Driver Statement", type: "Driver Statement" },
  ] },
  { name: "Permit / Tax", types: [
    { label: "Road Tax", type: "Road Tax" },
    { label: "Local Permit A", type: "Local Permit A" },
    { label: "Local Permit B", type: "Local Permit B" },
    { label: "National Permit", type: "National Permit" },
    { label: "Authorization Letter", type: "Authorization Letter" },
  ] },
  { name: "KYC / Other", types: [
    { label: "Aadhaar", type: "Aadhaar" },
    { label: "PAN", type: "PAN" },
    { label: "GST", type: "GST" },
    { label: "Cancelled Cheque", type: "Cancelled Cheque" },
    { label: "KYC Form", type: "KYC Form" },
  ] },
  { name: "Forms", types: [
    { label: "Claim Form", type: "Claim Form" },
    { label: "TP Affidavit", type: "TP Affidavit" },
    { label: "Towing Bill", type: "Towing Bill" },
    { label: "Repair Estimate", type: "Repair Estimate" },
    { label: "NCB Verification", type: "NCB Verification" },
  ] },
] as const;

const groupIcons=[CarFront,UserRound,ScrollText,ShieldCheck,ClipboardList];
const normalized=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
export function CustomerClaimDocumentGroups({documents,claimId,accountId,stage,showSaveDetails=false,showDraftAction=false,draftAction,allowUpload=true}:{
  documents:CustomerClaimFile[];claimId:string;accountId:string;stage:string;showSaveDetails?:boolean;showDraftAction?:boolean;draftAction?:(form:FormData)=>Promise<void>;allowUpload?:boolean;
}) {
  const [active,setActive]=useState(0);
  const expectedTypes = new Set(groups.flatMap(group => group.types.map(item => normalized(item.type))));
  const uploadedTypes = new Set(documents.filter(doc => expectedTypes.has(normalized(doc.document_type))).map(doc => normalized(doc.document_type)));
  const legacyDocuments = documents.filter(doc => !expectedTypes.has(normalized(doc.document_type)));
  return <section className="customer-claim-ref-docs rounded-2xl border border-[#DCE5F3] bg-white p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="customer-claim-ref-docs-heading"><span className="customer-claim-ref-docs-title-icon"><FolderOpen className="h-5 w-5" /></span><div><h2 className="text-[16px] font-bold text-[#071D49]">Document Verification</h2><p className="text-[11px] text-[#71819E]">Upload and verify required documents.</p></div></div><span className="rounded-lg bg-[#F3F6FC] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">Documents uploaded {uploadedTypes.size} / {groups.reduce((sum, group)=>sum+group.types.length,0)}</span></div>
    <div role="tablist" aria-label="Claim document groups" className="customer-claim-ref-tablist grid grid-cols-2 rounded-lg sm:grid-cols-5">
      {groups.map((group,i)=><button key={group.name} type="button" role="tab" aria-selected={i===active} onClick={()=>setActive(i)} className={`customer-claim-ref-tab flex min-h-10 items-center gap-2 px-3 text-left text-[11px] font-semibold ${i===active?"bg-gradient-to-r from-[#6042E8] to-[#4F90EA] text-white":"bg-[#FAFCFF] text-[#183257] hover:bg-[#EDF4FF]"}`}>{(() => { const Icon=groupIcons[i];return <Icon className="h-4 w-4 shrink-0" />;})()}<span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${i===active?"bg-white text-[#5144D8]":"bg-[#EAF1FF] text-[#1D3C6B]"}`}>{i+1}</span>{group.name}</button>)}
    </div>
    <div role="tabpanel" className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {groups[active].types.map(item=><CustomerClaimCompactDocument key={item.type} label={item.label} type={item.type} documents={documents.filter(doc=>normalized(doc.document_type)===normalized(item.type))} claimId={claimId} accountId={accountId} stage={stage} allowUpload={allowUpload}/>)}
    </div>
    {active===4 && legacyDocuments.length>0 ? <div className="mt-4 border-t border-[#E5EBF5] pt-3">
      <p className="mb-2 text-[11px] font-semibold text-[#536781]">Previously uploaded document types</p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {Array.from(new Set(legacyDocuments.map(doc=>doc.document_type))).map(type=>(
          <CustomerClaimCompactDocument key={type} label={type} type={type} documents={legacyDocuments.filter(doc=>doc.document_type===type)} claimId={claimId} accountId={accountId} stage={stage} allowUpload={false}/>
        ))}
      </div>
    </div> : null}
    {showSaveDetails?<div className="mt-4 flex justify-end gap-3 border-t border-[#E5EBF5] pt-4">{showDraftAction && draftAction ? <button type="submit" form="customer-claim-stage-details-form" formAction={draftAction} formNoValidate className="rounded-lg border border-[#BCD1F1] bg-white px-5 py-2.5 text-[12px] font-semibold text-[#163C72] hover:bg-[#F1F6FF]">Save as Draft</button> : null}<button type="submit" form="customer-claim-stage-details-form" className="rounded-lg bg-gradient-to-r from-[#6042E8] to-[#4F90EA] px-5 py-2.5 text-[12px] font-semibold text-white">Save Details</button></div>:null}
  </section>;
}
