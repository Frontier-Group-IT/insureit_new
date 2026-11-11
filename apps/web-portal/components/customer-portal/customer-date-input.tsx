"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { formatIndianDate } from "@/lib/indian-date";

/** Show DD/MM/YYYY on screen while submitting an unchanged native ISO date value. */
export function CustomerDateInput({name,defaultValue,required,label,className="",compact=false}:{
  name:string;defaultValue?:string;required?:boolean;label:string;className?:string;compact?:boolean;
}) {
  const [value,setValue]=useState(defaultValue??"");
  const inputRef=useRef<HTMLInputElement>(null);
  // Restoring a draft must synchronize React state with the native date input.
  useEffect(()=>{
    const input=inputRef.current;
    if(!input)return;
    const restore=(event:Event)=>{
      if(event instanceof CustomEvent && typeof event.detail==="string")setValue(event.detail);
    };
    input.addEventListener("customer-spot-draft-restore",restore);
    return ()=>input.removeEventListener("customer-spot-draft-restore",restore);
  },[]);
  return <span className={`relative flex h-full min-w-0 flex-1 items-center rounded-md bg-white ${compact ? "min-h-0 px-1.5" : "min-h-10 px-3"} ${className}`}>
    <span aria-hidden="true" className="min-w-0 flex-1 truncate">{value?formatIndianDate(value):"DD/MM/YYYY"}</span>
    <CalendarDays aria-hidden="true" className="pointer-events-none h-4 w-4 shrink-0 text-[#526178]"/>
    <input ref={inputRef} name={name} aria-label={label} type="date" value={value} required={required}
      onChange={(event)=>setValue(event.currentTarget.value)}
      onClick={(event)=>event.currentTarget.showPicker?.()}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2D7FF0]"/>
  </span>;
}
