"use client";
import { Download, Mail, X } from "lucide-react";
import { useState } from "react";
type Props={params:{rm?:string;period?:string;from?:string;to?:string};periodLabel:string};
export function RmReportActions({params,periodLabel}:Props){
  const [open,setOpen]=useState(false);
  const [to,setTo]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const query=new URLSearchParams();
  for(const field of ["rm","period","from","to"] as const)if(params[field])query.set(field,params[field]!);
  const pdfHref="/api/reports/rm-performance/pdf?"+query.toString();
  async function send(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/reports/rm-performance/email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...params,to})});
      const result=await response.json() as {ok?:boolean;error?:string};
      if(!response.ok||!result.ok)throw new Error(result.error??"Unable to email report.");
      setMessage("Report emailed successfully.");
    }catch(error){setMessage(error instanceof Error?error.message:"Email failed.");}
    finally{setBusy(false);}
  }
  return <>
    <button type="button" onClick={()=>{setOpen(true);setMessage("");}} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10px] font-bold text-[#17365D] hover:bg-[#F0F5FB]"><Mail className="h-3.5 w-3.5"/>Email Report</button>
    <a href={pdfHref} download className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#17365D] px-3 text-[10px] font-bold text-white hover:bg-[#234C80]"><Download className="h-3.5 w-3.5"/>Download PDF</a>
    {open?<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
      <form onSubmit={send} role="dialog" aria-modal="true" aria-label="Email RM business report" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between"><h2 className="text-base font-bold text-[#17365D]">Email Business Report</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Close"><X className="h-4 w-4"/></button></div>
        <p className="text-xs text-[#64748B]">PDF includes Today&apos;s data and {periodLabel}, RM hierarchy and Direct Partners.</p>
        <label className="block text-xs font-semibold text-[#334155]">Recipient email
          <input type="email" required autoFocus maxLength={254} value={to} onChange={e=>setTo(e.target.value)} placeholder="name@example.com" className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] px-3 text-sm"/>
        </label>
        {message?<p role="status" className="text-xs text-[#334155]">{message}</p>:null}
        <div className="flex justify-end gap-2"><button type="button" onClick={()=>setOpen(false)} className="rounded-lg border px-4 py-2 text-xs">Close</button><button disabled={busy} type="submit" className="rounded-lg bg-[#17365D] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy?"Sending...":"Send PDF"}</button></div>
      </form>
    </div>:null}
  </>;
}
