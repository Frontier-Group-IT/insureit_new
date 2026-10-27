"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { getInsurerLogo } from "@/lib/insurer-logo";
import { ArrowRight, CalendarDays, CarFront, FileText, Headphones, Landmark, LoaderCircle, Plus, ShieldAlert, ShieldCheck, TriangleAlert, X } from "lucide-react";
import type { CustomerPolicyRow, CustomerVehicleRow } from "@/lib/customer-web-data";
import { prepareCustomerClaim } from "@/app/customer/(protected)/start-claim/actions";

function shortInsurerName(name: string): string {
  return name.trim()
    .replace(/\s+(?:(?:Private|Pvt\.?)\s+)?(?:Limited|Ltd\.?)$/i, "")
    .replace(/\s+(?:(?:General|Life|Health)\s+)?Insurance(?:\s+Company)?$/i, "")
    .trim();
}

function ClaimSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending} className="customer-workflow-choice inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8737F4] via-[#6741F5] to-[#2477F3] px-4 text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(93,72,220,.14)] disabled:cursor-not-allowed disabled:opacity-50">
    {pending ? <><LoaderCircle className="h-4 w-4 animate-spin"/>Preparing claim...</> : <>Continue to Claim <ArrowRight className="h-5 w-5"/></>}
  </button>;
}

