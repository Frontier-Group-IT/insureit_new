"use client";

import { ExternalLink, FileText } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { openPolicyIntakeDocument } from "@/app/policy-intakes/actions";
import { getPolicyIntakeOcrRetryState } from "@/app/policy-intakes/retry-actions";
import { PolicyIntakeOcrRetryButton } from "@/components/policy-intake-ocr-retry-button";

export function PolicyIntakeDocumentButton({ id }: { id:string }) {
  const [error,setError]=useState<string|null>(null);
  const [retryable,setRetryable]=useState(false);
  const [pending,startTransition]=useTransition();

  useEffect(()=>{
    let active=true;
    startTransition(async()=>{
      try {
        const result=await getPolicyIntakeOcrRetryState(id);
        if(active&&result.ok)setRetryable(result.retryable);
      } catch {
        if(active)setRetryable(false);
      }
    });
    return()=>{active=false;};
  },[id]);

  function open(){setError(null);startTransition(async()=>{const result=await openPolicyIntakeDocument(id);if(!result.ok){setError(result.error);return;}window.open(result.url,"_blank","noopener,noreferrer");});}
  return <div className="space-y-2"><button type="button" onClick={open} disabled={pending} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D7E1EC] bg-white text-[9px] font-bold text-[#17365D]"><FileText className="h-3.5 w-3.5"/>{pending?"Opening…":"View policy copy"}<ExternalLink className="h-3 w-3"/></button>{retryable?<PolicyIntakeOcrRetryButton id={id} className="[&>button]:w-full"/>:null}{error?<p className="mt-1.5 text-[8px] font-semibold text-red-600">{error}</p>:null}</div>;
}
