"use client";
import {useEffect,useRef,type ReactNode} from "react";

import {Plus,X} from "lucide-react";
export function GroupAssociateCreateEntry({hasRecords,form,error}:{hasRecords:boolean;form:ReactNode;error?:string}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(error){dialog.current?.showModal()}},[error]);
 const show=()=>{dialog.current?.showModal()};
 const close=()=>{dialog.current?.close()};
 const button=<button type="button" onClick={show} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#17365D] px-4 text-[11px] font-semibold text-white hover:bg-[#234E82]"><Plus className="h-4 w-4"/>Create Associate</button>;
 return <>
  {hasRecords?button:
   <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
    <Image src="/illustrations/group-associate-no-results.png" alt="No Result Found" width={215} height={197}/>
    <p className="mb-2 text-[11px] text-[#8190A4]">No Associate Accounts have been created for this Group.</p>
    {button}
   </div>}
  <dialog ref={dialog} aria-labelledby="group-associate-dialog-title" className="w-[min(94vw,1000px)] max-h-[90vh] overflow-y-auto rounded-2xl border border-[#DCE5EF] bg-white p-0 shadow-2xl backdrop:bg-[#061B35]/55">
   <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#E7ECF3] bg-white px-5 py-4">
    <h2 id="group-associate-dialog-title" className="text-[15px] font-semibold text-[#17365D]">Create Group Associate Account</h2>
    <button type="button" aria-label="Close Associate form" onClick={close} className="grid h-8 w-8 place-items-center rounded-lg border border-[#D7E0EA]"><X className="h-4 w-4"/></button>
   </div>
   {error?<p role="alert" className="mx-5 mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>:null}
   {form}
  </dialog>
 </>;
}
