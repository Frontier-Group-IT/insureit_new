"use client";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
export function GroupAlertDialog({message}:{message:string}) {
 const [open,setOpen]=useState(Boolean(message));
 useEffect(()=>setOpen(Boolean(message)),[message]);
 if(!open || !message) return null;
 return <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
  <div role="alertdialog" aria-modal="true" aria-labelledby="group-alert-title" aria-describedby="group-alert-text" className="w-full max-w-[472px] overflow-hidden rounded-[18px] bg-white text-center shadow-2xl">
   <div className="px-6 pb-6 pt-7"><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-orange-50 text-orange-600"><AlertTriangle className="h-5 w-5"/></span>
   <h3 id="group-alert-title" className="mt-5 text-[16px] font-bold text-[#17365D]">Check details</h3>
   <p id="group-alert-text" title={message} className="mt-3 truncate text-[12px] text-slate-500">{message.replace(/\s+/g," ").trim()}</p></div>
   <div className="grid grid-cols-2 gap-3 border-t bg-[#F8FAFC] px-5 py-4"><button type="button" onClick={()=>setOpen(false)} className="h-11 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-[#17365D]">Cancel</button><button type="button" onClick={()=>setOpen(false)} autoFocus className="h-11 rounded-xl bg-[#17365D] text-xs font-semibold text-white">OK</button></div>
  </div>
 </div>;
}
