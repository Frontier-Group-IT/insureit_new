"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";

const OPTIONS = [
  {value:"90d",label:"90D"},
  {value:"mtd",label:"MTD"},
  {value:"ytd",label:"YTD"},
  {value:"all",label:"All time"},
  {value:"custom",label:"Custom"},
] as const;
type Period = typeof OPTIONS[number]["value"];

function useDailyReportLocation() {
  const pathname=usePathname()??"";
  const searchParams=useSearchParams();
  return {isDaily:pathname==="/reports/daily"||pathname.startsWith("/reports/daily/"),pathname,searchParams};
}

export function DailyReportHeaderScopes() {
  const {isDaily,searchParams}=useDailyReportLocation();
  if(!isDaily) return null;
  const scope=searchParams.get("scope")==="all"?"all":"self";
  function linkFor(target:"self"|"all") {
    const params=new URLSearchParams(searchParams.toString());
    params.set("scope",target);
    params.delete("person");
    params.delete("employee");
    params.delete("activity");
    params.set("page","1");
    return `/reports/daily?${params.toString()}`;
  }
  return (
    <nav aria-label="Daily Report visibility" className="flex items-center gap-1 rounded-lg border border-[#dbe3ed] bg-[#f4f7fb] p-1">
      {(["self","all"] as const).map(item=>(
        <Link key={item} prefetch={false} href={linkFor(item)}
          aria-current={scope===item?"page":undefined}
          className={`min-w-[62px] rounded-md px-3 py-1.5 text-center text-[11px] font-bold ${scope===item?"bg-[#17365D] text-white":"text-[#52627B] hover:bg-white"}`}>
          {item==="self"?"Self":"All"}
        </Link>
      ))}
    </nav>
  );
}

export function DailyReportHeaderPeriod() {
  const {isDaily,pathname,searchParams}=useDailyReportLocation();
  const router=useRouter();
  const ref=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false);
  const [customOpen,setCustomOpen]=useState(false);
  const value=searchParams.get("period");
  const active:Period=OPTIONS.some(o=>o.value===value)?value as Period:"all";
  const from=searchParams.get("from")||"";
  const to=searchParams.get("to")||"";
  useEffect(()=>{
    if(!open)return;
    const outside=(event:MouseEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node))setOpen(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("mousedown",outside);
    document.addEventListener("keydown",key);
    return ()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("keydown",key);};
  },[open]);

  if(!isDaily)return null;
  function setPeriod(period:Period, customFrom?:string,customTo?:string) {
    const params=new URLSearchParams(searchParams.toString());
    params.set("period",period);
    params.delete("date");
    if(period==="custom"&&customFrom&&customTo){
      params.set("from",customFrom);params.set("to",customTo);
    } else if(period!=="custom"){
      params.delete("from");params.delete("to");
    }
    params.set("page","1");
    setOpen(false);
    router.push(`${pathname}?${params.toString()}`,{scroll:false});
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={ref} className="relative">
        <button type="button" aria-haspopup="menu" aria-expanded={open}
          onClick={()=>setOpen(v=>!v)}
          className="inline-flex h-9 min-w-[145px] items-center justify-between gap-2 rounded-lg border border-[#cbd7e6] bg-white px-3 text-[11px] font-semibold text-[#233b5d]">
          <CalendarDays className="h-4 w-4"/>{OPTIONS.find(o=>o.value===active)?.label}<ChevronDown className="h-3.5 w-3.5"/>
        </button>
        {open&&<div role="menu" className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-[145px] overflow-hidden rounded-lg border border-[#d8e0eb] bg-white p-1 shadow-lg">
          {OPTIONS.map(option=><button key={option.value} type="button" role="menuitem"
            className={`w-full rounded-md px-3 py-2 text-left text-[11px] hover:bg-[#eef3fa] ${active===option.value?"bg-[#edf3fa] font-bold text-[#175caa]":"text-[#344862]"}`}
            onClick={()=>{
              setOpen(false);
              if(option.value==="custom")setCustomOpen(true);
              else {setCustomOpen(false);setPeriod(option.value);}
            }}>{option.label}</button>)}
        </div>}
      </div>
      {(active==="custom"||customOpen)&&(
        <ReportDateRangePicker from={from} to={to}
          open={customOpen} onOpenChange={setCustomOpen}
          buttonClassName="inline-flex h-9 min-w-[190px] items-center justify-between gap-3 rounded-lg border border-[#cbd7e6] bg-white px-3 text-left text-[11px] font-semibold text-[#233b5d]"
          onRangeComplete={(start,end)=>{setCustomOpen(false);setPeriod("custom",start,end);}}
        />
      )}
    </div>
  );
}
