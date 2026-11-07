"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerErrorDialog } from "./customer-error-dialog";
import { CustomerSuccessDialog } from "./customer-success-dialog";
import { Files, Upload, ChevronDown, ChevronUp, FileText, ExternalLink, Loader2 } from "lucide-react";
import type { CustomerClaimFile } from "./customer-claim-compact-document";
import { CustomerSpotAttachmentDelete } from "./customer-spot-attachment-delete";
import { uploadCustomerClaimDocument, prepareCustomerClaimBulkVideo, finalizeCustomerClaimBulkVideo } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/upload-action";
import { createSupabaseBrowserClient } from "@/lib/auth";

const allowedExtensions = /\.(pdf|jpe?g|png|webp|heic|mp4|mov|webm|m4a|ogg)$/i;
const videoExtensions = /\.(mp4|mov|webm)$/i;

export function CustomerClaimMultipleUpload({claimId,accountId,stage,documents,allowUpload=true,returnToSpotIntimation=false}:{claimId:string;accountId:string;stage:string;documents:CustomerClaimFile[];allowUpload?:boolean;returnToSpotIntimation?:boolean}) {
  const router=useRouter();
  const documentListId=useId();
  const picker=useRef<HTMLInputElement>(null);
  const running=useRef(false);
  const [uploading,setUploading]=useState(false);
  const [progress,setProgress]=useState({done:0,total:0});
  const [errorNotice,setErrorNotice]=useState<string|null>(null);
  const [successNotice,setSuccessNotice]=useState<string|null>(null);
  const [expanded,setExpanded]=useState(false);
  const [deletedIds,setDeletedIds]=useState<string[]>([]);
  const [recentUploads,setRecentUploads]=useState<CustomerClaimFile[]>([]);
  const shownDocuments=[...recentUploads,...documents.filter(file=>!recentUploads.some(recent=>recent.id===file.id))]
    .filter(file=>!deletedIds.includes(file.id));
  const openPicker=()=>{if(allowUpload&&!uploading)picker.current?.click();};

  async function uploadFiles(files: File[]) {
    if (!allowUpload || running.current || !files.length) return;
    // Validate the entire selection before submitting any file.
    if (files.length > 10) {setErrorNotice("Select up to 10 files at a time.");return;}
    for (const file of files) {
      if (!file.size || !allowedExtensions.test(file.name)) {setErrorNotice("Unsupported or empty document: "+file.name);return;}
      const limit = videoExtensions.test(file.name) ? 50 : 5;
      if (file.size > limit*1024*1024) {setErrorNotice(file.name+" exceeds "+limit+" MB.");return;}
    }
    running.current=true;
    setUploading(true);
    setErrorNotice(null);
    const batch=files;
    let complete=0;
    const failures:string[]=[];
    const confirmed:CustomerClaimFile[]=[];
    setProgress({done:0,total:batch.length});
    try {
      for(const file of batch) {
        const data=new FormData();
        data.set("account",accountId);
        data.set("claim",claimId);
        data.set("stage",stage);
        data.set("type","Other Document");
        data.set("returnToSpotIntimation",returnToSpotIntimation?"1":"0");
        data.append("file",file);
        try {
          if(videoExtensions.test(file.name) && file.size > 20 * 1024 * 1024) {
            // Large videos bypass the server-action body limit via a claim-scoped signed URL.
            const prepared = await prepareCustomerClaimBulkVideo(accountId,claimId,stage,{name:file.name,size:file.size,type:file.type});
            if(!prepared.ok || !prepared.path || !prepared.token) throw new Error(prepared.error || "Unable to prepare video upload.");
            const uploaded = await createSupabaseBrowserClient().storage.from("claim-documents").uploadToSignedUrl(prepared.path,prepared.token,file,{contentType:file.type,upsert:false});
            if(uploaded.error) throw new Error(uploaded.error.message);
            const saved = await finalizeCustomerClaimBulkVideo(accountId,claimId,stage,prepared.path,{name:file.name,size:file.size,type:file.type});
            if(!saved.ok || !saved.uploaded) throw new Error(saved.error || "Unable to register video.");
            confirmed.push(saved.uploaded);
          } else {
            const result=await uploadCustomerClaimDocument({error:null},data);
            if(result.error || !result.uploaded) throw new Error(result.error || "Upload was not confirmed.");
            confirmed.push(result.uploaded);
          }
          complete++;
        } catch(error) {
          failures.push(file.name);
          // Failed files remain on the user device and can be selected again.
          console.error("Customer bulk file upload failed", error instanceof Error ? error.message : "Unknown error");
        }
        setProgress(prev=>({...prev,done:prev.done+1}));
      }
      // Successfully registered files are never automatically retried.
      if(complete) {
        setRecentUploads(previous=>[...confirmed.filter(file=>!previous.some(existing=>existing.id===file.id)),...previous]);
        setExpanded(true);
        setSuccessNotice(complete+" document"+(complete===1?"":"s")+" uploaded successfully.");
        router.refresh();
      }
      if(failures.length) setErrorNotice(failures.length+" file"+(failures.length===1?"":"s")+" failed: "+failures.join(", ")+". Select the failed files again using the upload icon.");
    } finally {
      running.current=false;
      setUploading(false);
    }
  }
  const closeSuccess=()=>setSuccessNotice(null);
  return <div className="rounded-xl border-2 border-dashed border-[#C5D8ED] bg-[#F8FAFE] p-3">
    <CustomerErrorDialog title="Document upload failed" message={errorNotice} onClose={()=>setErrorNotice(null)}/>
    <CustomerSuccessDialog title="Upload Successful" message={successNotice} onClose={closeSuccess}/>

    <input ref={picker} type="file" name="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.mp4,.mov,.webm,.m4a,.ogg" className="sr-only" aria-label="Select multiple claim documents" disabled={!allowUpload || uploading} onChange={event=>{const files=Array.from(event.currentTarget.files||[]);event.currentTarget.value="";void uploadFiles(files);}}/>
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" onClick={()=>shownDocuments.length?setExpanded(v=>!v):openPicker()}
        aria-expanded={shownDocuments.length?expanded:undefined} aria-controls={shownDocuments.length?documentListId:undefined}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-[#EDF4FF] focus-visible:outline-2 focus-visible:outline-[#1769DC]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#E5F0FF] text-[#1952A1]"><Files className="h-6 w-6" aria-hidden="true"/></span>
        <span className="min-w-0 flex-1"><strong className="block text-[12px] text-[#102A52]">Upload multiple documents</strong>
          <small className="text-[11px] font-semibold text-[#087A57]">{shownDocuments.length} {shownDocuments.length===1?"document":"documents"} uploaded</small>
        </span>
        {shownDocuments.length?(expanded?<ChevronUp className="h-4 w-4 shrink-0 text-[#1952A1]" aria-hidden="true"/>:<ChevronDown className="h-4 w-4 shrink-0 text-[#1952A1]" aria-hidden="true"/>):null}
      </button>
      {allowUpload?<button type="button" disabled={uploading} onClick={openPicker} aria-label="Upload more claim documents" title="Upload documents"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#BDD4F4] bg-white text-[#1952A1] hover:bg-[#EDF4FF] focus-visible:outline-2 focus-visible:outline-[#1769DC] disabled:opacity-50">
        {uploading?<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true"/>:<Upload className="h-5 w-5" aria-hidden="true"/>}
      </button>:null}
    </div>
    {shownDocuments.length>0 && expanded ? <div id={documentListId} className="mt-3 grid gap-2 border-t border-[#D9E3F0] pt-3 sm:grid-cols-2">
      {shownDocuments.map(file=><div key={file.id} className="flex min-w-0 items-center gap-1 rounded-lg border border-[#D9E3F0] bg-white pr-1">
        <a href={"/customer/claim-documents/"+encodeURIComponent(file.id)+"/open?account="+encodeURIComponent(accountId)+"&claim="+encodeURIComponent(claimId)} target="_blank" rel="noopener noreferrer" title={file.file_name||"Uploaded document"}
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-[11px] text-[#204D83] hover:underline focus-visible:outline-2 focus-visible:outline-[#1769DC]">
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true"/>
          <span className="min-w-0 flex-1"><span className="block truncate">{file.file_name||"Uploaded document"}</span><span className="block truncate text-[10px] text-[#6B7F99]">{file.document_type}</span></span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#7890AC]" aria-hidden="true"/>
        </a>
        {allowUpload && stage==="spot_intimation" && file.document_type.toLowerCase().replace(/[^a-z0-9]/g,"")==="otherdocument" && file.verification_status==="pending" ?
          <CustomerSpotAttachmentDelete accountId={accountId} claimId={claimId} documentId={file.id} fileName={file.file_name||"Uploaded document"}
            onDeleted={id=>setDeletedIds(prev=>[...prev,id])}/> : null}
      </div>)}
    </div> : null}
    {uploading ? <p role="status" aria-live="polite" className="mt-2 px-1 text-[11px] font-medium text-[#174A87]">Uploading documents: {progress.done} of {progress.total} processed</p> : null}
  </div>;
}
