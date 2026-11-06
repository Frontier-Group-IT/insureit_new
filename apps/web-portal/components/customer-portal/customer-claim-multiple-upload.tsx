"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerErrorDialog } from "./customer-error-dialog";
import { CustomerSuccessDialog } from "./customer-success-dialog";
import { Files, Plus, Loader2, X } from "lucide-react";
import { uploadCustomerClaimDocument, prepareCustomerClaimBulkVideo, finalizeCustomerClaimBulkVideo } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/upload-action";
import { createSupabaseBrowserClient } from "@/lib/auth";

const allowedExtensions = /\.(pdf|jpe?g|png|webp|heic|mp4|mov|webm|m4a|ogg)$/i;
const videoExtensions = /\.(mp4|mov|webm)$/i;
const sizeLabel = (size: number) => (size / (1024 * 1024)).toFixed(1) + " MB";

export function CustomerClaimMultipleUpload({claimId,accountId,stage,returnToSpotIntimation=false}:{claimId:string;accountId:string;stage:string;returnToSpotIntimation?:boolean}) {
  const router=useRouter();
  const picker=useRef<HTMLInputElement>(null);
  const running=useRef(false);
  const [selected,setSelected]=useState<File[]>([]);
  const [uploading,setUploading]=useState(false);
  const [progress,setProgress]=useState({done:0,total:0});
  const [errorNotice,setErrorNotice]=useState<string|null>(null);
  const [successNotice,setSuccessNotice]=useState<string|null>(null);
  const [failedFiles,setFailedFiles]=useState<string[]>([]);

  function addFiles(files: File[]) {
    const unique=[...selected];
    for(const file of files) {
      if(unique.some(item=>item.name===file.name && item.size===file.size && item.lastModified===file.lastModified)) continue;
      if(unique.length>=10) {setErrorNotice("Select up to 10 files at a time.");return;}
      if(!file.size || !allowedExtensions.test(file.name)) {setErrorNotice("Unsupported or empty document: "+file.name);return;}
      const limit=videoExtensions.test(file.name)?50:5;
      if(file.size>limit*1024*1024) {setErrorNotice(file.name+" exceeds "+limit+" MB.");return;}
      unique.push(file);
    }
    setFailedFiles([]);
    setSelected(unique);
  }

  async function submitSelected() {
    if(running.current || !selected.length) return;
    running.current=true;
    setUploading(true);
    setErrorNotice(null);
    const batch=[...selected];
    let complete=0;
    const failures:string[]=[];
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
            if(!saved.ok) throw new Error(saved.error || "Unable to register video.");
          } else {
            const result=await uploadCustomerClaimDocument({error:null},data);
            if(result.error || !result.uploaded) throw new Error(result.error || "Upload was not confirmed.");
          }
          complete++;
        } catch(error) {
          failures.push(file.name);
          if(!errorNotice) setErrorNotice(error instanceof Error ? error.message : "Upload failed.");
        }
        setProgress(prev=>({...prev,done:prev.done+1}));
      }
      // Never resubmit files that the server already registered, even when another file fails.
      setSelected(failures.length ? batch.filter(file=>failures.includes(file.name)) : []);
      setFailedFiles(failures);
      if(complete) setSuccessNotice(complete+" document"+(complete===1?"":"s")+" uploaded successfully."+(failures.length?" "+failures.length+" failed and remain selected.":""));
      else if(failures.length) setErrorNotice("No documents uploaded. Review errors and retry the selected files.");
    } finally {
      running.current=false;
      setUploading(false);
    }
  }
  const closeSuccess=()=>{setSuccessNotice(null);router.refresh();};
  return <div className="mt-3">
    <CustomerErrorDialog title="Document upload failed" message={errorNotice} onClose={()=>setErrorNotice(null)}/>
    <CustomerSuccessDialog title="Upload Successful" message={successNotice} onClose={closeSuccess}/>
    <input type="hidden" name="type" value="Other Document"/>
    <input ref={picker} type="file" name="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.mp4,.mov,.webm,.m4a,.ogg" className="sr-only" aria-label="Select multiple claim documents" onChange={event=>{addFiles(Array.from(event.currentTarget.files||[]));event.currentTarget.value="";}}/>
    <button type="button" disabled={uploading} onClick={()=>picker.current?.click()} className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-[#C5D8ED] bg-[#F8FAFE] px-4 py-3 text-left hover:border-[#4380CD] disabled:opacity-50">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#E5F0FF] text-[#1952A1]"><Files className="h-6 w-6"/></span>
      <span className="min-w-0 flex-1"><strong className="block text-[12px] text-[#102A52]">Upload multiple documents</strong><small className="text-[10px] text-[#7787A2]">{uploading?"Uploading selected files…":"Select up to 10 files. Review the list before uploading."}</small></span>
      {uploading?<Loader2 className="h-5 w-5 animate-spin text-[#1952A1]"/>:<Plus className="h-5 w-5 text-[#1952A1]"/>}
    </button>
    {selected.length>0 ? <div className="mt-2 rounded-lg border border-[#D9E3F0] bg-white p-3">
      <div className="mb-2 flex justify-between text-xs font-semibold text-[#17365D]"><span>{selected.length} selected files</span><span>{sizeLabel(selected.reduce((sum,file)=>sum+file.size,0))} total</span></div>
      <ul className="space-y-1">{selected.map(file=><li key={file.name+file.size+file.lastModified} className="flex min-w-0 items-center gap-2 rounded-md bg-[#F7FAFD] px-2 py-1.5 text-xs">
        <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span><span className="shrink-0 text-[#64748B]">{sizeLabel(file.size)}</span>
        {failedFiles.includes(file.name)?<span className="text-red-600">Failed</span>:null}
        <button type="button" disabled={uploading} aria-label={"Remove "+file.name} onClick={()=>setSelected(current=>current.filter(item=>item!==file))} className="rounded p-1 text-[#64748B] disabled:opacity-40"><X className="h-4 w-4"/></button>
      </li>)}</ul>
      {uploading?<p role="status" className="mt-2 text-xs text-[#174A87]">Processed {progress.done} of {progress.total} files</p>:null}
      <button type="button" disabled={uploading} onClick={submitSelected} className="mt-3 rounded-lg bg-[#1253A7] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Upload Selected Files</button>
    </div>:null}
  </div>;
}
