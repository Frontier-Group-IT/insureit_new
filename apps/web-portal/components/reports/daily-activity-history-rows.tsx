"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { SelfActivity } from "@/lib/reports/daily-self-activity";

const dateFormat=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric"});
const timeFormat=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:true});

type Props={rows:SelfActivity[];employeeName:string};

export function DailyActivityHistoryRows({rows,employeeName}:Props) {
  const router=useRouter();
  const [unavailable,setUnavailable]=useState<"deleted"|"missing"|"unsupported"|null>(null);
  const okRef=useRef<HTMLButtonElement>(null);
  const rowRef=useRef<HTMLTableRowElement|null>(null);
  useEffect(()=>{
    if(!unavailable)return;
    okRef.current?.focus();
    const onEscape=(event:globalThis.KeyboardEvent)=>{
      if(event.key==="Escape")setUnavailable(null);
    };
    document.addEventListener("keydown",onEscape);
    return ()=>{document.removeEventListener("keydown",onEscape);rowRef.current?.focus();};
  },[unavailable]);

  const openRecord=(row:SelfActivity,element:HTMLTableRowElement)=>{
    if(row.href) {
      router.push(row.href);
      return;
    }
    rowRef.current=element;
    setUnavailable(row.status==="Deleted"?"deleted":!row.table||!(["policies","policy_intake_requests","life_health_cases","customers","vehicles","claims"].includes(row.table))?"unsupported":"missing");
  };
  const onRowKeyDown=(event:KeyboardEvent<HTMLTableRowElement>,row:SelfActivity)=>{
    if(event.key==="Enter"||event.key===" "){
      event.preventDefault();
      openRecord(row,event.currentTarget);
    }
  };
  return (
    <>
      <tbody className="divide-y divide-[#edf1f6]">
        {rows.map(row=>(
          <tr key={row.id} role="button" tabIndex={0}
            aria-label={`Open ${row.activity}: ${row.reference}`}
            onClick={event=>openRecord(row,event.currentTarget)}
            onKeyDown={event=>onRowKeyDown(event,row)}
            className="cursor-pointer text-[11px] text-[#30435d] transition-colors hover:bg-[#edf5ff] focus-visible:bg-[#edf5ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#315b9a]">
            <td className="px-4 py-3 font-semibold">{employeeName}</td>
            <td className="px-3 py-3 font-semibold">{row.activity}</td>
            <td className="max-w-[260px] break-all px-3 py-3">{row.reference}</td>
            <td className="whitespace-nowrap px-3 py-3">{dateFormat.format(new Date(row.occurredAt))}</td>
            <td className="whitespace-nowrap px-3 py-3">{timeFormat.format(new Date(row.occurredAt))}</td>
            <td className="px-3 py-3"><span className="rounded-md bg-[#edf3fa] px-2 py-1 text-[9px] font-bold text-[#35587e]">{row.status}</span></td>
            <td className="whitespace-nowrap px-3 py-3 text-[10px] text-[#718096]">{row.source}</td>
          </tr>
        ))}
      </tbody>
      {unavailable && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b2140]/40 px-4"
          role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setUnavailable(null);}}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="daily-activity-unavailable-title"
            aria-describedby="daily-activity-unavailable-message"
            className="w-full max-w-[350px] rounded-2xl border border-[#dce4ef] bg-white p-5 shadow-2xl">
            <h3 id="daily-activity-unavailable-title" className="text-[14px] font-bold text-[#17365D]">Record unavailable</h3>
            <p id="daily-activity-unavailable-message" className="mt-2 text-[12px] text-[#52627b]">
              {unavailable==="deleted"?"This record has been deleted.":unavailable==="unsupported"?"Details are unavailable for this activity.":"This record is no longer available."}
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" ref={okRef} onClick={()=>setUnavailable(null)}
                className="min-w-[76px] rounded-lg bg-[#17365D] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#235185] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#315b9a]">OK</button>
            </div>
          </div>
        </div>,document.body
      )}
    </>
  );
}
