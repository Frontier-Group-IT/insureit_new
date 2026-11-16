"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { SelfActivity } from "@/lib/reports/daily-self-activity";

const dateFormat=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric"});
const timeFormat=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:true});

type Props={rows:SelfActivity[];vehicleMode?:boolean};

export function DailyActivityHistoryRows({rows,vehicleMode=false}:Props) {
  const router=useRouter();
  const [selected,setSelected]=useState<SelfActivity|null>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const rowRef=useRef<HTMLTableRowElement|null>(null);
  useEffect(()=>{
    if(!selected)return;
    closeRef.current?.focus();
    const onEscape=(event:globalThis.KeyboardEvent)=>{
      if(event.key==="Escape")setSelected(null);
    };
    document.addEventListener("keydown",onEscape);
    return ()=>{document.removeEventListener("keydown",onEscape);rowRef.current?.focus();};
  },[selected]);

  const openRecord=(row:SelfActivity,element:HTMLTableRowElement)=>{
    rowRef.current=element;
    setSelected(row);
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
            aria-label={`View activity details: ${row.activity}, ${vehicleMode ? row.vehicleNumber||'vehicle record' : row.reference}`}
            onClick={event=>openRecord(row,event.currentTarget)}
            onKeyDown={event=>onRowKeyDown(event,row)}
            className="cursor-pointer text-[11px] text-[#30435d] transition-colors hover:bg-[#edf5ff] focus-visible:bg-[#edf5ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#315b9a]">
            <td className="px-4 py-3 font-semibold">
              <span className="block">{row.activity}</span>
              {row.detail ? <span className="mt-1 block font-normal text-[#506483]">{row.detail}</span> : null}
            </td>
            {vehicleMode ? <>
              <td className="px-3 py-3 font-medium">{row.vehicleNumber||"—"}</td>
              <td className="px-3 py-3">{row.vehicleCustomer||"—"}</td>
              <td className="px-3 py-3">{row.vehicleMakeModel||"—"}</td>
              <td className="px-3 py-3">{row.vehicleRegistration||"—"}</td>
            </> : <>
              <td className="px-3 py-3 font-medium">{row.reference||"—"}</td>
              <td className="px-3 py-3">{row.customerVehicle||"—"}</td>
              <td className="px-3 py-3">{row.insurer||"—"}</td>
            </>}
            <td className="whitespace-nowrap px-3 py-3">{dateFormat.format(new Date(row.occurredAt))}, {timeFormat.format(new Date(row.occurredAt))}</td>
            <td className="px-3 py-3"><span className="rounded-md bg-[#edf3fa] px-2 py-1 text-[9px] font-bold text-[#35587e]">{row.status}</span></td>
          </tr>
        ))}
      </tbody>
      {selected && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b2140]/40 px-4"
          role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null);}}>
          <div role="dialog" aria-modal="true" aria-labelledby="daily-activity-detail-title"
            className="w-full max-w-[520px] rounded-2xl border border-[#dce4ef] bg-white p-5 shadow-2xl">
            <h3 id="daily-activity-detail-title" className="text-[15px] font-bold text-[#17365D]">Activity details</h3>
            <dl className="mt-4 grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-3 text-[12px] text-[#30435d]">
              {([
                ["Activity",selected.activity],
                ...(vehicleMode ? [
                  ["Vehicle",selected.vehicleNumber||"—"],
                  ["Customer",selected.vehicleCustomer||"—"],
                  ["Make / model",selected.vehicleMakeModel||"—"],
                  ["Registration",selected.vehicleRegistration||"—"],
                ] as const : [
                  ["Policy / Case No.",selected.reference||"—"],
                  ["Customer / Vehicle",selected.customerVehicle||"—"],
                  ["Insurance Company",selected.insurer||"—"],
                ] as const),
                ["Date & Time",`${dateFormat.format(new Date(selected.occurredAt))}, ${timeFormat.format(new Date(selected.occurredAt))}`],
                ["Status",selected.status],
                ["Recorded changes",selected.detail||"Not recorded"],
              ] as const).map(([label,value])=><div key={label} className="contents"><dt className="font-semibold text-[#60718c]">{label}</dt><dd className="min-w-0 break-words">{value}</dd></div>)}
            </dl>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" ref={closeRef} onClick={()=>setSelected(null)}
                className="rounded-lg border border-[#dce4ef] px-4 py-2 text-[12px] font-bold text-[#17365D]">Close</button>
              {selected.href && <button type="button" onClick={()=>{router.push(selected.href!);setSelected(null);}}
                className="rounded-lg bg-[#17365D] px-4 py-2 text-[12px] font-bold text-white">Open record</button>}
            </div>
          </div>
        </div>,document.body
      )}
    </>
  );
}
