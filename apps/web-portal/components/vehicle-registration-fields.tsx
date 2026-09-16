"use client";

import { useEffect, useState, type ReactNode } from "react";

import { createSupabaseBrowserClient } from "@/lib/auth";

export type VehicleRegistrationMode = "registered" | "unregistered";

type RcLookupDetails = {
  registrationNumber: string;
  registrationDate: string | null;
  manufacturer: string | null;
  model: string | null;
  manufacturingYear: string | null;
  vehicleClass: string | null;
  fuelType: string | null;
  engineCapacityCc: string | null;
  seatingCapacity: string | null;
  gvwKg: string | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  fitnessExpiryDate: string | null;
  pucExpiryDate: string | null;
  roadTaxExpiryDate: string | null;
  nationalPermitExpiryDate: string | null;
  localPermitExpiryDate: string | null;
  permitNumber: string | null;
  insuranceCompany: string | null;
  policyNumber: string | null;
  policyStartDate: string | null;
  policyExpiryDate: string | null;
};

type RcDisplaySection = {
  title: string;
  fields: Array<{ label: string; value: string }>;
};

type RcLookupResponse = {
  status?: "success";
  provider?: "authbridge";
  source?: "local_cache" | "authbridge";
  isStale?: boolean;
  transactionId?: string | null;
  lookedUpAt?: string | null;
  details?: RcLookupDetails;
  sections?: RcDisplaySection[];
  error?: string;
};

type RcLookupSuccess = Required<Pick<RcLookupResponse, "status" | "details">> & RcLookupResponse;

