"use client";

import { type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { SelfActivity } from "@/lib/reports/daily-self-activity";

const dateFormat=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric"});
const timeFormat=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:true});

type Props={rows:SelfActivity[];isCustomerActivity?:boolean};
const customerField=(value:string|number|undefined|null)=>value===undefined||value===null||value===""?"—":String(value);

export function DailyActivityHistoryRows({rows,isCustomerActivity=false}:Props) {
  const router=useRouter();
  // Navigate immediately to existing, server-validated canonical records.
  // Missing and permanently deleted records have no verified destination.
  const openRecord=(row:SelfActivity)=>{
    if(row.href) router.push(row.href);
  };
  const onRowKeyDown=(event:KeyboardEvent<HTMLTableRowElement>,row:SelfActivity)=>{
    if(event.key==="Enter"||event.key===" "){
      event.preventDefault();
      if(row.href) openRecord(row);
    }
  };
  return (
    <>
      <tbody className="divide-y divide-[#edf1f6]">
        {rows.map(row=>(
          <tr key={row.id} role={row.href?"button":undefined} tabIndex={row.href?0:undefined}
            aria-label={row.href?`Open record: ${row.activity}, ${row.reference}`:undefined}
            onClick={()=>openRecord(row)}
            onKeyDown={event=>onRowKeyDown(event,row)}
            className={`${row.href?"cursor-pointer hover:bg-[#edf5ff] focus-visible:bg-[#edf5ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#315b9a]":"cursor-default"} text-[11px] text-[#30435d] transition-colors`}>
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

    </>
  );
}
