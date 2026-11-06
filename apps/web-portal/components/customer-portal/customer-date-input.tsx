"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { formatIndianDate } from "@/lib/indian-date";

/** Show DD/MM/YYYY on screen while submitting an unchanged native ISO date value. */
export function CustomerDateInput({name,defaultValue,required,label,className=""}:{
  name:string;defaultValue?:string;required?:boolean;label:string;className?:string;
}) {
  const [value,setValue]=useState(defaultValue??"");
  return <span className={`relative flex h-full min-h-10 min-w-0 flex-1 items-center rounded-md bg-white px-3 ${className}`}>
    <span aria-hidden="true" className="min-w-0 flex-1 truncate">{value?formatIndianDate(value):"DD/MM/YYYY"}</span>
    <CalendarDays aria-hidden="true" className="pointer-events-none h-4 w-4 shrink-0 text-[#526178]"/>
    <input name={name} aria-label={label} type="date" value={value} required={required}
      onChange={(event)=>setValue(event.currentTarget.value)}
      onClick={(event)=>event.currentTarget.showPicker?.()}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2D7FF0]"/>
  </span>;
}
