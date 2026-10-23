"use client";

import { useActionState, useRef, useState } from "react";
import { ChevronDown, ChevronUp, FileText, Upload } from "lucide-react";
import { uploadCustomerClaimDocument } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/upload-action";

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
  return <article className="min-w-0 rounded-xl border border-[#DCE5F4] bg-white p-3">
    <div className="flex items-center justify-between gap-2">
      <h3 className="min-w-0 flex-1 text-[12px] font-semibold text-[#102B54]">{label}</h3>
      {ordered.length>0?<span aria-label={`${ordered.length} uploaded`} className="shrink-0 rounded-full bg-[#EDF8F2] px-2 py-0.5 text-[10px] font-semibold text-[#087A57]">{ordered.length} Uploaded</span>:null}
      {allowUpload?<form action={uploadAction} ref={form}>
        <input type="hidden" name="account" value={accountId}/><input type="hidden" name="claim" value={claimId}/><input type="hidden" name="stage" value={stage}/><input type="hidden" name="type" value={type}/><input type="hidden" name="returnToSpotIntimation" value={returnToSpotIntimation?"1":"0"}/>
        <input ref={input} type="file" name="file" required accept={accept} className="sr-only" aria-label={`Choose ${label}`} onChange={e=>{if(e.currentTarget.files?.length)form.current?.requestSubmit();}}/>
        <button type="button" disabled={uploading} onClick={()=>input.current?.click()} aria-label={`Upload ${label}`} title={`Upload ${label}`} className="grid h-8 w-8 place-items-center rounded-md border border-[#BCD1F1] text-[#2460B8] hover:bg-[#EDF4FF] disabled:opacity-50"><Upload className="h-4 w-4"/></button>
      </form>:null}
    </div>
    {uploadState.error?<p role="alert" className="mt-2 text-[11px] font-medium text-red-700">{uploadState.error}</p>:null}
    {ordered.length>0?<div className="mt-2 space-y-1.5">
      {openFile(ordered[0])}
      {ordered.length>1?<><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)} className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[11px] font-semibold text-[#24569E] hover:bg-[#F1F6FF]"><span>{expanded?"Show less":`+${ordered.length-1} more documents`}</span>{expanded?<ChevronUp className="h-4 w-4"/>:<ChevronDown className="h-4 w-4"/>}</button>{expanded?ordered.slice(1).map(openFile):null}</>:null}
    </div>:null}
  </article>;
}
