"use client";

import { useRouter } from "next/navigation";
import { ReportFilterField, reportInputClass } from "@/components/reports/report-page-shell";

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
    <div className="grid gap-2 sm:grid-cols-[160px_minmax(180px,1fr)]">
      <ReportFilterField label="Horizon">
        <select
          name="horizon"
          value={String(horizonDays)}
          className={reportInputClass}
          onChange={(event)=>update("horizon",event.target.value)}
        >
          {HORIZONS.map((value)=><option key={value} value={value}>{value} days</option>)}
        </select>
      </ReportFilterField>
      <ReportFilterField label="Exception">
        <select
          name="exception"
          value={exception??""}
          className={reportInputClass}
          onChange={(event)=>update("exception",event.target.value)}
        >
          <option value="">All vehicles</option>
          <option value="missing">Missing compliance data</option>
          <option value="expired">Expired documents</option>
          <option value="due">Due within horizon</option>
          <option value="unverified">AuthBridge unverified</option>
        </select>
      </ReportFilterField>
    </div>
  );
}
