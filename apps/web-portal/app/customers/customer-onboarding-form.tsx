"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConfirmModal, FeedbackToast } from "@/components/ui-feedback";
import type { CustomerOnboardingState } from "./actions";

type LocationOption = {
  id: string;
  city_name: string;
  district: string | null;
  state_name: string;
  pincode: string;
};

type Props = {
  action: (previousState: CustomerOnboardingState, formData: FormData) => Promise<CustomerOnboardingState>;
};

type PartnerType = "individual_proprietor" | "dealership" | "corporate" | "group";

const inputClass = "h-8 w-full rounded-md border border-[#D8E2EE] bg-white px-2.5 text-[12px] text-[#071D49] outline-none transition placeholder:text-[#9AA7B8] focus:border-[#2D69B3] focus:ring-2 focus:ring-[#E8F2FF]";
const labelClass = "mb-0.5 block text-[10.5px] font-semibold text-[#344256]";
const unsavedMessage = "Leaving or changing the partner type will discard the customer details you entered.";

const partnerOptions: Array<{ value: PartnerType; label: string }> = [
  { value: "individual_proprietor", label: "Individual / Proprietor" },
  { value: "dealership", label: "Dealership" },
  { value: "corporate", label: "Corporate" },
  { value: "group", label: "Group" }
];

