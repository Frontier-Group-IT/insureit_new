"use client";

import { CalendarDays, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

const HORIZONS=[30,60,90,180,365] as const;

export function OperationsReportFilters({
  horizonDays,
  exception,
}:{
  horizonDays:number;
  exception:string|null;
}){
  const router=useRouter();

  function update(name:"horizon"|"exception",value:string){
    const params=new URLSearchParams(window.location.search);
    if(name==="exception"){
      if(value) params.set(name,value);
      else params.delete(name);
    }else{
      params.set(name,value);
    }
    params.delete("page");
    const query=params.toString();
    router.push(query?"/reports/operations?"+query:"/reports/operations");
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="inline-flex h-[34px] min-w-[118px] items-center gap-2 rounded-[5px] border border-[#ced9e6] bg-white px-2.5 text-[#23456d] shadow-[0_1px_2px_rgba(16,41,92,0.03)] transition hover:border-[#91a9c3] hover:bg-[#f8fbff]">
        <span className="sr-only">Horizon</span>
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <select name="horizon" value={String(horizonDays)} className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent pr-1 text-[10px] font-bold text-inherit outline-none" onChange={(event)=>update("horizon",event.target.value)}>
          {HORIZONS.map((value)=><option key={value} value={value}>{value} days</option>)}
        </select>
      </label>
      <label className="inline-flex h-[34px] min-w-[165px] items-center gap-2 rounded-[5px] border border-[#ced9e6] bg-white px-2.5 text-[#23456d] shadow-[0_1px_2px_rgba(16,41,92,0.03)] transition hover:border-[#91a9c3] hover:bg-[#f8fbff]">
        <span className="sr-only">Exception</span>
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
        <select name="exception" value={exception??""} className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent pr-1 text-[10px] font-bold text-inherit outline-none" onChange={(event)=>update("exception",event.target.value)}>
          <option value="">All vehicles</option>
          <option value="missing">Missing compliance data</option>
          <option value="expired">Expired documents</option>
          <option value="due">Due within horizon</option>
          <option value="unverified">AuthBridge unverified</option>
        </select>
      </label>
    </div>
  );
}
