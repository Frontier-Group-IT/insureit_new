"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import {
  createOperationsClaim,
  lookupClaimVehicle,
  type AddClaimLookup,
} from "./add-claim-actions";

const inputClass = "h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";

export function AddClaimForm() {
  const router = useRouter();
  const requestId = useRef(0);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [lossDateTime, setLossDateTime] = useState("");
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

  function handleLossDateTimeChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const nextValue = input.value;
    setLossDateTime(nextValue);

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(nextValue)) {
      window.requestAnimationFrame(() => input.blur());
    }
  }

  async function saveClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lookup?.vehicle.id || !lossDateTime || saving) return;

    const lossAt = new Date(lossDateTime);
    if (Number.isNaN(lossAt.getTime())) {
      setSaveMessage("Enter a valid loss date and time.");
      return;
    }

    setSaving(true);
    setSaveMessage("");
    setExistingClaim(null);
    try {
      const result = await createOperationsClaim(lookup.vehicle.id, lossAt.toISOString());
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

  const makeModel = [lookup?.vehicle.make, lookup?.vehicle.model].filter(Boolean).join(" - ");
  const insurerName = lookup?.insurer?.name ?? "";
  const policyNo = lookup?.policy?.policyNo ?? "";

  return (
    <div className="mx-auto max-w-[1480px]">
      <form onSubmit={saveClaim} className="space-y-3 pb-5">
        <ClaimOnboardingHeader />

        <ClaimSection number="01" title="Claim Details" columns="two">
          <label>
            <span className={labelClass}>Vehicle Number</span>
            <div className="relative">
              <input
                autoFocus
                value={vehicleNumber}
                onChange={(event) => setVehicleNumber(event.target.value.toUpperCase())}
                placeholder="Enter vehicle number"
                autoComplete="off"
                aria-label="Vehicle Number"
                className={`${inputClass} pr-28 font-semibold uppercase tracking-[0.02em]`}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[9.5px] font-semibold text-[#667085]">
                {loadingLookup ? "Fetching..." : lookup ? "Details found" : ""}
              </span>
            </div>
            {lookupMessage ? <span role="alert" className="mt-1.5 block text-[10px] font-medium text-[#B42318]">{lookupMessage}</span> : null}
          </label>

          <label>
            <span className={labelClass}>Loss Date &amp; Time</span>
            <input
              type="datetime-local"
              value={lossDateTime}
              onChange={handleLossDateTimeChange}
              aria-label="Loss Date and Time"
              required
              className={inputClass}
            />
            <span className="mt-1.5 block text-[9.5px] text-[#667085]">Enter the actual date and time of loss/accident.</span>
          </label>
        </ClaimSection>

        <ClaimSection number="02" title="Customer & Vehicle Details" columns="four">
          <ReadOnlyField label="Customer" value={lookup?.customer.name ?? ""} />
          <ReadOnlyField label="Mobile" value={lookup?.customer.phone ?? ""} />
          <ReadOnlyField label="Vehicle No." value={lookup?.vehicle.vehicleNo ?? ""} />
          <ReadOnlyField label="Make & Model" value={makeModel} />
        </ClaimSection>

        <ClaimSection number="03" title="Active Policy Details" columns="four">
          <ReadOnlyField label="Insurer" value={insurerName} />
          <ReadOnlyField label="Policy No." value={policyNo} />
          <ReadOnlyField label="Policy Source" value={lookup?.policy ? "Sankalp policy" : ""} />
          <ReadOnlyField label="Cover Dates" value={lookup?.policy ? `${formatDate(lookup.policy.startDate)} - ${formatDate(lookup.policy.endDate)}` : ""} />
          <ReadOnlyField label="Premium" value={lookup?.policy ? formatAmount(lookup.policy.premiumAmount) : ""} />
          <ReadOnlyField label="IDV" value={lookup?.policy ? formatAmount(lookup.policy.insuredDeclaredValue) : ""} />
          <div>
            <span className={labelClass}>Policy Copy</span>
            <div className="flex h-10 items-center rounded-xl border border-[#D7E0EA] bg-[#F8FAFC] px-3 text-[11px] font-medium text-[#344054]">
              {lookup?.policyCopy ? (
                <Link href={lookup.policyCopy.openUrl} target="_blank" className="truncate font-semibold text-[#174EA6] underline-offset-2 hover:underline">
                  {lookup.policyCopy.fileName}
                </Link>
              ) : <span className="min-h-[16px]">&nbsp;</span>}
            </div>
          </div>
          <ReadOnlyField label="Policy Type" value={lookup?.policy?.policyType ?? ""} />
        </ClaimSection>

        <ClaimSection number="04" title="Claim Record" columns="four">
          <ReadOnlyField label="Control No." value="" />
          <ReadOnlyField label="Claim No." value="" />
          <ReadOnlyField label="Claim Status" value="" />
          <ReadOnlyField label="Spot Intimation Date & Time" value="" />
        </ClaimSection>

        {saveMessage ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F2C8C5] bg-[#FFF7F6] px-4 py-3 text-[11px] font-medium text-[#B42318]">
            <span>{saveMessage}</span>
            {existingClaim ? (
              <Link prefetch={false} href={`/claims/${existingClaim.id}`} className="rounded-lg bg-white px-3 py-1.5 font-semibold text-[#003A83] shadow-sm ring-1 ring-[#D7E1EE]">
                Open {existingClaim.claimNo}
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-[#D9E2F0] bg-white/95 px-4 py-2.5 shadow-[0_-6px_24px_rgba(15,23,42,0.05)] backdrop-blur">
          <Link href="/claims" className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155] transition hover:border-[#94A3B8] hover:bg-[#F8FAFC]">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!lookup?.vehicle.id || !lossDateTime || loadingLookup || saving}
            className="rounded-lg bg-[#17365D] px-5 py-2 text-[11px] font-semibold text-white transition hover:bg-[#102A49] disabled:cursor-not-allowed disabled:bg-[#A9B8CA]"
          >
            {saving ? "Saving..." : "Save Claim"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ClaimOnboardingHeader() {
  const steps = [
    { number: "01", label: "Claim Details" },
    { number: "02", label: "Customer & Vehicle" },
    { number: "03", label: "Active Policy" },
    { number: "04", label: "Claim Record" },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-[#D7E1EE] bg-white shadow-[0_4px_18px_rgba(23,54,93,0.06)]">
      <div className="flex min-h-[64px] items-center justify-between gap-4 bg-[#1D416C] px-5 py-3 sm:px-6">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-white">Claim Onboarding</h1>
        <Link href="/claims" className="shrink-0 rounded-lg border border-white/20 bg-white/[0.03] px-4 py-2 text-[10px] font-semibold text-white transition hover:border-white/35 hover:bg-white/[0.08]">Back</Link>
      </div>
      <div className="grid grid-cols-1 bg-white sm:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.number} className={`flex min-h-[46px] items-center justify-center gap-2.5 px-4 py-2 ${index < steps.length - 1 ? "border-b border-[#E1E7EF] sm:border-b-0 sm:border-r" : ""}`}>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F1F6FB] text-[8.5px] font-bold text-[#315B6B]">{step.number}</span>
            <span className="text-[10px] font-medium text-[#53657D] sm:text-[10.5px]">{step.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClaimSection({ number, title, children, columns }: { number: string; title: string; children: ReactNode; columns: "two" | "four" }) {
  const grid = columns === "two" ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-4";
  return (
    <section className="overflow-hidden rounded-xl border border-[#D9E2F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex min-h-[50px] items-center border-b border-[#E4EAF1] bg-[#FBFCFE] px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9.5px] font-bold text-white">{number}</span>
          <h2 className="text-[13px] font-semibold text-[#17203A]">{title}</h2>
        </div>
      </div>
      <div className={`grid min-w-0 grid-cols-1 gap-x-3 gap-y-3 p-3.5 sm:p-4 ${grid}`}>{children}</div>
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="flex min-h-10 items-center rounded-xl border border-[#D7E0EA] bg-[#F8FAFC] px-3 py-2 text-[11px] font-semibold text-[#344054]">
        <span className="break-words">{value || "\u00A0"}</span>
      </div>
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
