"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerVehicleRow } from "@/lib/customer-web-data";

export function CustomerPolicySelections({
  vehicles, blocked, initial, accountId,
}:{
  vehicles:CustomerVehicleRow[]; blocked:string[]; initial?:string; accountId:string;
}) {
  const [selected,setSelected]=useState(initial && vehicles.some(v=>v.id===initial && !blocked.includes(v.id)) ? initial : "");
  const vehicle=useMemo(()=>vehicles.find(v=>v.id===selected),[vehicles,selected]);
  const products=(vehicle?.vehicle_type==="PCP"||vehicle?.vehicle_type==="TWP")
    ? ["Package","Third Party","SAOD","Bundled","Long Term Package","Long Term Third Party"]
    : ["Package","Third Party","SAOD"];
  return <>
    <div className="sm:col-span-2 flex items-center justify-between gap-2"><span className="text-xs font-bold text-[#1B3150]">Choose a vehicle already linked to your account</span><Link href={{pathname:"/customer/add-vehicle",query:{account:accountId}}} className="text-xs font-bold text-[#1769DC] hover:underline">+ Add Vehicle</Link></div>
    <label className="text-sm font-bold sm:col-span-2">Vehicle *
      <select name="vehicle" value={selected} onChange={e=>setSelected(e.target.value)} required className="mt-2 block w-full rounded-xl border p-3 text-sm">
        <option value="">Select a vehicle</option>
        {vehicles.map(v=><option key={v.id} value={v.id} disabled={blocked.includes(v.id)}>{v.vehicle_no} · {[v.make,v.model].filter(Boolean).join(" ")}{blocked.includes(v.id)?" · Active policy exists":""}</option>)}
      </select>
    </label>
    {vehicles.length > 0 && blocked.length === vehicles.length ? <p role="status" className="sm:col-span-2 rounded-lg border border-[#F2D7DA] bg-[#FFF7F8] p-3 text-xs text-[#A43B49]">Every linked vehicle already has an active policy. You cannot add a duplicate active policy.</p> : null}
    <label className="text-sm font-bold">Policy product *
      <select key={vehicle?.vehicle_type||""} required name="type" defaultValue="" className="mt-2 block w-full rounded-xl border p-3 text-sm">
        <option value="">Select product</option>{products.map(v=><option key={v}>{v}</option>)}
      </select>
    </label>
  </>;
}
