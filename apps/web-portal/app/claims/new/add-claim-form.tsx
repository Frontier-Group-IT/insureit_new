"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import {
  createOperationsClaim,
  lookupClaimVehicle,
  type AddClaimLookup,
} from "./add-claim-actions";

const headerIcons = {
  customer: "/assets/Custom-Icons/optimized-128/customers.png",
  vehicle: "/assets/Custom-Icons/optimized-128/fleet-vehicle.png",
  makeModel: "/assets/Custom-Icons/optimized-128/fleet-vehicle.png",
  insurer: "/assets/Custom-Icons/optimized-128/policy.png",
  lossDate: "/assets/Custom-Icons/optimized-128/claims-intimated-today.png",
  policy: "/assets/Custom-Icons/optimized-128/policy.png",
  control: "/assets/Custom-Icons/optimized-128/tasks-work-queue.png",
  claim: "/assets/Custom-Icons/optimized-128/claims.png",
  status: "/assets/Custom-Icons/optimized-128/claim-approval.png",
  intimation: "/assets/Custom-Icons/optimized-128/claim-intimation.png",
} as const;

export function AddClaimForm() {
  const router = useRouter();
  const requestId = useRef(0);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [lookup, setLookup] = useState<AddClaimLookup | null>(null);
  const [lookupMessage, setLookupMessage] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [existingClaim, setExistingClaim] = useState<{ id: string; claimNo: string } | null>(null);

  useEffect(() => {
    const normalized = normalizeVehicleNumber(vehicleNumber);
    const nextRequestId = ++requestId.current;
    setSaveMessage("");
    setExistingClaim(null);

    if (normalized.length < 4) {
      setLookup(null);
      setLookupMessage("");
      setLoadingLookup(false);
      return;
    }

    setLoadingLookup(true);
    const timer = window.setTimeout(() => {
      void lookupClaimVehicle(vehicleNumber)
        .then((result) => {
          if (requestId.current !== nextRequestId) return;
          if (result.ok) {
            setLookup(result.data);
            setLookupMessage("");
          } else {
            setLookup(null);
            setLookupMessage(result.message);
          }
        })
        .catch(() => {
          if (requestId.current !== nextRequestId) return;
          setLookup(null);
          setLookupMessage("Vehicle details could not be loaded. Please try again.");
        })
        .finally(() => {
          if (requestId.current === nextRequestId) setLoadingLookup(false);
        });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [vehicleNumber]);

  async function saveClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lookup?.vehicle.id || saving) return;

    setSaving(true);
    setSaveMessage("");
    setExistingClaim(null);
    try {
      const result = await createOperationsClaim(lookup.vehicle.id);
      if (!result.ok) {
        setSaveMessage(result.message);
        setExistingClaim(result.existingClaim ?? null);
        return;
      }
      router.push("/claims");
    } catch {
      setSaveMessage("The claim could not be created. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveClaim} className="mx-auto max-w-[1440px] space-y-3 pb-5">
      <section className="rounded-xl border border-[#D8E3F2] bg-white px-4 py-4 shadow-[0_8px_22px_rgba(7,29,73,0.045)]">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[280px] flex-1">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#526178]">Vehicle Number</span>
            <div className="relative">
              <input
                autoFocus
                value={vehicleNumber}
                onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())}
                placeholder="Enter vehicle number"
                autoComplete="off"
                aria-label="Vehicle Number"
                className="h-11 w-full rounded-lg border border-[#CCD6E4] bg-white px-3.5 pr-28 text-[13px] font-semibold uppercase tracking-[0.02em] text-[#071D49] outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-[#8794A6] focus:border-[#174EA6] focus:ring-4 focus:ring-blue-100"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] font-semibold text-[#6B7A90]">
                {loadingLookup ? "Fetching..." : lookup ? "Details found" : ""}
              </span>
            </div>
          </label>
        </div>
        <p className="mt-2 text-[11px] text-[#66758A]">Customer and active policy details are fetched automatically from the existing vehicle record.</p>
        {lookupMessage ? <p role="alert" className="mt-2 text-[12px] font-medium text-[#B42318]">{lookupMessage}</p> : null}
      </section>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[12px] font-semibold text-[#071D49]">Customer Details &amp; Active Policy Details</p>
            <p className="text-[10px] text-[#68758A]">Unavailable values remain blank.</p>
          </div>
          {lookup?.policy ? <span className="rounded-full bg-[#E9F7EF] px-2.5 py-1 text-[10px] font-semibold text-[#16764B]">Active policy found</span> : null}
        </div>
        <ClaimReferenceStrip data={lookup} />
      </div>

      {saveMessage ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F2C8C5] bg-[#FFF7F6] px-3.5 py-2.5 text-[12px] font-medium text-[#B42318]">
          <span>{saveMessage}</span>
          {existingClaim ? (
            <Link href={`/claims/${existingClaim.id}`} className="rounded-md bg-white px-3 py-1.5 font-semibold text-[#003A83] shadow-sm ring-1 ring-[#D7E1EE]">
              Open {existingClaim.claimNo}
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Link href="/claims" className="inline-flex h-10 items-center justify-center rounded-lg border border-[#D5DFEB] bg-white px-4 text-[12px] font-semibold text-[#526178] transition hover:bg-[#F7F9FC]">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={!lookup?.vehicle.id || loadingLookup || saving}
          className="inline-flex h-10 min-w-[110px] items-center justify-center rounded-lg bg-[#003A83] px-5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#073E83] disabled:cursor-not-allowed disabled:bg-[#A9B8CA]"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

function ClaimReferenceStrip({ data }: { data: AddClaimLookup | null }) {
  const policyNo = data?.policy?.policyNo ?? "";
  const insurerName = data?.insurer?.name ?? "";
  const insurerDisplay = insurerName && policyNo ? `${insurerName} - ${policyNo}` : insurerName;
  const makeModel = [data?.vehicle.make, data?.vehicle.model].filter(Boolean).join(" - ");

  return (
    <section className="overflow-hidden rounded-2xl border border-[#17355E] bg-[#071D49] shadow-[0_8px_22px_rgba(7,29,73,0.16)]">
      <div className="grid md:grid-cols-3 xl:grid-cols-5">
        <ReferenceInfo label="Customer" title={data?.customer.name ?? ""} subtitle={data?.customer.phone ?? ""} icon={headerIcons.customer} />
        <ReferenceInfo label="Vehicle No." title={data?.vehicle.vehicleNo ?? ""} icon={headerIcons.vehicle} />
        <ReferenceInfo label="Make & Model" title={makeModel} icon={headerIcons.makeModel} />
        <ReferenceInfo label="Insurer" title={insurerDisplay} icon={headerIcons.insurer} />
        <ReferenceInfo label="Loss Date" title="" icon={headerIcons.lossDate} last />
      </div>
      <div className="grid border-t border-white/15 md:grid-cols-3 xl:grid-cols-5">
        <ReferenceInfo label="Policy No." title={policyNo} icon={headerIcons.policy} />
        <ReferenceInfo label="Control No." title="" icon={headerIcons.control} />
        <ReferenceInfo label="Claim No." title="" icon={headerIcons.claim} />
        <ReferenceInfo label="Claim Status" title="" icon={headerIcons.status} />
        <ReferenceInfo label="Spot Intimation Date & Time" title="" icon={headerIcons.intimation} last />
      </div>
      <div className="grid gap-x-4 gap-y-1 border-t border-white/15 px-3 py-1.5 text-[9px] sm:grid-cols-2 lg:grid-cols-4">
        <PolicyMeta label="Policy source" value={data?.policy ? "Sankalp policy" : ""} />
        <PolicyMeta label="Cover dates" value={data?.policy ? `${formatDate(data.policy.startDate)} - ${formatDate(data.policy.endDate)}` : ""} />
        <PolicyMeta label="Premium / IDV" value={data?.policy ? `${formatAmount(data.policy.premiumAmount)} / ${formatAmount(data.policy.insuredDeclaredValue)}` : ""} />
        <div className="min-w-0 truncate text-[#C7D9F7]">
          <span className="font-medium uppercase tracking-[0.04em] text-[#8FA7C8]">Policy copy: </span>
          {data?.policyCopy ? (
            <Link href={data.policyCopy.openUrl} target="_blank" className="font-semibold text-[#C7D9F7] underline-offset-2 hover:underline">
              {data.policyCopy.fileName}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ReferenceInfo({ label, title, subtitle, icon, last = false }: { label: string; title: string; subtitle?: string; icon: string; last?: boolean }) {
  return (
    <div className={`min-w-0 px-4 py-3 ${last ? "" : "border-b border-white/15 xl:border-b-0 xl:border-r"}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center">
          <Image src={icon} alt="" width={28} height={28} className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-[9px] font-medium uppercase tracking-[0.05em] text-[#9FB4D3]">{label}</span>
          <span className="mt-0.5 block min-h-[18px] break-words text-[14px] font-semibold leading-[1.2] text-white">{title || "\u00A0"}</span>
          {subtitle !== undefined ? <span className="mt-0.5 block min-h-[14px] text-[11px] leading-tight text-[#CBD8E9]">{subtitle || "\u00A0"}</span> : null}
        </div>
      </div>
    </div>
  );
}

function PolicyMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 truncate text-[#C7D9F7]">
      <span className="font-medium uppercase tracking-[0.04em] text-[#8FA7C8]">{label}: </span>
      <span className="font-semibold">{value || "\u00A0"}</span>
    </div>
  );
}

function normalizeVehicleNumber(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(value));
}
