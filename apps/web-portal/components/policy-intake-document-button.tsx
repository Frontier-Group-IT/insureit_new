"use client";

import { ExternalLink, FileText } from "lucide-react";
import { useState, useTransition } from "react";
import { openPolicyIntakeDocument } from "@/app/policy-intakes/actions";

export function PolicyIntakeDocumentButton({ id }: { id:string }) {
  const [error,setError]=useState<string|null>(null); const [pending,startTransition]=useTransition();
  function open(){setError(null);startTransition(async()=>{const result=await openPolicyIntakeDocument(id);if(!result.ok){setError(result.error);return;}window.open(result.url,"_blank","noopener,noreferrer");});}
  return <div><button type="button" onClick={open} disabled={pending} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#D7E1EC] bg-white text-[9px] font-bold text-[#17365D]"><FileText className="h-3.5 w-3.5"/>{pending?"Opening…":"View policy copy"}<ExternalLink className="h-3 w-3"/></button>{error?<p className="mt-1.5 text-[8px] font-semibold text-red-600">{error}</p>:null}</div>;
}
