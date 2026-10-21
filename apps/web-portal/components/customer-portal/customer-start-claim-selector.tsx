"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Headphones, ImageIcon, MapPin, Plus, Radio, ShieldAlert } from "lucide-react";
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
  const [vehicleId, setVehicleId] = useState(
    initialVehicleId && vehicles.some((vehicle) => vehicle.id === initialVehicleId)
      ? initialVehicleId
      : vehicles[0]?.id || "",
  );

  const vehicle = vehicles.find((item) => item.id === vehicleId);
  const vehiclePolicies = useMemo(
    () => policies.filter((policy) => policy.vehicle_id === vehicleId).sort((a, b) => b.end_date.localeCompare(a.end_date)),
    [policies, vehicleId],
  );
  const today = new Date().toISOString().slice(0, 10);
  const policy = vehiclePolicies.find((item) => item.start_date <= today && item.end_date >= today) ?? vehiclePolicies[0];
  const hasActivePolicy = Boolean(policy && policy.start_date <= today && policy.end_date >= today);
  const existingClaim = policy
    ? existingClaims.find((claim) =>
        (policy.source === "external" ? claim.external_policy_id === policy.id : claim.policy_id === policy.id) &&
        !["Settled", "Closed", "Claim Complete", "Rejected"].includes(claim.current_status),
      )
    : undefined;

  const vehicleLabel = (item: CustomerVehicleRow) =>
    item.registration_status === "unregistered" || !item.vehicle_no
      ? `NEW-${item.chassis_no || "PENDING"}`
      : item.vehicle_no;

  return (
    <div className="space-y-4">
      <section className="relative isolate overflow-hidden rounded-2xl border border-[#D6E7FA] bg-[#EAF4FF] px-5 py-6 text-[#102B54] shadow-[0_6px_24px_rgba(20,58,100,.05)] sm:px-7 sm:py-8">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[45%] bg-cover bg-center bg-no-repeat opacity-95" style={{ backgroundImage: 'url("/assets/customer-claim/start-claim-protection-banner.webp"), url("/assets/customer-claim/start-claim-hero.webp")' }} data-banner="start-claim-generated" data-legacy-fallback="true" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EEF7FF] via-[#EEF7FF]/96 via-52% to-transparent" />
        <div className="relative flex min-h-[105px] items-center sm:min-h-[125px]">
          <h1 className="text-[clamp(28px,3.3vw,42px)] font-bold tracking-tight">Start a Claim</h1>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E1EAF5] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#102B54]">Select your vehicle</h2>
            <p className="mt-1 text-[13px] text-[#7186A0]">Choose the vehicle involved in the incident to proceed with your claim.</p>
          </div>
        </div>

        {vehicles.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {vehicles.map((item) => {
              const selected = item.id === vehicleId;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setVehicleId(item.id)}
                  className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-[#2D7FF0] bg-[#F2F8FF] shadow-[0_0_0_1px_rgba(45,127,240,.08)]" : "border-[#DDE7F3] bg-white hover:border-[#BBD2EF] hover:bg-[#FBFDFF]"}`}
                  aria-pressed={selected}
                >
                  <span className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-[#F3F7FC]">
                    <CustomerClaimLogo value={item.make} size={54} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[14px] text-[#17345D]">{vehicleLabel(item)}</strong>
                    <span className="mt-1 block truncate text-[12px] text-[#6F83A0]">{[item.make, item.model].filter(Boolean).join(" · ") || "Vehicle details unavailable"}</span>
                  </span>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-[#1769DC]" : "border-[#AEBFD5]"}`}>
                    {selected ? <span className="h-2.5 w-2.5 rounded-full bg-[#1769DC]" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#C9D9EB] bg-[#FBFDFF] p-7 text-center text-[13px] text-[#7186A0]">
            No vehicles are linked to this account yet.
          </div>
        )}

        {vehicle && !hasActivePolicy ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F2D7DA] bg-[#FFF7F8] px-3 py-2.5">
            <span className="flex items-center gap-2 text-[12px] font-medium text-[#A43B49]">
              <ShieldAlert className="h-4 w-4" />
              No active policy found for the selected vehicle.
            </span>
            <Link href={{ pathname: "/customer/add-policy", query: { account: accountId, vehicle: vehicleId } }} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1769DC]">
              <Plus className="h-4 w-4" /> Add policy
            </Link>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[#DDEBFA] bg-[#EAF4FF] p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-[18px] font-bold text-[#102B54]">What happens next?</h2>
          <p className="mt-1 text-[13px] text-[#7186A0]">A simple and guided process to get your claim started.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {[
            {step:"1",title:"Provide incident details",description:"Tell us what happened, including date, time and location.",icon:FileText},
            {step:"2",title:"Upload documents & photos",description:"Share relevant documents and photos of the incident.",icon:ImageIcon},
            {step:"3",title:"Track your claim",description:"Follow the status of your claim as it progresses.",icon:MapPin},
          ].map(({step,title,description,icon:Icon},index)=><div key={title} className="relative flex items-start gap-3 rounded-xl bg-white/70 p-3">
            <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#1769DC] shadow-sm">
              <Icon className="h-5 w-5"/>
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#DDEBFF] text-[10px] font-bold text-[#1769DC]">{step}</span>
            </span>
            <span className="min-w-0 flex-1"><strong className="block text-[13px] text-[#17345D]">{title}</strong><span className="mt-1 block text-[12px] leading-relaxed text-[#6F83A0]">{description}</span></span>
            {index<2?<ArrowRight className="mt-3 hidden h-4 w-4 text-[#6784AA] lg:block"/>:null}
          </div>)}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={{ pathname: "/customer/support", query: { account: accountId } }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#B9CCE4] bg-white px-4 text-[13px] font-semibold text-[#2057A0]">
          <Headphones className="h-5 w-5" /> Get Assistance
        </Link>
        {existingClaim ? (
          <Link href={{ pathname: `/customer/claims/${existingClaim.id}`, query: { account: accountId } }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0B3884] px-4 text-[13px] font-semibold text-white">
            Continue existing claim <ArrowRight className="h-5 w-5"/>
          </Link>
        ) : (
          <form action={prepareCustomerClaim} className="flex">
            <input type="hidden" name="account" value={accountId}/>
            <input type="hidden" name="vehicle" value={vehicleId}/>
            <input type="hidden" name="policy" value={policy?.id || ""}/>
            <button type="submit" disabled={!policy || !vehicle || !hasActivePolicy} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B3884] px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              Continue to Claim <ArrowRight className="h-5 w-5"/>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
