"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Headphones, Plus, ShieldAlert } from "lucide-react";
import type { CustomerPolicyRow, CustomerVehicleRow } from "@/lib/customer-web-data";
import { prepareCustomerClaim } from "@/app/customer/(protected)/start-claim/actions";

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
        <div className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-95" style={{ backgroundImage: 'url("/assets/startclaim.png")' }} data-banner="startclaim-png" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EEF7FF]/35 via-[#EEF7FF]/10 via-52% to-transparent" />
        <div className="relative flex min-h-[105px] items-center sm:min-h-[125px]">
          <h1 className="text-[clamp(28px,3.3vw,42px)] font-bold tracking-tight">Start a Claim</h1>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E1EAF5] bg-white p-4 sm:p-5">
        <label htmlFor="claim-vehicle" className="mb-3 block text-[18px] font-bold text-[#102B54]">Select your vehicle</label>
        {vehicles.length ? (
          <select
            id="claim-vehicle"
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
            className="h-11 w-full rounded-xl border border-[#DDE7F3] bg-white px-3 text-[13px] font-semibold text-[#17345D] outline-none transition focus:border-[#2D7FF0] focus:ring-2 focus:ring-[#DCEBFF]"
          >
            {vehicles.map((item) => (
              <option key={item.id} value={item.id}>
                {vehicleLabel(item)}{item.make || item.model ? ` — ${[item.make, item.model].filter(Boolean).join(" · ")}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-xl border border-dashed border-[#C9D9EB] bg-[#FBFDFF] p-7 text-center text-[13px] text-[#7186A0]">
            No vehicles are linked to this account yet.
          </div>
        )}

        {vehicle && !hasActivePolicy ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F2D7DA] bg-[#FFF7F8] px-3 py-2.5">
            <span className="flex items-center gap-2 text-[12px] font-medium text-[#A43B49]">
              <ShieldAlert className="h-4 w-4" />
              No active policy found. You can still register a claim; coverage will be reviewed separately.
            </span>
            <Link href={{ pathname: "/customer/add-policy", query: { account: accountId, vehicle: vehicleId } }} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1769DC]">
              <Plus className="h-4 w-4" /> Add policy
            </Link>
          </div>
        ) : null}
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
            <button type="submit" disabled={!vehicle} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B3884] px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              Continue to Claim <ArrowRight className="h-5 w-5"/>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
