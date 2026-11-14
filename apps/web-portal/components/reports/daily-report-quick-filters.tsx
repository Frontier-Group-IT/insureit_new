"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const inputClass = "h-9 w-full rounded-lg border border-[#d9e0e8] bg-white px-3 text-[11px] font-medium text-[#344054] outline-none focus:border-[#5275AA] focus:ring-2 focus:ring-[#e9f0f7]";

type Props = {
  mode: "self" | "directory" | "employee";
  date: string;
  employeeSearch: string;
};

export function DailyReportQuickFilters({mode,date,employeeSearch}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search,setSearch] = useState(employeeSearch);
  const didEditSearch = useRef(false);

  // Employee directory search updates automatically without a submit button.
  useEffect(() => {
    setSearch(employeeSearch);
    didEditSearch.current = false;
  }, [employeeSearch]);

  useEffect(() => {
    if (mode !== "directory" || !didEditSearch.current) return;
    const timeout = window.setTimeout(() => {
      if (search.trim() === (searchParams.get("employee") || "").trim()) return;
      const params = new URLSearchParams(searchParams.toString());
      if (search.trim()) params.set("employee",search.trim());
      else params.delete("employee");
      params.set("page","1");
      router.replace(`${pathname}?${params.toString()}`,{scroll:false});
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [mode,search,searchParams,pathname,router]);

  if (mode === "directory") {
    return (
      <label className="block w-full">
        <span className="sr-only">Employee Search</span>
        <input type="search" value={search} onChange={e=>{didEditSearch.current=true;setSearch(e.target.value)}}
          maxLength={80} placeholder="Employee name or code" className={inputClass}/>
      </label>
    );
  }

  function chooseDate(nextDate:string) {
    const params=new URLSearchParams(searchParams.toString());
    if(nextDate) {
      params.set("date",nextDate);
      params.set("period","day");
    } else {
      params.delete("date");
      params.set("period","all");
    }
    params.set("page","1");
    router.replace(`${pathname}?${params.toString()}`,{scroll:false});
  }

  return (
    <label className="block w-full max-w-[220px] space-y-1">
      <span className="block text-[9px] font-bold uppercase tracking-wide text-[#60718A]">Date</span>
      <input type="date" value={date} onChange={e=>chooseDate(e.target.value)} className={inputClass}
        aria-label="Filter activity history by date; clear for all history"/>
    </label>
  );
}