export function CustomerOnboardingForm({ action }: Props) {
  const [formState, formAction] = useActionState(action, { error: null });
  const [partnerType, setPartnerType] = useState<PartnerType | "">("");
  const [gstRegistered, setGstRegistered] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingPartner, setPendingPartner] = useState<PartnerType | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    setShowError(Boolean(formState.error));
  }, [formState.error]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  useEffect(() => {
    if (cityQuery.trim().length < 2 || selectedLocation?.city_name === cityQuery) {
      setLocations([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/india-locations?query=${encodeURIComponent(cityQuery.trim())}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = (await response.json()) as { locations?: LocationOption[] };
        setLocations(data.locations ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("City search failed", error);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cityQuery, selectedLocation]);

  const isIndividual = partnerType === "individual_proprietor";
  const modalOpen = Boolean(pendingPartner || pendingHref);

  function resetPartnerData() {
    setGstRegistered(false);
    setCityQuery("");
    setSelectedLocation(null);
    setLocations([]);
  }

  function selectPartner(nextPartner: PartnerType) {
    if (partnerType && partnerType !== nextPartner && isDirty) {
      setPendingPartner(nextPartner);
      return;
    }
    if (partnerType && partnerType !== nextPartner) resetPartnerData();
    setPartnerType(nextPartner);
  }

  function closeModal() {
    setPendingPartner(null);
    setPendingHref(null);
  }

  function confirmDiscard() {
    setIsDirty(false);
    if (pendingPartner) {
      resetPartnerData();
      setPartnerType(pendingPartner);
      setPendingPartner(null);
      return;
    }
    if (pendingHref) {
      const href = pendingHref;
      setPendingHref(null);
      window.location.assign(href);
    }
  }

  return (
    <>
      {formState.error && showError ? <FeedbackToast message={formState.error} tone="error" onClose={() => setShowError(false)} /> : null}
      <ConfirmModal
        open={modalOpen}
        title="Discard unsaved customer details?"
        message={unsavedMessage}
        confirmLabel="Discard and continue"
        cancelLabel="Keep editing"
        onConfirm={confirmDiscard}
        onCancel={closeModal}
      />

      <form
        action={formAction}
        className="space-y-2 pb-4"
        onChange={(event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
            if (target.name !== "partner_type") setIsDirty(true);
          }
        }}
        onSubmit={() => setIsDirty(false)}
      >
        <section className="rounded-lg border border-[#DCE7F5] bg-white p-2.5 shadow-[0_3px_10px_rgba(7,29,73,0.025)]">
          <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
            {partnerOptions.map((option) => {
              const selected = partnerType === option.value;
              return (
                <label key={option.value} className={`flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[11px] font-semibold transition ${selected ? "border-[#2D69B3] bg-[#EEF5FF] text-[#174EA6]" : "border-[#D8E2EE] bg-white text-[#344256] hover:bg-[#F7FAFE]"}`}>
                  <input type="radio" name="partner_type" value={option.value} checked={selected} onChange={() => selectPartner(option.value)} className="h-3 w-3 accent-[#174EA6]" />
                  {option.label}
                </label>
              );
            })}
          </div>
        </section>

        {partnerType && !isIndividual ? (
          <section className="rounded-lg border border-dashed border-[#B9CCE3] bg-[#F8FBFF] px-3 py-2.5 text-center text-[11px] text-[#68758A]">
            This partner workflow is not available yet. Select Individual / Proprietor to continue.
          </section>
        ) : null}

        {isIndividual ? (
          <>
            <Section step="1" title="Personal Information">
              <Field label="Name" name="contact_name" required placeholder="Customer or proprietor name" />
              <Field label="Mobile Number" name="phone" required placeholder="10-digit mobile number" inputMode="tel" pattern="[0-9+ ]{10,14}" />
              <Field label="Email ID" name="email" type="email" placeholder="Optional email" />
              <Field label="Street" name="address_street" required placeholder="House, building or street" />
              <Field label="Locality" name="address_locality" placeholder="Area or locality" />
              <div className="relative">
                <label className={labelClass} htmlFor="city_search">City *</label>
                <input id="city_search" className={inputClass} value={cityQuery} required autoComplete="off" placeholder="Start typing a city" onChange={(event) => { setCityQuery(event.target.value); setSelectedLocation(null); }} />
                {locations.length ? (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-[#D8E2EE] bg-white p-1 shadow-xl">
                    {locations.map((location) => (
                      <button key={location.id} type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-[#F1F6FC]" onClick={() => { setSelectedLocation(location); setCityQuery(location.city_name); setLocations([]); setIsDirty(true); }}>
                        <span className="block text-[11px] font-semibold text-[#071D49]">{location.city_name}</span>
                        <span className="block text-[9.5px] text-[#68758A]">{location.district ? `${location.district}, ` : ""}{location.state_name} · {location.pincode}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <Field label="State" name="state_display" value={selectedLocation?.state_name ?? ""} readOnly placeholder="Auto-filled" />
              <Field label="PIN Code" name="pincode_display" value={selectedLocation?.pincode ?? ""} readOnly placeholder="Auto-filled" />
              <input type="hidden" name="india_location_id" value={selectedLocation?.id ?? ""} />
              <input type="hidden" name="city" value={selectedLocation?.city_name ?? ""} />
              <input type="hidden" name="state" value={selectedLocation?.state_name ?? ""} />
              <input type="hidden" name="postal_code" value={selectedLocation?.pincode ?? ""} />
            </Section>

            <Section step="2" title="Document Details">
              <Field label="PAN Number" name="pan_number" required placeholder="ABCDE1234F" maxLength={10} />
              <FileField label="PAN Copy" name="pan_copy" required />
              <Field label="Aadhaar Number" name="aadhaar_number" required placeholder="12-digit Aadhaar number" inputMode="numeric" pattern="[0-9]{12}" maxLength={12} />
              <FileField label="Aadhaar Front" name="aadhaar_front" required />
              <FileField label="Aadhaar Back" name="aadhaar_back" required />
              <label className="flex h-8 items-center gap-2 rounded-md border border-[#E2EAF4] bg-[#F8FBFF] px-2.5 text-[11px] font-semibold text-[#071D49]">
                <input type="checkbox" name="is_gst_registered" value="true" checked={gstRegistered} onChange={(event) => setGstRegistered(event.target.checked)} className="h-3 w-3 rounded border-[#AFC0D5]" />
                GST Registered
              </label>
              <Field label="Legal Trade Name" name="legal_trade_name" required={gstRegistered} placeholder={gstRegistered ? "As per GST" : "Optional"} />
              {gstRegistered ? <Field label="GST Number" name="gst_number" required placeholder="22AAAAA0000A1Z5" maxLength={15} /> : null}
              {gstRegistered ? <FileField label="GST Copy" name="gst_copy" required /> : null}
            </Section>

            <Section step="3" title="Fleet Details">
              <div>
                <label className={labelClass} htmlFor="fleet_size_band">Fleet Size *</label>
                <select id="fleet_size_band" name="fleet_size_band" required className={inputClass}>
                  <option value="">Select fleet size</option>
                  <option value="less_than_5">Less than 5</option>
                  <option value="5_to_20">5–20</option>
                  <option value="20_to_50">20–50</option>
                  <option value="more_than_50">More than 50</option>
                </select>
              </div>
            </Section>

            <div className="flex justify-end gap-2 rounded-lg border border-[#DCE7F5] bg-white px-2.5 py-2">
              <Link href="/customers" className="rounded-md border border-[#D5E0EC] px-3.5 py-1.5 text-center text-[11px] font-semibold text-[#344256] hover:bg-[#F7FAFE]">Cancel</Link>
              <FormSubmitButton label="Create Customer" />
            </div>
          </>
        ) : null}
      </form>
    </>
  );
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#DCE7F5] bg-white p-2.5 shadow-[0_3px_10px_rgba(7,29,73,0.025)]">
      <div className="mb-1.5 flex items-center justify-between border-b border-[#E8EEF6] pb-1.5">
        <h3 className="text-[12px] font-semibold text-[#071D49]">{title}</h3>
        <span className="rounded-full bg-[#EEF5FF] px-1.5 py-0.5 text-[9px] font-semibold text-[#245A9A]">{step}</span>
      </div>
      <div className="grid gap-x-2.5 gap-y-1.5 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function Field({ label, name, type = "text", required = false, placeholder = "", value, readOnly = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} type={type} required={required} placeholder={placeholder} value={value} readOnly={readOnly} className={`${inputClass} ${readOnly ? "bg-[#F4F7FA] text-[#68758A]" : ""}`} {...props} /></div>;
}

function FileField({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
  return (
    <div>
      <label className={labelClass} htmlFor={name}>↥ {label}{required ? " *" : ""}</label>
      <input id={name} name={name} type="file" required={required} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="block h-8 w-full rounded-md border border-dashed border-[#B7C8DB] bg-[#FAFCFF] px-1.5 py-0.5 text-[9px] text-[#536274] file:mr-1.5 file:rounded file:border-0 file:bg-[#EAF3FF] file:px-2 file:py-1 file:text-[9px] file:font-semibold file:text-[#245A9A]" />
    </div>
  );
}
