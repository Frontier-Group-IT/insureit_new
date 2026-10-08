"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CarFront, CheckCircle2, ChevronDown, Plus, Search, Users } from "lucide-react";
import type { CustomerPolicyRow, CustomerVehicleRow } from "@/lib/customer-web-data";
import { prepareCustomerClaim } from "@/app/customer/(protected)/start-claim/actions";
import { CustomerClaimLogo } from "@/components/customer-portal/customer-claim-logo";

type ClaimIdentity = { id: string; policy_id: string | null; external_policy_id: string | null; current_status: string };

export function CustomerStartClaimSelector({
  accountId, vehicles, policies, existingClaims, initialVehicleId,
}: {
  accountId: string;
  vehicles: CustomerVehicleRow[];
  policies: CustomerPolicyRow[];
  existingClaims: ClaimIdentity[];
  initialVehicleId?: string;
}) {
  const [vehicleId, setVehicleId] = useState(initialVehicleId && vehicles.some((v) => v.id === initialVehicleId) ? initialVehicleId : vehicles[0]?.id || "");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const vehiclePolicies = useMemo(() => policies.filter((p) => p.vehicle_id === vehicleId).sort((a, b) => b.end_date.localeCompare(a.end_date)), [policies, vehicleId]);
  const today = new Date().toISOString().slice(0, 10);
  const policy = vehiclePolicies.find((p) => p.start_date <= today && p.end_date >= today) ?? vehiclePolicies[0];
  const existingClaim = policy ? existingClaims.find((c) => (policy.source === "external" ? c.external_policy_id === policy.id : c.policy_id === policy.id) && !["Settled", "Closed", "Claim Complete", "Rejected"].includes(c.current_status)) : undefined;
  const filtered = vehicles.filter((v) => [v.vehicle_no, v.make, v.model, v.chassis_no].some((s) => (s || "").toLowerCase().includes(query.toLowerCase()))).slice(0, 30);
  const vehicleLabel = (v: CustomerVehicleRow) => v.registration_status === "unregistered" || !v.vehicle_no ? `NEW-${v.chassis_no || "PENDING"}` : v.vehicle_no;
  const eligibility = policy ? (policy.start_date <= today && policy.end_date >= today ? "Active cover" : "Policy outside coverage dates") : "No policy linked";

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-[#DAE7F5] bg-gradient-to-r from-[#F4FAFF] to-[#E8F3FF] p-5 sm:p-8">
        <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto]">
          <div><p className="text-[11px] font-extrabold uppercase tracking-widest text-[#1959B1]">Start a claim</p>
            <h1 className="mt-1 text-2xl font-black text-[#10274B] sm:text-3xl">Select the vehicle</h1>
            <p className="mt-2 max-w-md text-xs leading-5 text-[#697A93]">Choose the vehicle involved and we’ll use its linked insurance policy.</p>
          </div>
          <img src="/assets/customer-claim/start-claim-hero.webp" alt="Vehicle, shield and claim checklist" className="mx-auto w-full max-w-[300px] object-contain" />
        </div>
      </section>

      <section className="space-y-3">
        <label htmlFor="claim-vehicle-search" className="block text-sm font-black text-[#142D52]">Vehicle number *</label>
        <div className="relative">
          <button type="button" aria-expanded={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)} className="flex min-h-[76px] w-full items-center gap-3 rounded-2xl border border-[#AEC8E7] bg-white p-3 text-left shadow-sm">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EDF5FF] text-[#174EA6]"><CustomerClaimLogo value={vehicle?.make} size={44}/></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-[#142746]">{vehicle ? vehicleLabel(vehicle) : "Select a vehicle"}</span><span className="block truncate text-[11px] text-[#74849C]">{vehicle ? [vehicle.make, vehicle.model].filter(Boolean).join(" · ") : "Choose from your linked vehicles"}</span></span>
            <ChevronDown className="h-5 w-5 shrink-0 text-[#244F87]"/>
          </button>
          {pickerOpen && (
            <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-[#C7D8ED] bg-white shadow-xl">
              <div className="flex items-center gap-2 border-b p-3"><Search className="h-4 w-4 text-[#7586A1]"/><input id="claim-vehicle-search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vehicle number, make or chassis" className="w-full text-sm outline-none"/></div>
              <div className="max-h-64 overflow-y-auto">
                {filtered.map((v) => <button type="button" key={v.id} onClick={() => { setVehicleId(v.id); setPickerOpen(false); setQuery(""); }} className="flex w-full items-center gap-3 border-b px-4 py-3 text-left hover:bg-[#F0F6FD]"><CarFront className="h-5 w-5 text-[#215CB4]"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{vehicleLabel(v)}</span><span className="block truncate text-xs text-[#74849C]">{[v.make,v.model].filter(Boolean).join(" · ")}</span></span>{v.id === vehicleId && <CheckCircle2 className="h-4 w-4 text-emerald-600"/>}</button>)}
                {!filtered.length && <p className="p-4 text-sm text-[#75849B]">No matching vehicles.</p>}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2"><p className="text-[11px] text-[#75839A]">Choose a linked vehicle to display its insurance details.</p><Link href={{ pathname: "/customer/add-vehicle", query: { account: accountId } }} className="inline-flex items-center gap-1 text-xs font-bold text-[#174EA6]"><Plus className="h-4 w-4"/> Add vehicle</Link></div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-black text-[#132B4F]">Policy details</h2><Link href={{ pathname:"/customer/add-policy", query: { account:accountId, vehicle: vehicleId } }} className="inline-flex items-center gap-1 rounded-xl border border-[#CEDFF3] bg-white px-3 py-2 text-xs font-bold text-[#174EA6]"><Plus className="h-4 w-4"/> Add policy</Link></div>
        {policy ? <div className="rounded-3xl bg-[#0B3884] p-5 text-white shadow-lg">
          <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-extrabold uppercase tracking-widest text-white/75">{policy.source === "external" ? "Self-tracked claim" : "INSUREIT-managed claim"}</span><span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold">{eligibility}</span></div>
          <div className="mt-4 flex items-center gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-[#164EA0]"><CustomerClaimLogo value={policy.insurer_name} kind="insurer" size={46}/></span><div className="min-w-0"><p className="truncate text-lg font-black tracking-wide">{policy.source === "external" ? policy.policy_no.replace(/(.)(.)/g, "$1•") : policy.policy_no}</p><p className="mt-1 text-xs text-white/80">{policy.insurer_name || "Insurance company"} · {policy.policy_type}</p><p className="mt-1 text-[11px] text-white/75">{policy.start_date} – {policy.end_date}</p></div></div>
        </div> : <div className="rounded-2xl border border-dashed border-[#C9D9EB] bg-white p-8 text-center text-sm text-[#74839A]">No insurance policy is linked to this vehicle.</div>}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={{ pathname:"/customer/support", query: { account:accountId } }} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#B6CAE3] bg-white px-4 text-sm font-black text-[#2057A0]"><Users className="h-5 w-5"/> Get Assistance</Link>
        {existingClaim ? <Link href={{ pathname:`/customer/claims/${existingClaim.id}`, query:{account:accountId} }} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#0B3884] px-4 text-sm font-black text-white">Continue existing claim <ArrowRight className="h-5 w-5"/></Link>
        : <form action={prepareCustomerClaim} className="flex"><input type="hidden" name="account" value={accountId}/><input type="hidden" name="vehicle" value={vehicleId}/><input type="hidden" name="policy" value={policy?.id || ""}/><button type="submit" disabled={!policy || !vehicle} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0B3884] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Start Claim <ArrowRight className="h-5 w-5"/></button></form>}
      </div>
      <img src="/assets/customer-claim/start-claim-footer-scene.webp" alt="" className="mx-auto w-full max-w-[600px] object-contain" /><p className="text-center text-xs text-[#72819A]">Starting a claim prepares an account-scoped draft. Complete Spot Intimation before submitting incident details.</p>
    </div>
  );
}
