"use client";

import { useActionState, useRef, useState } from "react";
import { ChevronDown, ChevronUp, FileText, Upload } from "lucide-react";
import { uploadCustomerClaimDocument } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/upload-action";

// These images are the same artwork used by the Customer mobile app.
const artworkBase = "/assets/customer-claim/document-icons/";
const documentArtwork: Record<string, string> = {
  accidentphoto: "glossy_pink_camera_document_icon.png",
  spotphoto: "glossy_pink_camera_document_icon.png",
  accidentphotos: "glossy_pink_camera_document_icon.png",
  rccopy: "glossy_green_vehicle_document_icon.png",
  insurancecopy: "glossy_blue_secure_policy_document_icon.png",
  driverlicence: "glossy_purple_id_card_icon.png",
  grloadbill: "glossy_orange_delivery_document_icon.png",
  accidentvideo: "glossy_red_video_document_icon.png",
  incidentvoicenote: "glossy_red_video_file_icon.png",
  audio: "glossy_red_video_file_icon.png",
  fitnesscopy: "glossy_green_vehicle_document_icon.png",
  fasttagreportlast15days: "glossy_orange_delivery_document_icon.png",
  spotreport: "glossy_pink_camera_document_icon.png",
  estimatecopy: "glossy_orange_delivery_document_icon.png",
  permitcopy: "glossy_green_vehicle_document_icon.png",
  taxreceipt: "glossy_orange_delivery_document_icon.png",
  puccopy: "glossy_green_vehicle_document_icon.png",
  kycdocument: "glossy_purple_id_card_icon.png",
  otherdocument: "glossy_blue_secure_policy_document_icon.png",
  claimform: "glossy_blue_secure_policy_document_icon.png",
  dischargevoucher: "glossy_orange_delivery_document_icon.png",
};
function documentIcon(type: string): string {
  const name = type.toLowerCase().replace(/[^a-z0-9]/g, "");
  return artworkBase + (documentArtwork[name] || "glossy_blue_secure_policy_document_icon.png");
}

export type CustomerClaimFile = { id:string; document_type:string; created_at:string; file_name?:string|null; verification_status?:string|null };
export function CustomerClaimCompactDocument({label,type,documents,accountId,claimId,stage,allowUpload=true,returnToSpotIntimation=false,accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"}:{
  label:string;type:string;documents:CustomerClaimFile[];accountId:string;claimId:string;stage:string;allowUpload?:boolean;returnToSpotIntimation?:boolean;accept?:string;
}) {
  const [expanded,setExpanded]=useState(false);
  const [uploadState,uploadAction,uploading]=useActionState(uploadCustomerClaimDocument,{error:null});
  const input=useRef<HTMLInputElement>(null);
  const form=useRef<HTMLFormElement>(null);
  const ordered=[...documents].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  const openFile=(file:CustomerClaimFile)=><a key={file.id} href={`/customer/claim-documents/${encodeURIComponent(file.id)}/open?account=${encodeURIComponent(accountId)}&claim=${encodeURIComponent(claimId)}`} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 rounded-md border border-[#E4ECF7] bg-[#F9FBFF] px-2 py-2 text-[11px] text-[#204D83] hover:bg-[#EEF5FF] focus-visible:outline-2 focus-visible:outline-[#1769DC]" title={file.file_name||label}><FileText className="h-4 w-4 shrink-0"/><span className="truncate">{file.file_name||label}</span></a>;
  return <article className="customer-workflow customer-workflow-document min-w-0 rounded-xl border border-[#DCE5F4] bg-white p-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2"><img src={documentIcon(type)} alt="" aria-hidden="true" loading="lazy" className="h-9 w-9 shrink-0 object-contain" /><h3 className="min-w-0 text-[12px] font-semibold text-[#102B54]">{label}</h3></div>
      {ordered.length>0?<button type="button" aria-expanded={ordered.length>1?expanded:undefined} aria-label={ordered.length>1?`${ordered.length} uploaded, ${expanded?'collapse':'expand'} documents`:`${ordered.length} uploaded`} onClick={ordered.length>1?()=>setExpanded(v=>!v):undefined} className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EDF8F2] px-2 py-0.5 text-[10px] font-semibold text-[#087A57] ${ordered.length>1?'cursor-pointer transition hover:bg-[#DFF3E8] focus-visible:outline-2 focus-visible:outline-[#16835D]':'cursor-default'}`}>{ordered.length} Uploaded{ordered.length>1?(expanded?<ChevronUp className="h-3 w-3"/>:<ChevronDown className="h-3 w-3"/>):null}</button>:null}
      {allowUpload?<form action={uploadAction} ref={form}>
        <input type="hidden" name="account" value={accountId}/><input type="hidden" name="claim" value={claimId}/><input type="hidden" name="stage" value={stage}/><input type="hidden" name="type" value={type}/><input type="hidden" name="returnToSpotIntimation" value={returnToSpotIntimation?"1":"0"}/>
        <input ref={input} type="file" name="file" required accept={accept} className="sr-only" aria-label={`Choose ${label}`} onChange={e=>{if(e.currentTarget.files?.length)form.current?.requestSubmit();}}/>
        <button type="button" disabled={uploading} onClick={()=>input.current?.click()} aria-label={`Upload ${label}`} title={`Upload ${label}`} className="grid h-8 w-8 place-items-center rounded-md border border-[#BCD1F1] text-[#2460B8] hover:bg-[#EDF4FF] disabled:opacity-50"><Upload className="h-4 w-4"/></button>
      </form>:null}
    </div>
    {uploadState.error?<p role="alert" className="mt-2 text-[11px] font-medium text-red-700">{uploadState.error}</p>:null}
    {ordered.length>0?<div className="mt-2 space-y-1.5">
      {openFile(ordered[0])}
      {ordered.length>1&&expanded?ordered.slice(1).map(openFile):null}
    </div>:null}
  </article>;
}
