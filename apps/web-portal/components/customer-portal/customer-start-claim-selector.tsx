"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowRight, Headphones, LoaderCircle, Plus, ShieldAlert, X } from "lucide-react";
import type { CustomerPolicyRow, CustomerVehicleRow } from "@/lib/customer-web-data";
import { prepareCustomerClaim } from "@/app/customer/(protected)/start-claim/actions";

function ClaimSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0B3884] px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
    {pending ? <><LoaderCircle className="h-4 w-4 animate-spin"/>Preparing claim...</> : <>Continue to Claim <ArrowRight className="h-5 w-5"/></>}
  </button>;
}

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

  const [claimState, claimAction] = useActionState(prepareCustomerClaim, { error: null });
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const claimFormRef = useRef<HTMLFormElement>(null);
  const confirmationGrantedRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const vehicle = vehicles.find((item) => item.id === vehicleId);
  const vehiclePolicies = useMemo(
    () => policies.filter((policy) => policy.vehicle_id === vehicleId).sort((a, b) => b.end_date.localeCompare(a.end_date)),
    [policies, vehicleId],
  );
  const today = new Date().toISOString().slice(0, 10);
  const policy = vehiclePolicies.find((item) => item.start_date <= today && item.end_date >= today);
  const hasActivePolicy = Boolean(policy);
  const existingClaim = existingClaims.find((claim) =>
    !["Settled", "Closed", "Claim Complete", "Rejected"].includes(claim.current_status) &&
    (policy ? (policy.source === "external" ? claim.external_policy_id === policy.id : claim.policy_id === policy.id) : false),
  );

  const vehicleLabel = (item: CustomerVehicleRow) =>
    item.registration_status === "unregistered" || !item.vehicle_no
      ? `NEW-${item.chassis_no || "PENDING"}`
      : item.vehicle_no;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3">
      <section className="relative isolate overflow-hidden rounded-2xl border border-[#D6E7FA] bg-[#EAF4FF] px-5 py-6 text-[#102B54] shadow-[0_6px_24px_rgba(20,58,100,.05)] sm:px-7 sm:py-8">
        <div className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-95" style={{ backgroundImage: 'url("/assets/startclaim.png")' }} data-banner="startclaim-png" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EEF7FF]/35 via-[#EEF7FF]/10 via-52% to-transparent" />
        <div className="relative flex min-h-[105px] items-center sm:min-h-[125px]">
          <h1 className="text-[clamp(28px,3.3vw,42px)] font-bold tracking-tight">Start a Claim</h1>
        </div>
      </section>

      <section className="rounded-2xl border border-[#E1EAF5] bg-white p-4 shadow-[0_6px_24px_rgba(20,58,100,.04)] sm:p-5">
        <div className="mb-3"><label htmlFor="claim-vehicle" className="text-[16px] font-bold text-[#102B54]">Select your vehicle</label></div>
        {vehicles.length ? (
          <select
            id="claim-vehicle"
            value={vehicleId}
            onChange={(event) => { setVehicleId(event.target.value); setPolicyDialogOpen(false); confirmationGrantedRef.current = false; setConfirming(false); }}
            className="h-10 w-full rounded-lg border border-[#DDE7F3] bg-white px-3 text-[13px] font-semibold text-[#17345D] outline-none transition focus:border-[#2D7FF0] focus:ring-2 focus:ring-[#DCEBFF]"
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

      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={{ pathname: "/customer/support", query: { account: accountId } }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#B9CCE4] bg-white px-4 text-[13px] font-semibold text-[#2057A0]">
          <Headphones className="h-5 w-5" /> Get Assistance
        </Link>
        {existingClaim ? (
          <Link href={{ pathname: `/customer/claims/${existingClaim.id}`, query: { account: accountId } }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0B3884] px-4 text-[13px] font-semibold text-white">
            Continue existing claim <ArrowRight className="h-5 w-5"/>
          </Link>
        ) : (
          <form ref={claimFormRef} action={claimAction} className="flex" onSubmit={(event) => { if (!hasActivePolicy && !confirmationGrantedRef.current) { event.preventDefault(); setPolicyDialogOpen(true); } }}>
            <input type="hidden" name="account" value={accountId}/>
            <input type="hidden" name="vehicle" value={vehicleId}/>
            <input type="hidden" name="policy" value={policy?.id || ""}/>
            <ClaimSubmitButton disabled={!vehicle}/>
          </form>
        )}
      </div>
      {claimState.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-800">{claimState.error}</p>}
      {policyDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071B39]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPolicyDialogOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="claim-policy-dialog-title" aria-describedby="claim-policy-dialog-description" onKeyDown={(event) => { if (event.key === "Escape") setPolicyDialogOpen(false); }} className="w-full max-w-[420px] rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#FFF4E4] text-[#B77917]"><ShieldAlert className="h-6 w-6" /></span>
              <button type="button" autoFocus onClick={() => setPolicyDialogOpen(false)} aria-label="Close confirmation" className="rounded-lg p-1.5 text-[#60738E] hover:bg-[#F2F6FB]"><X className="h-5 w-5"/></button>
            </div>
            <h2 id="claim-policy-dialog-title" className="mt-4 text-[18px] font-bold text-[#102B54]">No Active Policy Found</h2>
            <p id="claim-policy-dialog-description" className="mt-2 text-[13px] leading-5 text-[#5A6D86]">This vehicle has no active insurance policy. You can still register a claim, but coverage and eligibility will be reviewed separately.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={confirming} onClick={() => { if (confirming) return; confirmationGrantedRef.current = true; setConfirming(true); setPolicyDialogOpen(false); claimFormRef.current?.requestSubmit(); }} className="min-h-11 rounded-lg border border-[#B7CEE8] bg-white px-3 text-[12px] font-bold text-[#174A87] hover:bg-[#F4F9FE] disabled:opacity-60">{confirming ? "Preparing claim..." : "Continue"}</button>
              <Link href={{ pathname: "/customer/add-policy", query: { account: accountId, vehicle: vehicleId } }} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-[#0B3884] px-3 text-[12px] font-bold text-white"><Plus className="h-4 w-4"/>Add Policy</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
