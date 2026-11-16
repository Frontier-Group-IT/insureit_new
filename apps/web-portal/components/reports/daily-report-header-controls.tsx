"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";

const OPTIONS = [
  {value:"today",label:"Today"},
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

type ReportPerson = { id: string; full_name: string | null; employee_code: string | null };

export function DailyReportHeaderScopes({canViewAll=false}:{canViewAll?:boolean}) {
  const {isDaily,searchParams}=useDailyReportLocation();
  const router=useRouter();
  const selectedPerson=canViewAll && searchParams.get("scope")==="all" ? searchParams.get("person") : null;
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState("");
  const [people,setPeople]=useState<ReportPerson[]>([]);
  const [loading,setLoading]=useState(canViewAll);
  const [loadError,setLoadError]=useState(false);
  const container=useRef<HTMLDivElement>(null);
  const matching=people.filter(person=>
    (person.full_name??"").toLocaleLowerCase("en-IN").includes(search.trim().toLocaleLowerCase("en-IN"))
    || (person.employee_code??"").toLocaleLowerCase("en-IN").includes(search.trim().toLocaleLowerCase("en-IN")));
  const selected=people.find(person=>person.id===selectedPerson);
  useEffect(()=>{
    if(!isDaily || !canViewAll)return;
    const controller=new AbortController();
    const load=async()=>{
      setLoading(true);setLoadError(false);
      try {
        const response=await fetch("/api/reports/daily/employees",{credentials:"same-origin",cache:"no-store",signal:controller.signal});
        if(!response.ok)throw new Error("Could not load authorized employees");
        const payload: {people?:ReportPerson[]} = await response.json();
        if(!controller.signal.aborted)setPeople(Array.isArray(payload.people)?payload.people:[]);
      }catch{
        if(!controller.signal.aborted){setPeople([]);setLoadError(true);}
      }finally{
        if(!controller.signal.aborted)setLoading(false);
      }
    };
    void load();
    return ()=>controller.abort();
  },[open,isDaily,selectedPerson,canViewAll]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:MouseEvent)=>{if(container.current&&!container.current.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("mousedown",outside);
    document.addEventListener("keydown",escape);
    return ()=>{document.removeEventListener("mousedown",outside);document.removeEventListener("keydown",escape);};
  },[open]);
  useEffect(()=>{setOpen(false);setSearch("");},[selectedPerson]);
  if(!isDaily) return null;
  // A reporting permission alone does not imply any other employee is in scope.
  // Use the authorized endpoint's filtered directory, never the job role, to
  // determine whether a selectable employee actually exists.
  const hasOtherEmployees=people.length>0;
  const showDropdown=canViewAll && (hasOtherEmployees || loadError);
  if(!showDropdown) {
    return <span aria-label="Daily Report scope: Self" className="daily-report-header-select inline-flex h-9 min-w-[145px] items-center rounded-lg border border-[#cbd7e6] bg-white px-3 text-[11px] font-semibold text-[#17365D]">Self</span>;
  }
  function selectPerson(personId:string|null) {
    const params=new URLSearchParams(searchParams.toString());
    params.set("scope",personId && canViewAll?"all":"self");
    if(personId && canViewAll)params.set("person",personId);
    else params.delete("person");
    params.delete("employee");
    params.delete("activity");
    params.set("page","1");
    setOpen(false);
    setSearch("");
    router.push(`/reports/daily?${params.toString()}`,{scroll:false});
  }
  return (
    <div ref={container} className="relative" aria-label="Daily Report employee selector">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls="daily-report-employee-options"
        onClick={()=>{setOpen(value=>!value);setSearch("");}}
        className="daily-report-header-select inline-flex h-9 min-w-[145px] max-w-[235px] items-center justify-between gap-3 rounded-lg border border-[#cbd7e6] bg-white px-3 text-[11px] font-semibold text-[#17365D] hover:bg-[#f5f8fc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#315b9a]">
        <span className="truncate">{!selectedPerson?"Self":selected?.full_name||"Selected employee"}</span><ChevronDown className="h-3.5 w-3.5 shrink-0"/>
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-[270px] max-w-[calc(100vw-32px)] rounded-lg border border-[#d8e0eb] bg-white p-2 shadow-lg">
          <input type="search" aria-label="Search employee name or code" placeholder="Search employee name or code..."
            autoFocus value={search} onChange={event=>setSearch(event.target.value)}
            className="mb-1.5 h-9 w-full rounded-md border border-[#d8e0eb] px-2 text-[11px] text-[#17365D] outline-none focus:border-[#315b9a]"/>
          <div id="daily-report-employee-options" role="listbox" aria-label="Authorized employee" className="max-h-[300px] overflow-y-auto">
            {"self".includes(search.trim().toLowerCase())?<button type="button" role="option" aria-selected={!selectedPerson}
              onClick={()=>selectPerson(null)}
              className={`block w-full rounded-md px-3 py-2 text-left text-[11px] font-semibold hover:bg-[#eef3fa] ${!selectedPerson?"bg-[#edf3fa] text-[#17365D]":"text-[#52627B]"}`}>Self</button>:null}
            {canViewAll?matching.map(person=>(
              <button key={person.id} type="button" role="option" aria-selected={selectedPerson===person.id}
                onClick={()=>selectPerson(person.id)}
                className={`block w-full rounded-md px-3 py-2 text-left hover:bg-[#eef3fa] ${selectedPerson===person.id?"bg-[#edf3fa]":"text-[#52627B]"}`}>
                <span className="block truncate text-[11px] font-semibold">{person.full_name||"Unnamed employee"}</span>
                {person.employee_code?<span className="block truncate text-[9px] text-[#8794a6]">{person.employee_code}</span>:null}
              </button>
            )):null}
            {canViewAll&&loading?<p className="px-3 py-2 text-[11px] text-[#667085]">Loading employees...</p>:null}
            {canViewAll&&loadError?<p role="alert" className="px-3 py-2 text-[11px] text-red-700">Could not load authorized employees. Close and reopen to retry.</p>:null}
            {canViewAll&&!loading&&!loadError&&!matching.length&&!("self".includes(search.trim().toLowerCase()))?<p className="px-3 py-2 text-[11px] text-[#667085]">No matching employees</p>:null}
          </div>
        </div>
      ):null}
    </div>
  );
}

export function DailyReportHeaderPeriod() {
  const {isDaily,pathname,searchParams}=useDailyReportLocation();
  const router=useRouter();
  const ref=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false);
  const [customOpen,setCustomOpen]=useState(false);
  const value=searchParams.get("period");
  const active:Period=OPTIONS.some(o=>o.value===value)?value as Period:"today";
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
          className="daily-report-header-select inline-flex h-9 min-w-[145px] items-center justify-between gap-2 rounded-lg border border-[#cbd7e6] bg-white px-3 text-[11px] font-semibold text-[#233b5d]">
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
          buttonClassName="daily-report-header-select inline-flex h-9 min-w-[190px] items-center justify-between gap-3 rounded-lg border border-[#cbd7e6] bg-white px-3 text-left text-[11px] font-semibold text-[#233b5d]"
          onRangeComplete={(start,end)=>{setCustomOpen(false);setPeriod("custom",start,end);}}
        />
      )}
    </div>
  );
}
