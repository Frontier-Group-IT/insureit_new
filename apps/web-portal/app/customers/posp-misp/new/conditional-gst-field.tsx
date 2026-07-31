"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ConditionalGstField(){
 const [target,setTarget]=useState<HTMLElement|null>(null);
 const [enabled,setEnabled]=useState(false);
 useEffect(()=>{
  let observer:MutationObserver|null=null;
  const attach=()=>{
   const form=document.querySelector<HTMLFormElement>('form input[name="partner_type"][value="posp"]')?.form;
   const ifsc=form?.querySelector<HTMLInputElement>('input[name="bank_ifsc_code"]');
   const grid=ifsc?.parentElement?.parentElement;
   if(!form||!ifsc||!grid)return false;
   let mount=form.querySelector<HTMLElement>('[data-conditional-gst-mount]');
   if(!mount){mount=document.createElement("div");mount.dataset.conditionalGstMount="true";mount.className="contents";grid.insertBefore(mount,ifsc.parentElement?.nextSibling??null)}
   setTarget(mount);return true;
  };
  if(!attach()){observer=new MutationObserver(()=>{if(attach())observer?.disconnect()});observer.observe(document.body,{childList:true,subtree:true})}
  return()=>observer?.disconnect();
 },[]);
 if(!target)return null;
 return createPortal(<>
  <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-[10.5px] font-semibold text-[#344054]">
   <input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)} className="h-4 w-4 accent-[#4F46E5]"/>
   GST number
  </label>
  {enabled?<div className="min-w-0"><label htmlFor="gst_number" className="mb-1.5 block text-[10.5px] font-semibold text-[#344054]">GST Number *</label><input id="gst_number" name="gst_number" required maxLength={15} minLength={15} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" onInput={event=>{event.currentTarget.value=event.currentTarget.value.toUpperCase().replace(/\s/g,"")}} className="h-11 w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-[12px] uppercase text-[#17203A] outline-none transition focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF] invalid:border-red-500 invalid:ring-2 invalid:ring-red-100" placeholder="22ABCDE1234F1Z5"/></div>:null}
 </>,target);
}
