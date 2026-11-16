"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { SelfActivity } from "@/lib/reports/daily-self-activity";

const dateFormat=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric"});
const timeFormat=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:true});

type Props={rows:SelfActivity[];isCustomerActivity?:boolean;isClaimActivity?:boolean;vehicleMode?:boolean;isOtherActivity?:boolean};
const customerField=(value:string|number|undefined|null)=>value===undefined||value===null||value===""?"—":String(value);

export function DailyActivityHistoryRows({rows,isCustomerActivity=false,isClaimActivity=false,vehicleMode=false,isOtherActivity=false}:Props) {
  const router=useRouter();
  const [deletedClaim,setDeletedClaim]=useState<SelfActivity|null>(null);
  const closeRef=useRef<HTMLButtonElement>(null);
  const activeRow=useRef<HTMLTableRowElement|null>(null);
  const canOpen=(row:SelfActivity)=>Boolean(row.href)||(isClaimActivity&&row.status==="Deleted");
  const openRecord=(row:SelfActivity,element:HTMLTableRowElement)=>{
    if(isClaimActivity&&row.status==="Deleted") {
      activeRow.current=element;
      setDeletedClaim(row);
    } else if(row.href) router.push(row.href);
  };
  useEffect(()=>{
    if(!deletedClaim)return;
    closeRef.current?.focus();
    const escape=(event:globalThis.KeyboardEvent)=>{if(event.key==="Escape")setDeletedClaim(null);};
    document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("keydown",escape);activeRow.current?.focus();};
  },[deletedClaim]);
  const onRowKeyDown=(event:KeyboardEvent<HTMLTableRowElement>,row:SelfActivity)=>{
    if(event.key==="Enter"||event.key===" "){
      event.preventDefault();
      if(canOpen(row)) openRecord(row,event.currentTarget);
    }
  };
  return (
    <>
      <tbody className="divide-y divide-[#edf1f6]">
        {rows.map(row=>(
          <tr key={row.id} role={canOpen(row)?"button":undefined} tabIndex={canOpen(row)?0:undefined}
            aria-label={canOpen(row)?`${row.status==="Deleted"&&isClaimActivity?"View deleted claim":"Open record"}: ${row.activity}, ${vehicleMode ? row.vehicleNumber||"vehicle record" : isClaimActivity ? row.claimControlNo||row.claimInsurerNo||"claim record" : isOtherActivity ? row.subjectEmployeeName||"employee action" : row.reference}`:undefined}
            onClick={canOpen(row)?event=>openRecord(row,event.currentTarget):undefined}
            onKeyDown={canOpen(row)?event=>onRowKeyDown(event,row):undefined}
            className={`${canOpen(row)?"cursor-pointer [&_td]:cursor-pointer hover:bg-[#edf5ff] focus-visible:bg-[#edf5ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#315b9a]":"cursor-default"} text-[11px] text-[#30435d] transition-colors`}>
            <td className="px-4 py-3 font-semibold">
              <span className="block">{row.activity}</span>
              {row.detail ? <span className="mt-1 block font-normal text-[#506483]">{row.detail}</span> : null}
            </td>
            {isCustomerActivity ? (
              <>
                <td className="px-3 py-3 font-medium">{customerField(row.customerName)}</td>
                <td className="px-3 py-3">{customerField(row.customerType)}</td>
                <td className="px-3 py-3 tabular-nums">{customerField(row.customerMobile)}</td>
              </>
            ) : vehicleMode ? (
              <>
                <td className="px-3 py-3 font-medium">{row.vehicleNumber||"—"}</td>
                <td className="px-3 py-3">{row.vehicleCustomer||"—"}</td>
                <td className="px-3 py-3">{row.vehicleMakeModel||"—"}</td>
                <td className="px-3 py-3">{row.vehicleRegistration||"—"}</td>
              </>
            ) : isClaimActivity ? (
              <>
                <td className="px-3 py-3 font-medium">{customerField(row.claimControlNo)}</td>
                <td className="px-3 py-3">{customerField(row.claimInsurerNo)}</td>
                <td className="px-3 py-3">{customerField(row.claimCustomerName)}</td>
                <td className="px-3 py-3">{customerField(row.claimVehicleNo)}</td>
              </>
            ) : isOtherActivity ? (
              <td className="px-3 py-3 font-medium">{customerField(row.subjectEmployeeName)}</td>
            ) : (
              <>
                <td className="px-3 py-3 font-medium">{row.reference||"—"}</td>
                <td className="px-3 py-3">{row.customerVehicle||"—"}</td>
                <td className="px-3 py-3">{row.insurer||"—"}</td>
              </>
            )}
            <td className="whitespace-nowrap px-3 py-3">{dateFormat.format(new Date(row.occurredAt))}, {timeFormat.format(new Date(row.occurredAt))}</td>
            <td className="px-3 py-3"><span className="rounded-md bg-[#edf3fa] px-2 py-1 text-[9px] font-bold text-[#35587e]">{row.status}</span></td>
          </tr>
        ))}
      </tbody>
      {deletedClaim && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b2140]/50 p-4"
          role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setDeletedClaim(null);}}>
          <div role="dialog" aria-modal="true" aria-labelledby="daily-deleted-claim-title"
            className="w-full max-w-[500px] rounded-2xl border border-[#dce4ef] bg-white p-5 shadow-2xl">
            <h3 id="daily-deleted-claim-title" className="text-[15px] font-bold text-[#17365D]">Deleted claim details</h3>
            <p className="mt-1 text-[11px] text-[#6e7a8c]">This claim no longer exists in the register. Only recorded historical details are shown.</p>
            <dl className="mt-4 grid grid-cols-[115px_minmax(0,1fr)] gap-x-3 gap-y-3 text-[12px] text-[#30435d]">
              {([
                ["Activity",deletedClaim.activity],
                ["Control No.",customerField(deletedClaim.claimControlNo)],
                ["Claim No.",customerField(deletedClaim.claimInsurerNo)],
                ["Customer",customerField(deletedClaim.claimCustomerName)],
                ["Vehicle No.",customerField(deletedClaim.claimVehicleNo)],
                ["Date & Time",`${dateFormat.format(new Date(deletedClaim.occurredAt))}, ${timeFormat.format(new Date(deletedClaim.occurredAt))}`],
                ["Status",deletedClaim.status],
              ] as const).map(([label,value])=><div key={label} className="contents">
                <dt className="font-semibold text-[#65748b]">{label}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </div>)}
            </dl>
            <div className="mt-5 flex justify-end">
              <button type="button" ref={closeRef} onClick={()=>setDeletedClaim(null)}
                className="rounded-lg bg-[#17365D] px-4 py-2 text-[12px] font-bold text-white">Close</button>
            </div>
          </div>
        </div>,document.body
      )}
    </>
  );
}
