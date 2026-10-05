"use client";

import { ExternalLink, FileText } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { openPolicyIntakeDocument } from "@/app/policy-intakes/actions";
import { getPolicyIntakeDocumentAvailability } from "@/app/policy-intakes/optional-proposal-actions";
import { getPolicyIntakeOcrRetryState } from "@/app/policy-intakes/retry-actions";
import { PolicyIntakeOcrRetryButton } from "@/components/policy-intake-ocr-retry-button";

export function PolicyIntakeDocumentButton({ id }: { id:string }) {
  const [error,setError]=useState<string|null>(null);
  const [retryable,setRetryable]=useState(false);
  const [hasDocument,setHasDocument]=useState<boolean|null>(null);
  const [proposal,setProposal]=useState(false);
  const [pending,startTransition]=useTransition();

  useEffect(()=>{
    let active=true;
    void Promise.all([getPolicyIntakeOcrRetryState(id),getPolicyIntakeDocumentAvailability(id)])
      .then(([retryResult,documentResult])=>{
        if(!active)return;
        if(retryResult.ok)setRetryable(retryResult.retryable);
        setHasDocument(documentResult.ok?documentResult.hasDocument:false);
        setProposal(documentResult.ok?documentResult.proposal:false);
      })
      .catch(()=>{if(active){setRetryable(false);setHasDocument(false);}});
    return()=>{active=false;};
  },[id]);

  function open(){setError(null);startTransition(async()=>{const result=await openPolicyIntakeDocument(id);if(!result.ok){setError(result.error);return;}window.open(result.url,"_blank","noopener,noreferrer");});}
  if(hasDocument===false&&proposal)return <div className="rounded-xl border border-[#D7E1EC] bg-[#F8FAFC] px-3 py-2.5 text-center text-[8.5px] font-semibold text-[#64748B]">Proposal form not provided · optional for Life/Health</div>;
  return <div className="space-y-2"><button type="button" onClick={open} disabled={pending||hasDocument===false} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D7E1EC] bg-white text-[9px] font-bold text-[#17365D] disabled:cursor-not-allowed disabled:opacity-50"><FileText className="h-3.5 w-3.5"/>{pending?"Opening…":proposal?"View proposal form":"View policy copy"}<ExternalLink className="h-3 w-3"/></button>{retryable?<PolicyIntakeOcrRetryButton id={id} className="[&>button]:w-full"/>:null}{error?<p className="mt-1.5 text-[8px] font-semibold text-red-600">{error}</p>:null}</div>;
}
