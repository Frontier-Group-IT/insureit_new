"use client";

import { ExternalLink, FileText, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadPolicyIntakeOnboardingContext, openPolicyIntakeDocument, type PolicyIntakeOnboardingContext } from "@/app/policy-intakes/actions";

const KEY="insureit:policy-intake:pending:v1";
const RESET_EVENT="insureit:policy-onboarding:reset";

export function PolicyIntakeOnboardingContextCard(){
  const[context,setContext]=useState<PolicyIntakeOnboardingContext|null>(null);
  const[error,setError]=useState<string|null>(null);
  const[opening,setOpening]=useState(false);
  const[desktopTarget,setDesktopTarget]=useState<HTMLElement|null>(null);

  useEffect(()=>{
    let pending:{id?:string;savedAt?:number}|null=null;
    try{pending=JSON.parse(sessionStorage.getItem(KEY)||"null");}catch{}
    if(!pending?.id||!pending.savedAt||Date.now()-pending.savedAt>8*60*60*1000)return;
    void loadPolicyIntakeOnboardingContext(pending.id).then(result=>{if(result.ok)setContext(result.context);});
  },[]);

  useEffect(()=>{
    const clear=()=>{setContext(null);setError(null);setOpening(false);setDesktopTarget(null);};
    window.addEventListener(RESET_EVENT,clear);
    return()=>window.removeEventListener(RESET_EVENT,clear);
  },[]);

  useEffect(()=>{
    if(!context)return;
    let frame=0;
    let attempts=0;
    const findTarget=()=>{
      if(window.innerWidth<1280){setDesktopTarget(null);return;}
      const target=document.getElementById("policy-summary-fixed-card");
      if(target){
        setDesktopTarget(target);
        requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
        return;
      }
      if(attempts++<12)frame=requestAnimationFrame(findTarget);
    };
    findTarget();
    const onResize=()=>findTarget();
    window.addEventListener("resize",onResize);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("resize",onResize);};
  },[context]);

  async function openCopy(){
    if(!context)return;
    setOpening(true);setError(null);
    const result=await openPolicyIntakeDocument(context.id);
    setOpening(false);
    if(!result.ok){setError(result.error);return;}
    window.open(result.url,"_blank","noopener,noreferrer");
  }

  if(!context)return null;
  const card=<div className="rounded-2xl border border-[#D9E2F0] bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,.09)]"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EEF4FB] text-[#315B9A]"><ShieldCheck className="h-3.5 w-3.5"/></span><div className="min-w-0 flex-1"><p className="text-[7.5px] font-bold uppercase tracking-[.1em] text-[#7A8798]">Policy Intake</p><p className="truncate text-[10.5px] font-bold text-[#17365D]">{context.number}</p></div></div><button type="button" onClick={openCopy} disabled={opening} className="mt-2.5 flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[#CFE0F2] bg-[#F4F8FC] text-[9px] font-bold text-[#244C73] hover:bg-[#EDF5FC] disabled:opacity-60"><FileText className="h-3.5 w-3.5"/>{opening?"Opening…":"View Policy Copy"}<ExternalLink className="h-3 w-3"/></button><div className="mt-2.5 space-y-1.5 border-t border-[#E8EDF3] pt-2.5 text-[8.5px] text-[#667085]"><p className="flex items-center gap-1.5"><UserRound className="h-3 w-3 text-[#7A8798]"/><span className="font-semibold text-[#344054]">{context.submittedBy}</span></p><p><span className="font-semibold text-[#344054]">{context.leadSourceType}</span> · {context.leadSource}</p><p>Customer · {context.customerMobile}</p></div>{error?<p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[8px] font-semibold text-red-700">{error}</p>:null}</div>;

  return <>
    <div className="mt-3 xl:hidden">{card}</div>
    {desktopTarget?createPortal(<div className="mt-2">{card}</div>,desktopTarget):null}
  </>;
}