export function VehicleRegistrationFields({
  initialMode,
  initialVehicleNo,
  initialRegistrationDate,
  children,
}: {
  initialMode: VehicleRegistrationMode;
  initialVehicleNo?: string | null;
  initialRegistrationDate?: string | null;
  children?: ReactNode;
}) {
  const [mode, setMode] = useState<VehicleRegistrationMode>(initialMode);
  const [vehicleNo, setVehicleNo] = useState(initialMode === "registered" ? initialVehicleNo ?? "" : "");
  const [registrationDate, setRegistrationDate] = useState(initialRegistrationDate ?? "");
  const [lookupPending, setLookupPending] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<RcLookupSuccess | null>(null);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("insureit:vehicle-registration-mode", { detail: { mode } }));
  }, [mode]);

  async function fetchRcDetails() {
    const registrationNumber = vehicleNo.trim();
    if (!registrationNumber) {
      setLookupError("Enter the RC / Registration number first.");
      return;
    }

    setLookupPending(true);
    setLookupError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 65_000);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Please sign in again to fetch RC details.");

      const response = await fetch("/api/vehicles/rc-lookup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ registrationNumber }),
        cache: "no-store",
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as RcLookupResponse;
      if (!response.ok || payload.status !== "success" || !payload.details) {
        throw new Error(payload.error || "We could not fetch the vehicle details. You can continue manually.");
      }

      setLookupResult({ ...payload, status: "success", details: payload.details });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setLookupError("Vehicle details are taking longer than usual. Please try again.");
      } else {
        setLookupError(error instanceof Error ? error.message : "We could not fetch the vehicle details. You can continue manually.");
      }
    } finally {
      window.clearTimeout(timeout);
      setLookupPending(false);
    }
  }

  function applyRcDetails() {
    if (!lookupResult?.details) return;
    const details = lookupResult.details;

    setVehicleNo(details.registrationNumber || vehicleNo);
    if (details.registrationDate) setRegistrationDate(details.registrationDate);

    setFormControlValue("make", details.manufacturer, { selectMatchOnly: true });
    setFormControlValue("year", details.manufacturingYear, { selectMatchOnly: true });
    setFormControlValue("model", details.model);
    setFormControlValue("vehicle_type", details.vehicleClass, { selectMatchOnly: true });
    setFormControlValue("chassis_no", details.chassisNumber);
    setFormControlValue("engine_no", details.engineNumber);
    setFormControlValue("fuel_type", details.fuelType, { selectMatchOnly: true });
    setFormControlValue("gvw_kg", capacityValue(details));
    setFormControlValue("fitness_expiry_date", details.fitnessExpiryDate);
    setFormControlValue("puc_expiry_date", details.pucExpiryDate);
    setFormControlValue("road_tax_expiry_date", details.roadTaxExpiryDate);
    setFormControlValue("national_permit_expiry_date", details.nationalPermitExpiryDate);
    setFormControlValue("local_permit_expiry_date", details.localPermitExpiryDate);

    window.dispatchEvent(new CustomEvent("insureit:vehicle-rc-applied", { detail: details }));
    setLookupResult(null);
  }

  return (
    <>
      <div className="absolute right-4 top-2.5 z-10 flex items-center gap-2 max-sm:left-3 max-sm:right-3 max-sm:top-[56px] max-sm:justify-end">
        <input type="hidden" name="registration_mode" value={mode} />
        <div
          className="inline-flex h-8 items-center rounded-full border border-[#D5E0EF] bg-white p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_5px_14px_rgba(15,23,42,.06)]"
          role="radiogroup"
          aria-label="Vehicle registration status"
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "registered"}
            onClick={() => setMode("registered")}
            className={`relative inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[8.5px] font-bold transition ${mode === "registered" ? "bg-[#17365D] text-white shadow-[0_5px_12px_rgba(23,54,93,.22)]" : "text-[#667085] hover:bg-[#F5F8FC]"}`}
          >
            <RegistrationBadgeIcon active={mode === "registered"} />
            <span>Registered</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === "unregistered"}
            onClick={() => setMode("unregistered")}
            className={`relative inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[8.5px] font-bold transition ${mode === "unregistered" ? "bg-[linear-gradient(135deg,#315B9A,#19A7A0)] text-white shadow-[0_5px_12px_rgba(25,167,160,.22)]" : "text-[#667085] hover:bg-[#F5F8FC]"}`}
          >
            <PendingBadgeIcon active={mode === "unregistered"} />
            <span>Unregistered</span>
          </button>
        </div>
      </div>

      {mode === "registered" ? (
        <>
          <div className="min-w-0">
            <label className="mb-1 block text-[10.5px] font-semibold text-[#344054]" htmlFor="vehicle_no">
              RC / Registration number *
            </label>
            <div className="flex min-w-0 gap-2">
              <input
                id="vehicle_no"
                name="vehicle_no"
                value={vehicleNo}
                onChange={(event) => {
                  setVehicleNo(event.target.value);
                  if (lookupError) setLookupError(null);
                }}
                placeholder="MP20CM6416"
                required
                autoComplete="off"
                className="h-10 min-w-0 flex-1 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[12px] uppercase text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]"
              />
              <button
                type="button"
                onClick={fetchRcDetails}
                disabled={lookupPending || !vehicleNo.trim()}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-[#17365D] bg-[#17365D] px-3.5 text-[10px] font-bold text-white transition hover:bg-[#102A49] disabled:cursor-not-allowed disabled:border-[#AAB8C8] disabled:bg-[#AAB8C8]"
              >
                {lookupPending ? "Fetching..." : "Fetch"}
              </button>
            </div>
            {lookupError ? <p className="mt-1.5 text-[9.5px] font-medium leading-4 text-[#B42318]">{lookupError}</p> : null}
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-[10.5px] font-semibold text-[#344054]" htmlFor="registration_date">
              Registration date
            </label>
            <input
              id="registration_date"
              name="registration_date"
              type="date"
              value={registrationDate}
              onChange={(event) => setRegistrationDate(event.target.value)}
              className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]"
            />
          </div>

          {children}
        </>
      ) : (
        children
      )}

      {initialMode === "registered" && Boolean(initialVehicleNo) && mode === "unregistered" ? (
        <div className="md:col-span-2 lg:col-span-3 xl:col-span-6 rounded-xl border border-[#F5D7A8] bg-[#FFF9EF] px-3 py-2 text-[9.5px] leading-4 text-[#8A5A16]">
          Saving as Unregistered will keep the current registration number and linked history, while moving this vehicle to RC pending.
        </div>
      ) : null}

      {lookupResult ? <RcDetailsDialog result={lookupResult} onConfirm={applyRcDetails} /> : null}
    </>
  );
}