type ClaimIdentity = { id: string; vehicle_id: string | null; policy_id: string | null; external_policy_id: string | null; current_status: string };

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
  const [existingClaimDialogOpen, setExistingClaimDialogOpen] = useState(false);
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
  const displayPolicy = policy || vehiclePolicies[0];
  const policyExpired = Boolean(displayPolicy && displayPolicy.end_date < today);
  const formatPolicyDate = (date: string) => { const [year, month, day] = date.split("-"); return year && month && day ? `${day}/${month}/${year}` : date; };
  const existingClaim = existingClaims.find((claim) =>
    !["Settled", "Closed", "Claim Complete", "Rejected"].includes(claim.current_status) &&
    (policy ? (policy.source === "external" ? claim.external_policy_id === policy.id : claim.policy_id === policy.id) : claim.vehicle_id === vehicleId && !claim.policy_id && !claim.external_policy_id),
  );

  const vehicleLabel = (item: CustomerVehicleRow) =>
    item.registration_status === "unregistered" || !item.vehicle_no
      ? `NEW-${item.chassis_no || "PENDING"}`
      : item.vehicle_no;

  return (
    <div data-customer-start-claim-reference="true" className="customer-workflow mx-auto w-full space-y-5 pb-8">
      <section className="relative isolate overflow-hidden rounded-[15px] border border-[#E1E7FB] bg-[#ECF1FF] text-[#0B1643] shadow-[0_5px_22px_rgba(25,46,103,.06)]">
        <div className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/assets/SCLAIM.jpeg")' }} data-banner="sclaim-jpeg" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F0F3FF]/95 via-[#F0F3FF]/68 via-[42%] to-transparent" />
        <div className="relative flex min-h-[180px] flex-col justify-center px-6 py-7 sm:min-h-[210px] sm:px-9 lg:min-h-[245px] lg:px-12">
          <h1 className="text-[clamp(29px,3.6vw,50px)] font-extrabold leading-[1.08] tracking-[-.04em] text-[#0B1748]">Start a <span className="text-[#6034F7]">Claim</span></h1>
          <p className="mt-3 max-w-[480px] text-[12px] font-medium leading-relaxed text-[#65708B] sm:text-[15px]">We&apos;re here to help you, every step of the way.<br/>Get your claim settled quickly and easily.</p>
          <span className="mt-4 h-1 w-14 rounded-full bg-gradient-to-r from-[#7B35F5] to-[#9288FF]" aria-hidden="true" />
        </div>
      </section>

      <section className="rounded-2xl border border-[#EDF0F9] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(30,46,98,.06)] sm:px-6">
        <div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F0EEFF] text-[#6337F6]"><CarFront className="h-5 w-5" aria-hidden="true" /></span><label htmlFor="claim-vehicle" className="text-[16px] font-bold text-[#111E4A]">Select your vehicle</label></div>
        {vehicles.length ? (
          <select
            id="claim-vehicle"
            value={vehicleId}
            onChange={(event) => { setVehicleId(event.target.value); setPolicyDialogOpen(false); setExistingClaimDialogOpen(false); confirmationGrantedRef.current = false; setConfirming(false); }}
            className="h-[46px] w-full rounded-lg border border-[#D6DDFC] bg-white px-4 text-[13px] font-medium text-[#19294D] outline-none transition focus:border-[#7546F5] focus:ring-2 focus:ring-[#F0EBFF]"
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

      <section aria-label="Policy details" data-claim-policy-details="true" className="rounded-2xl border border-[#EDF0F9] bg-white px-4 py-4 shadow-[0_8px_22px_rgba(30,46,98,.06)] sm:px-6">
        <div className="flex items-center gap-3 border-b border-[#E8EAF2] pb-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F0EEFF] p-1.5 text-[#7938F7]">
            {displayPolicy?.insurer_name && getInsurerLogo(displayPolicy.insurer_name) ? (
              <Image src={getInsurerLogo(displayPolicy.insurer_name)!} alt={`${displayPolicy.insurer_name} logo`} width={36} height={36} unoptimized className="h-full w-full object-contain" />
            ) : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          </span>
          <h2 className="text-[16px] font-bold text-[#111E4A]">{displayPolicy?.source === "external" ? "Self Tracked Policy" : "Insurance Policy"}</h2>
        </div>
        {displayPolicy ? (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 pt-4 lg:grid-cols-4 lg:gap-x-0">
              {[
                { label: "Policy No.", value: displayPolicy.policy_no || "—", icon: FileText },
                { label: "Insurer", value: displayPolicy.insurer_name ? shortInsurerName(displayPolicy.insurer_name) : "Insurer not recorded", detail: displayPolicy.policy_product || displayPolicy.policy_type, icon: Landmark },
                { label: "Start Date", value: formatPolicyDate(displayPolicy.start_date), icon: CalendarDays },
                { label: "End Date", value: formatPolicyDate(displayPolicy.end_date), icon: CalendarDays },
              ].map(({ label, value, detail, icon: Icon }, index) => (
                <div key={label} className={`flex min-w-0 gap-2.5 ${index > 0 ? "lg:border-l lg:border-[#E5E8F1] lg:pl-5" : ""}`}>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#8737F4]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-[#7B8191]">{label}</p>
                    <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap" title={detail ? `${value} · ${detail}` : value}>
                      <span className="min-w-0 truncate text-[13px] font-bold leading-5 text-[#1B1D27]">{value}</span>
                      {detail ? <span className="shrink-0 text-[11px] text-[#777E90]">· {detail}</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!hasActivePolicy ? <p className="mt-4 border-t border-[#E8EAF2] pt-3 text-[12px] text-[#AA681C]">{policyExpired ? "Policy expired" : "Policy not currently active"} · Claim registration is still permitted, subject to coverage review.</p> : null}
          </>
        ) : (
          <div className="pt-4">
            <p className="text-[13px] font-semibold text-[#17345D]">No policy found for this vehicle</p>
            <p className="mt-1 text-[11px] text-[#657994]">You may still register a claim. Coverage and eligibility will be reviewed separately.</p>
          </div>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={{ pathname: "/customer/support", query: { account: accountId } }} className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl border border-[#AA9BFF] bg-[#F7F6FF] px-4 text-[14px] font-semibold text-[#6539EF] transition hover:bg-[#F0EDFF]">
          <Headphones className="h-5 w-5" /> Get Assistance
        </Link>
        {existingClaim ? (
          <button type="button" onClick={() => setExistingClaimDialogOpen(true)} className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8737F4] to-[#2477F3] px-4 text-[14px] font-semibold text-white">
            Continue to Claim <ArrowRight className="h-5 w-5"/>
          </button>
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
      {existingClaim && existingClaimDialogOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#071B39]/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setExistingClaimDialogOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="existing-claim-dialog-title" aria-describedby="existing-claim-dialog-description" onKeyDown={(event) => { if (event.key === "Escape") setExistingClaimDialogOpen(false); }} className="w-full max-w-[420px] rounded-[26px] bg-white px-6 py-7 text-center shadow-2xl sm:px-7">
            <span className="mx-auto grid h-[76px] w-[76px] place-items-center rounded-full bg-[#FFF0E8] text-[#DE694B]">
              <TriangleAlert className="h-8 w-8" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <h2 id="existing-claim-dialog-title" className="mt-5 text-[20px] font-extrabold text-[#0D2148]">Claim already in progress</h2>
            <p id="existing-claim-dialog-description" className="mt-3 text-[13px] font-medium leading-5 text-[#667187]">An active claim already exists for this policy.</p>
            <div className="mt-7 grid gap-3">
              <Link autoFocus href={{ pathname: existingClaim.current_status === "Draft" ? "/customer/spot-intimation" : `/customer/claims/${existingClaim.id}`, query: { account: accountId, ...(existingClaim.current_status === "Draft" ? { id: existingClaim.id } : {}) } }} className="inline-flex min-h-[52px] items-center justify-center rounded-2xl bg-[#0B3884] px-4 text-[14px] font-bold text-white hover:bg-[#0A3275] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B3884]">
                View Existing Claim
              </Link>
              <button type="button" onClick={() => setExistingClaimDialogOpen(false)} className="min-h-[52px] rounded-2xl border border-[#AFC4DC] bg-white px-4 text-[14px] font-bold text-[#0B3884] hover:bg-[#F4F8FE]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
