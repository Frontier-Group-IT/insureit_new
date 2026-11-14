"use client";

import { Camera, CheckCircle2, FileText, RefreshCw, Search, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completePolicyIntakeUpload, preparePolicyIntakeUpload } from "@/app/policy-intakes/actions";
import { submitLifeHealthIntakeWithoutProposal } from "@/app/policy-intakes/optional-proposal-actions";
import type { PolicyIntakeSource } from "@/lib/policy-intake-server";

const MAX_FILE_SIZE=15*1024*1024;
const ALLOWED_TYPES=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
type PolicyType="motor"|"non_motor"|"life"|"health";

async function uploadSigned(signedUrl:string,file:File){const body=new FormData();body.append("cacheControl","3600");body.append("",file);const response=await fetch(signedUrl,{method:"PUT",headers:{"x-upsert":"false"},body});if(!response.ok)throw new Error("signed_upload_failed");}

export function PolicyIntakeForm({sources}:{sources:PolicyIntakeSource[]}){
  const router=useRouter();const formRef=useRef<HTMLFormElement>(null);const fileRef=useRef<HTMLInputElement>(null);
  const submittingRef=useRef(false);
  const[fileName,setFileName]=useState("");const[selectedFile,setSelectedFile]=useState<File|null>(null);const[previewUrl,setPreviewUrl]=useState<string|null>(null);const[policyType,setPolicyType]=useState<PolicyType>("motor");const[error,setError]=useState<string|null>(null);const[pending,startTransition]=useTransition();
  useEffect(()=>{if(!selectedFile){setPreviewUrl(null);return;}const url=URL.createObjectURL(selectedFile);setPreviewUrl(url);return()=>URL.revokeObjectURL(url);},[selectedFile]);
  const proposalForm=policyType==="life"||policyType==="health";
  function submit(formData:FormData){
    if(submittingRef.current)return;
    setError(null);const leadSourceId=String(formData.get("lead_source_id")??"");const selectedPolicyType=String(formData.get("policy_type")??"") as PolicyType;const customerMobile=String(formData.get("customer_mobile")??"");const file=fileRef.current?.files?.[0];
    const isProposal=selectedPolicyType==="life"||selectedPolicyType==="health";const documentName=isProposal?"proposal form":"policy copy";
    if(!file&&!isProposal){setError(`Upload the ${documentName} PDF or image.`);return;}if(file&&!ALLOWED_TYPES.has(file.type)){setError(`Upload a PDF, JPG, PNG or WebP ${documentName}.`);return;}if(file&&file.size>MAX_FILE_SIZE){setError(`${isProposal?"Proposal form":"Policy copy"} must be 15 MB or smaller.`);return;}
    submittingRef.current=true;
    startTransition(async()=>{try{
      if(!file&&isProposal){const result=await submitLifeHealthIntakeWithoutProposal({leadSourceId,policyType:selectedPolicyType,customerMobile});if(!result.ok){setError(result.error);return;}formRef.current?.reset();setFileName("");setSelectedFile(null);setPolicyType("motor");router.push(`/policy-intakes/${result.id}?submitted=1`);router.refresh();return;}
      if(!file)return;
      const meta={name:file.name,type:file.type,size:file.size};const prepared=await preparePolicyIntakeUpload({leadSourceId,policyType:selectedPolicyType,customerMobile,file:meta});if(!prepared.ok){setError(prepared.error);return;}await uploadSigned(prepared.signedUrl,file);const result=await completePolicyIntakeUpload({id:prepared.id,number:prepared.number,leadSourceId,policyType:selectedPolicyType,customerMobile,storagePath:prepared.storagePath,file:meta});if(!result.ok){setError(result.error);return;}formRef.current?.reset();setFileName("");setSelectedFile(null);setPolicyType("motor");router.push(`/policy-intakes/${result.id}?submitted=1`);router.refresh();
    }catch{setError("Upload couldn't be completed. Your details are still here — please try again.");}finally{submittingRef.current=false;}});
  }
  return <form ref={formRef} action={submit} className="mx-auto max-w-[680px] pb-24"><section className="overflow-hidden rounded-[24px] border border-[#DCE5F1] bg-white shadow-[0_18px_50px_rgba(31,56,96,.10)]">
    <div className="bg-[linear-gradient(135deg,#071D49,#174B83)] px-5 py-5 text-white"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"><ShieldCheck className="h-5 w-5"/></span><div><h1 className="text-[17px] font-bold">New Policy Intake</h1><p className="mt-0.5 text-[10px] text-white/72">Choose the source and policy type, then upload the document.</p></div></div></div>
    <div className="space-y-4 p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#53627A]"><Search className="h-3.5 w-3.5"/>Lead source</span><select name="lead_source_id" required className="h-12 w-full rounded-2xl border border-[#D6DFEA] bg-white px-3 text-[12px] font-semibold text-[#17365D] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]"><option value="">Select assigned Partner / POSP / MISP</option>{sources.map(source=><option key={source.id} value={source.id}>{source.intermediary_type.toUpperCase()} · {source.display_name}{source.intermediary_code?` · ${source.intermediary_code}`:""}</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.08em] text-[#53627A]">Policy type</span><select name="policy_type" required value={policyType} onChange={event=>{setPolicyType(event.target.value as PolicyType);setFileName("");setSelectedFile(null);if(fileRef.current)fileRef.current.value="";}} className="h-12 w-full rounded-2xl border border-[#D6DFEA] bg-white px-3 text-[12px] font-semibold text-[#17365D] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]"><option value="motor">Motor</option><option value="non_motor">Non-Motor</option><option value="life">Life</option><option value="health">Health</option></select></label>
      </div>
      <label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.08em] text-[#53627A]">Customer mobile</span><input name="customer_mobile" required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="10 digit mobile number" className="h-12 w-full rounded-2xl border border-[#D6DFEA] px-3 text-[14px] font-semibold tracking-[.03em] text-[#17365D] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]"/></label>
      <div className="min-w-0"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.08em] text-[#53627A]">{proposalForm?"Proposal Form (Optional)":"Policy Copy"}</span>
        <input ref={fileRef} id="intake-policy-document" name="policy_document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required={!proposalForm} className="sr-only" onChange={event=>{const file=event.target.files?.[0]??null;setFileName(file?.name??"");setSelectedFile(file);}}/>
        {selectedFile ? <div role="group" aria-label="Selected Policy Intake document actions" className="inline-flex h-10 w-full max-w-full items-stretch overflow-hidden rounded-xl border border-[#A9DCC2] bg-[#F0FBF5] text-[#168653]">
          <button type="button" onClick={()=>previewUrl&&window.open(previewUrl,"_blank","noopener,noreferrer")} disabled={pending||!previewUrl} title={selectedFile.name} aria-label={`Open ${selectedFile.name}`} className="inline-flex min-w-0 flex-1 items-center gap-2 px-3 text-[10px] font-semibold hover:bg-emerald-100/60 disabled:opacity-60"><FileText className="h-4 w-4 shrink-0"/><span className="truncate">{fileName}</span></button>
          <button type="button" disabled={pending} onClick={()=>{if(fileRef.current)fileRef.current.value="";setSelectedFile(null);setFileName("");}} aria-label="Delete selected document" title="Delete" className="grid w-10 shrink-0 place-items-center border-l border-emerald-200 text-red-600 hover:bg-red-50 disabled:opacity-60"><Trash2 className="h-4 w-4"/></button>
          <label htmlFor="intake-policy-document" title="Replace" aria-label={`Replace ${selectedFile.name}`} className={`grid w-10 shrink-0 place-items-center border-l border-emerald-200 ${pending?"pointer-events-none opacity-60":"cursor-pointer hover:bg-emerald-100/60"}`}><RefreshCw className="h-4 w-4"/></label>
        </div>:<label htmlFor="intake-policy-document" className="group flex min-h-[126px] cursor-pointer items-center justify-center rounded-[20px] border border-dashed border-[#AFC2D9] bg-[#F7FAFE] px-5 text-center hover:bg-[#F2F7FD]"><span><span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[#E6F7F5] text-[#13877F]"><UploadCloud className="h-5 w-5"/></span><span className="mt-2 block text-[11px] font-bold text-[#17365D]">Upload {proposalForm?"proposal form":"policy"} PDF or image{proposalForm?" (optional)":""}</span><span className="mt-1 flex items-center justify-center gap-2 text-[9px] text-[#7A8798]"><Camera className="h-3.5 w-3.5"/>Camera or file · max 15 MB</span></span></label>}
      </div>
      {error?<div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[10px] font-semibold text-red-700">{error}</div>:null}
      <button disabled={pending||!sources.length} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#17365D] text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.20)] disabled:opacity-50">{pending?<><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/>Saving policy intake…</>:<><FileText className="h-4 w-4"/>Submit Policy Intake</>}</button>
      <div className="flex items-start gap-2 rounded-xl bg-[#F4F8FC] px-3 py-2.5 text-[9px] leading-4 text-[#667085]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#159566]"/>{proposalForm?"Proposal form is optional for Life/Health. If provided, it is stored securely for review without OCR or detail extraction.":"Your policy copy and sales details are saved first. The request is accepted immediately while policy and vehicle details are fetched in the background."}</div>
    </div>
  </section></form>;
}