function RcDetailsDialog({ result, onConfirm }: { result: RcLookupSuccess; onConfirm: () => void }) {
  const sections = result.sections ?? [];
  const lookedUpAt = result.lookedUpAt ? new Date(result.lookedUpAt) : null;
  const lookedUpLabel = lookedUpAt && Number.isFinite(lookedUpAt.getTime()) ? lookedUpAt.toLocaleString() : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0F172A]/45 p-4 backdrop-blur-[2px]" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-rc-details-title"
        className="flex max-h-[88vh] w-full max-w-[1050px] flex-col overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_24px_80px_rgba(15,23,42,.24)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E4EAF1] bg-[#F8FAFC] px-5 py-4 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="vehicle-rc-details-title" className="text-[16px] font-semibold text-[#17203A]">Vehicle RC Details</h2>
              <span className="rounded-full border border-[#C7D7EA] bg-white px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.06em] text-[#315B6B]">AuthBridge</span>
              {result.isStale ? <span className="rounded-full border border-[#F2D3A0] bg-[#FFF8EC] px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.05em] text-[#8A5A16]">Cached fallback</span> : null}
            </div>
            <p className="mt-1 text-[10px] text-[#667085]">
              {result.details.registrationNumber}
              {lookedUpLabel ? ` · Fetched ${lookedUpLabel}` : ""}
            </p>
          </div>
          <div className="text-right text-[9px] leading-4 text-[#7A8798]">
            <div>{result.source === "local_cache" ? "Source: cached AuthBridge response" : "Source: live AuthBridge response"}</div>
            {result.transactionId ? <div>Transaction: {result.transactionId}</div> : null}
          </div>
        </div>

        {result.isStale ? (
          <div className="border-b border-[#F2D3A0] bg-[#FFF8EC] px-5 py-2.5 text-[9.5px] font-medium text-[#8A5A16] sm:px-6">
            AuthBridge could not be reached, so the most recent cached RC response is being shown. Review the details before applying them.
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {sections.length > 0 ? (
            <div className="space-y-4">
              {sections.map((section, sectionIndex) => (
                <div key={`${section.title}-${sectionIndex}`} className="overflow-hidden rounded-xl border border-[#E1E7EF]">
                  <div className="border-b border-[#E8EDF3] bg-[#FBFCFE] px-4 py-2.5">
                    <h3 className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#334155]">{section.title}</h3>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {section.fields.map((field, fieldIndex) => (
                      <div key={`${field.label}-${fieldIndex}`} className="min-w-0 border-b border-[#EEF2F6] px-4 py-3 sm:border-r lg:[&:nth-child(3n)]:border-r-0">
                        <dt className="text-[8.5px] font-semibold uppercase tracking-[0.035em] text-[#7A8798]">{field.label}</dt>
                        <dd className="mt-1 break-words text-[10.5px] font-medium leading-4 text-[#17203A]">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          ) : (
            <MappedDetailsFallback details={result.details} />
          )}
        </div>

        <div className="flex items-center justify-end border-t border-[#E4EAF1] bg-white px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onConfirm}
            className="min-w-[96px] rounded-lg bg-[#17365D] px-5 py-2.5 text-[10.5px] font-bold text-white transition hover:bg-[#102A49]"
          >
            OK
          </button>
        </div>
      </section>
    </div>
  );
}

function MappedDetailsFallback({ details }: { details: RcLookupDetails }) {
  const rows = Object.entries(details).filter(([, value]) => Boolean(value));
  return (
    <div className="overflow-hidden rounded-xl border border-[#E1E7EF]">
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([key, value]) => (
          <div key={key} className="border-b border-[#EEF2F6] px-4 py-3 sm:border-r lg:[&:nth-child(3n)]:border-r-0">
            <dt className="text-[8.5px] font-semibold uppercase tracking-[0.035em] text-[#7A8798]">{humanizeKey(key)}</dt>
            <dd className="mt-1 break-words text-[10.5px] font-medium leading-4 text-[#17203A]">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function capacityValue(details: RcLookupDetails) {
  if (details.vehicleClass === "GCV") return details.gvwKg;
  if (details.vehicleClass === "PCV") return details.seatingCapacity;
  if (details.vehicleClass === "PCP" || details.vehicleClass === "TWP") return details.engineCapacityCc;
  return details.gvwKg ?? details.engineCapacityCc ?? details.seatingCapacity;
}

function setFormControlValue(id: string, value: string | null, options: { selectMatchOnly?: boolean } = {}) {
  if (!value) return;
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return;

  let nextValue = value;
  if (element instanceof HTMLSelectElement && options.selectMatchOnly) {
    const normalized = value.trim().toLowerCase();
    const match = Array.from(element.options).find((option) =>
      option.value.trim().toLowerCase() === normalized || option.text.trim().toLowerCase() === normalized,
    );
    if (!match) return;
    nextValue = match.value;
  }

  const prototype = element instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, nextValue);
  else element.value = nextValue;

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function humanizeKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function RegistrationBadgeIcon({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="13" height="10" rx="2.2" />
      <path d="M6.5 8h7" />
      <path d="M6.5 11h3.5" />
      <path d="m12 12 1.1 1.1 2.2-2.7" />
    </svg>
  );
}

function PendingBadgeIcon({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 6.5 10 3l5 3.5v7L10 17l-5-3.5z" />
      <path d="M10 7.2v3.3" />
      <path d="M10 13.5h.01" />
    </svg>
  );
}
