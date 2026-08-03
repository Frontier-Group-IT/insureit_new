"use client";

import Link from "next/link";
import { useEffect } from "react";

type Props={applicationId:string;message:string|null;field:string|null};

export function WorkflowErrorDialog({applicationId,message,field}:Props){
 const inlineMessage=field&&message&&isGenericFieldMessage(message)?"Please match the requested format.":message;
 useEffect(()=>{
  if(!field||!inlineMessage)return;
  const timer=window.setTimeout(()=>{
   const element=document.querySelector<HTMLElement>(`[name="${CSS.escape(field)}"]`);
   if(!element)return;
   const container=element.closest<HTMLElement>("[data-field-container]");
   const error=container?.querySelector<HTMLElement>("[data-field-error]");
   container?.setAttribute("data-invalid","true");
   element.setAttribute("aria-invalid","true");
   if(error){error.textContent=inlineMessage;error.hidden=false;element.setAttribute("aria-describedby",error.id)}
   element.scrollIntoView({behavior:"smooth",block:"center"});
   element.focus({preventScroll:true});
  },80);
  return()=>window.clearTimeout(timer);
 },[field,inlineMessage]);

 if(!message||field)return null;
 const closeHref=`/intermediaries/applications/${applicationId}/workflow?stage=documents`;
 return <div className="fixed inset-0 z-[2147483000] grid place-items-center bg-[#081127]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="workflow-error-title"><div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-red-100 bg-white shadow-[0_28px_90px_rgba(8,17,39,.28)]"><div className="flex items-start justify-between gap-4 border-b border-[#FEE2E2] px-5 py-4"><div><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-red-600">Unable to save</p><h2 id="workflow-error-title" className="mt-1 text-[16px] font-semibold text-[#0F172A]">Review the highlighted information</h2></div><Link href={closeHref} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg border border-[#DCE5EF] text-[16px] text-[#64748B]">×</Link></div><div className="px-5 py-5"><div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-100 font-bold text-red-700">!</span><p className="text-[10.5px] leading-5 text-red-800">{message}</p></div></div><div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4"><Link href={closeHref} className="block rounded-xl bg-[#071D49] px-4 py-2.5 text-center text-[10px] font-semibold text-white">Review primary details</Link></div></div></div>;
}

function isGenericFieldMessage(message:string){const normalized=message.toLowerCase();return normalized.includes("requested change could not be saved")||normalized.includes("complete the required intermediary")||normalized.includes("review the entered information")}
