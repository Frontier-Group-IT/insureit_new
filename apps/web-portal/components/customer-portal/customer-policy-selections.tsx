"use client";

import { useMemo, useState } from "react";
import type { CustomerVehicleRow } from "@/lib/customer-web-data";

export function CustomerPolicySelections({
  vehicles, blocked, initial,
}:{
  vehicles:CustomerVehicleRow[]; blocked:string[]; initial?:string;
}) {
  const [selected,setSelected]=useState(initial && vehicles.some(v=>v.id===initial) ? initial : "");
  const vehicle=useMemo(()=>vehicles.find(v=>v.id===selected),[vehicles,selected]);
  const products=(vehicle?.vehicle_type==="PCP"||vehicle?.vehicle_type==="TWP")
    ? ["Package","Third Party","SAOD","Bundled","Long Term Package","Long Term Third Party"]
    : ["Package","Third Party","SAOD"];
  return <>
    <label className="text-sm font-bold sm:col-span-2">Vehicle *
      <select name="vehicle" value={selected} onChange={e=>setSelected(e.target.value)} required className="mt-2 block w-full rounded-xl border p-3 text-sm">
        <option value="">Select a vehicle</option>
        {vehicles.map(v=><option key={v.id} value={v.id} disabled={blocked.includes(v.id)}>{v.vehicle_no} · {[v.make,v.model].filter(Boolean).join(" ")}{blocked.includes(v.id)?" · Active policy exists":""}</option>)}
      </select>
    </label>
    <label className="text-sm font-bold">Policy product *
      <select key={vehicle?.vehicle_type||""} required name="type" defaultValue="" className="mt-2 block w-full rounded-xl border p-3 text-sm">
        <option value="">Select product</option>{products.map(v=><option key={v}>{v}</option>)}
      </select>
    </label>
  </>;
}
