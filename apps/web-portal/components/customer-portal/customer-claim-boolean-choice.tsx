"use client";

import { useState } from "react";

export function CustomerClaimBooleanChoice({name,value:initial,kind}:{name:string;value:string;kind:"boolean"|"yesno"}){
  const [value,setValue]=useState(initial);
  const options=kind==="yesno"?[["yes","Yes"],["no","Not Yet"]]:[["true","Yes"],["false","No"]];
  return <div role="group" aria-label={name.replace(/_/g," ")} className="mt-1 grid grid-cols-2 gap-2">
    <input type="hidden" name={name} value={value}/>
    {options.map(([key,label])=><button type="button" key={key} aria-pressed={value===key} onClick={()=>setValue(key)} className={`h-9 rounded-md border text-[12px] font-medium normal-case tracking-normal transition ${value===key?"border-[#2059BC] bg-[#EDF4FF] text-[#153B79]":"border-[#D9E3F0] bg-white text-[#193451] hover:bg-[#F5F9FF]"}`}>{label}</button>)}
  </div>;
}
