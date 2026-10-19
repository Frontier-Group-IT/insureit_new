"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reuseLinkedPolicyCopy } from "@/app/claims/[id]/reuse-policy-copy-action";

export function ReusePolicyCopyButton({claimId}:{claimId:string}) {
  const router=useRouter();
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState("");
  return <span className="inline-flex flex-col items-start gap-1">
    <button type="button" disabled={pending} onClick={()=>{
      setError("");
      startTransition(async()=>{
        try {
          const result=await reuseLinkedPolicyCopy(claimId);
          if(!result.ok) {setError(result.message);return;}
          router.refresh();
        } catch {setError("Unable to reuse policy copy. Please try again.");}
      });
    }} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-800 disabled:opacity-50">
      {pending?"Linking…":"Use Existing Policy Copy"}
    </button>
    {error?<span role="alert" className="max-w-56 text-[10px] text-red-700">{error}</span>:null}
  </span>;
}
