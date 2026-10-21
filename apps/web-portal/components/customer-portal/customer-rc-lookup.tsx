"use client";

import { useState } from "react";
import { Search, LoaderCircle } from "lucide-react";

type Details = {
  registrationNumber?:string; registrationDate?:string|null; manufacturer?:string|null;
  model?:string|null; manufacturingYear?:string|null; vehicleClass?:string|null;
  fuelType?:string|null; engineCapacityCc?:string|null; seatingCapacity?:string|null;
  gvwKg?:string|null; chassisNumber?:string|null; engineNumber?:string|null;
  fitnessExpiryDate?:string|null; pucExpiryDate?:string|null; roadTaxExpiryDate?:string|null;
  nationalPermitExpiryDate?:string|null; localPermitExpiryDate?:string|null;
};

export function CustomerRcLookup() {
  const [reg,setReg]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  async function lookup() {
    const clean=reg.trim().replace(/[^a-zA-Z0-9]/g,"").toUpperCase();
    if(!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4}$/.test(clean)) {setNotice("Enter a complete registration number.");return;}
    setBusy(true);setNotice("");
    try {
      // Customer Portal sessions live in secure cookies. Let the API verify the
      // authenticated customer rather than relying on a second browser session.
      const response=await fetch("/api/customer/rc-lookup",{method:"POST",credentials:"same-origin",redirect:"manual",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({registrationNumber:clean})});
      const contentType=response.headers.get("content-type")||"";
      if(response.status===401||response.status===403||response.type==="opaqueredirect"||response.status>=300&&response.status<400)throw Error("Your session has expired. Please sign in again to fetch RC details.");
      if(!contentType.toLowerCase().includes("application/json"))throw Error("Vehicle details service is temporarily unavailable. Please try again later or enter details manually.");
      let payload: {status?:string;details?:Details;error?:string};
      try { payload=await response.json() as typeof payload; }
      catch { throw Error("Vehicle details service returned an invalid response. Please try again or enter details manually."); }
      if(!response.ok||payload.status!=="success"||!payload.details)throw Error(payload.error||"RC details unavailable. Enter details manually.");
      const root=document.getElementById("customer-add-vehicle-form");
      const d=payload.details;
      const values:Record<string,string|undefined|null>={
        registration:d.registrationNumber||clean, make:d.manufacturer, model:d.model, year:d.manufacturingYear,
        "class":d.vehicleClass, chassis:d.chassisNumber, engine:d.engineNumber, fuel:d.fuelType,
        capacityGvw:d.gvwKg, capacityEngine:d.engineCapacityCc, capacitySeating:d.seatingCapacity,
        registrationDate:d.registrationDate, fitnessDate:d.fitnessExpiryDate, pucDate:d.pucExpiryDate,
        roadTaxDate:d.roadTaxExpiryDate, nationalPermitDate:d.nationalPermitExpiryDate, localPermitDate:d.localPermitExpiryDate,
      };
      for(const [key,value] of Object.entries(values)){
        if(!value||!root)continue;
        const input=Array.from(root.querySelectorAll<HTMLInputElement|HTMLSelectElement>("input,select")).find(el=>el.name===key);
        if(input){input.value=String(value);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));}
      }
      setReg(d.registrationNumber||clean);
      setNotice("");
    }catch(e){setNotice(e instanceof Error?e.message:"Vehicle lookup failed. Enter details manually.");}
    finally{setBusy(false);}
  }
  return <div className="min-w-0 sm:col-span-2">
    <label className="block text-[11px] font-semibold text-[#445670]">Registration number *</label>
    <div className="mt-1 flex gap-2"><input name="registration" value={reg} onChange={e=>setReg(e.target.value.toUpperCase())} required maxLength={15} placeholder="MH19BN4334" className="h-10 min-w-0 flex-1 rounded-lg border border-[#D9E3F0] bg-white px-3 text-[12px] text-[#142746]"/><button type="button" disabled={busy} onClick={()=>void lookup()} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-[#0B3884] px-3 text-[12px] font-semibold text-white disabled:opacity-60">{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Search className="h-4 w-4"/>} Fetch RC</button></div>
    {notice&&<p role="alert" className="mt-1 text-[11px] text-[#A43B49]">{notice}</p>}
  </div>;
}
