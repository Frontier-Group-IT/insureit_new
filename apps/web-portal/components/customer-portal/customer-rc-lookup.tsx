"use client";

import { useState } from "react";
import { Search, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";

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
      const {data:{session}}=await createClient().auth.getSession();
      if(!session?.access_token)throw Error("Sign in again to fetch vehicle details.");
      const response=await fetch("/api/customer/rc-lookup",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({registrationNumber:clean})});
      const payload=await response.json() as {status?:string;details?:Details;error?:string};
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
      setNotice("RC details fetched. Check all fields before saving.");
    }catch(e){setNotice(e instanceof Error?e.message:"Vehicle lookup failed. Enter details manually.");}
    finally{setBusy(false);}
  }
  return <div className="sm:col-span-2 rounded-2xl border border-[#C3D9F3] bg-[#F1F7FF] p-4">
    <label className="block text-sm font-bold">Registration number *</label>
    <div className="mt-2 flex gap-2"><input name="registration" value={reg} onChange={e=>setReg(e.target.value.toUpperCase())} required maxLength={15} placeholder="MH19BN4334" className="min-w-0 flex-1 rounded-xl border bg-white p-3 text-sm"/><button type="button" disabled={busy} onClick={()=>void lookup()} className="inline-flex items-center gap-1 rounded-xl bg-[#0B3884] px-4 text-sm font-bold text-white disabled:opacity-60">{busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Search className="h-4 w-4"/>} Fetch RC</button></div>
    {notice&&<p role="status" className="mt-2 text-xs text-[#415D81]">{notice}</p>}
  </div>;
}
