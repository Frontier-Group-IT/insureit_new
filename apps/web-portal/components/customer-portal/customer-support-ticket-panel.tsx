"use client";

import { useState, type ReactNode } from "react";
import { ClipboardList, Plus, Send, X } from "lucide-react";
import { CustomerServiceRequestForm } from "@/components/customer-portal/customer-service-request-form";

export function CustomerSupportTicketPanel({customerId,claims,search}:{customerId:string;claims:{id:string;claim_no:string;status:string}[];search:ReactNode}) {
  const [open,setOpen]=useState(false);
  return <div className="customer-workflow space-y-3">
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <h2 className="flex items-center gap-2 whitespace-nowrap text-[15px] font-bold text-[#29305D]"><ClipboardList className="h-4 w-4 text-[#673BEE]"/>My Support Requests</h2>
      {search}
      <div className="flex justify-start sm:justify-end">
    <button type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-controls="raise-support-ticket"
      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#6338ED] px-4 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#512AD3]">
      {open?<X className="h-3.5 w-3.5"/>:<Plus className="h-3.5 w-3.5"/>}{open?"Close Form":"Raise New Ticket"}
    </button>
      </div>
    </div>
    {open?<section id="raise-support-ticket" className="customer-workflow-reveal rounded-xl border border-[#E4E7F3] bg-white p-4 shadow-[0_5px_20px_rgba(80,65,145,.05)] sm:p-5">
      <div className="mb-4 flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#6739EE] text-white"><Send className="h-4 w-4"/></span>
        <div><h2 className="text-[15px] font-bold text-[#222659]">Raise a Support Ticket</h2><p className="text-[10px] text-[#8690AA]">Share your query or issue and our team will get back to you soon.</p></div>
      </div>
      <CustomerServiceRequestForm mode="support_ticket" customerId={customerId} claims={claims}/>
    </section>:null}
  </div>;
}
