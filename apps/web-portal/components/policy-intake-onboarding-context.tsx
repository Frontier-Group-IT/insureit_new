"use client";

import { ExternalLink, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loadPolicyIntakeOnboardingContext, openPolicyIntakeDocument, type PolicyIntakeOnboardingContext } from "@/app/policy-intakes/actions";

const KEY="insureit:policy-intake:pending:v1";
const RESET_EVENT="insureit:policy-onboarding:reset";
const FOOTER_TARGET_ID="policy-intake-footer-left-target";

export function PolicyIntakeOnboardingContextCard(){
  const[context,setContext]=useState<PolicyIntakeOnboardingContext|null>(null);
  const[error,setError]=useState<string|null>(null);
  const[opening,setOpening]=useState(false);
  const[footerTarget,setFooterTarget]=useState<HTMLElement|null>(null);

  useEffect(()=>{
    let pending:{id?:string;savedAt?:number}|null=null;
    try{pending=JSON.parse(sessionStorage.getItem(KEY)||"null");}catch{}
    if(!pending?.id||!pending.savedAt||Date.now()-pending.savedAt>8*60*60*1000)return;
    void loadPolicyIntakeOnboardingContext(pending.id).then(result=>{if(result.ok)setContext(result.context);});
  },[]);

  useEffect(()=>{
    const clear=()=>{setContext(null);setError(null);setOpening(false);};
    window.addEventListener(RESET_EVENT,clear);
    return()=>window.removeEventListener(RESET_EVENT,clear);
  },[]);

  useEffect(()=>{
    if(!context)return;
    let frame=0;
    let attempts=0;

    const findFooter=()=>{
      const submitButton=Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(button=>{
        const label=button.textContent?.trim()??"";
        return label==="Book Active Policy"||label==="Booking policy…";
      });
      const actions=submitButton?.parentElement;
      if(actions){
        let target=document.getElementById(FOOTER_TARGET_ID);
        if(!target){
          target=document.createElement("div");
          target.id=FOOTER_TARGET_ID;
          target.className="mr-auto min-w-0";
          actions.insertBefore(target,actions.firstChild);
        }
        setFooterTarget(target);
        return;
      }
      if(attempts++<20)frame=requestAnimationFrame(findFooter);
    };

    findFooter();
    return()=>{
      cancelAnimationFrame(frame);
      const target=document.getElementById(FOOTER_TARGET_ID);
      target?.remove();
    };
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

  const action=<div className="flex min-w-0 flex-col items-start">
    <button type="button" onClick={openCopy} disabled={opening} className="flex h-9 items-center gap-2 rounded-xl border border-[#CFE0F2] bg-[#F4F8FC] px-3.5 text-[9px] font-bold text-[#244C73] transition hover:bg-[#EDF5FC] disabled:opacity-60">
      <FileText className="h-3.5 w-3.5"/>{opening?"Opening…":"View Policy Copy"}<ExternalLink className="h-3 w-3"/>
    </button>
    <p className="mt-1 max-w-[320px] truncate text-[8px] text-[#667085]">Policy Intake {context.number} · {context.leadSourceType} · {context.leadSource}</p>
    {error?<p className="mt-1 text-[8px] font-semibold text-red-600">{error}</p>:null}
  </div>;

  return footerTarget?createPortal(action,footerTarget):null;
}
