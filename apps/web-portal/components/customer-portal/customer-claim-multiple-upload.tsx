"use client";

import { useActionState, useRef } from "react";
import { Files, Plus, Loader2 } from "lucide-react";
import { uploadCustomerClaimDocument } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/upload-action";

export function CustomerClaimMultipleUpload({claimId,accountId,stage,returnToSpotIntimation=false}:{claimId:string;accountId:string;stage:string;returnToSpotIntimation?:boolean}) {
  const [state,action,pending]=useActionState(uploadCustomerClaimDocument,{error:null});
  const picker=useRef<HTMLInputElement>(null);
  const form=useRef<HTMLFormElement>(null);
  return <form action={action} ref={form} className="mt-3">
    <input type="hidden" name="account" value={accountId}/><input type="hidden" name="claim" value={claimId}/><input type="hidden" name="stage" value={stage}/><input type="hidden" name="type" value="Other Document"/><input type="hidden" name="returnToSpotIntimation" value={returnToSpotIntimation?"1":"0"}/>
    <input ref={picker} type="file" name="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.mp4,.mov,.webm,.m4a,.ogg" className="sr-only" aria-label="Select multiple claim documents" onChange={event=>{if(event.currentTarget.files?.length)form.current?.requestSubmit();}}/>
    <button type="button" disabled={pending} onClick={()=>picker.current?.click()} className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-[#C5D8ED] bg-[#F8FAFE] px-4 py-3 text-left hover:border-[#4380CD] disabled:opacity-50">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#E5F0FF] text-[#1952A1]"><Files className="h-6 w-6"/></span>
      <span className="min-w-0 flex-1"><strong className="block text-[12px] text-[#102A52]">Upload multiple documents</strong><small className="text-[10px] text-[#7787A2]">{pending?"Uploading selected files…":"Select several files now, or tap again later to add more (up to 10 at once)."}</small></span>
      {pending?<Loader2 className="h-5 w-5 animate-spin text-[#1952A1]"/>:<Plus className="h-5 w-5 text-[#1952A1]"/>}
    </button>
    {state.error?<p role="alert" className="mt-2 text-[11px] text-red-700">{state.error}</p>:null}
  </form>;
}
