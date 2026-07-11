"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
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

const inputClass = "h-11 w-full rounded-xl border border-[#D8E2EE] bg-white px-3.5 text-sm text-[#071D49] outline-none transition placeholder:text-[#9AA7B8] focus:border-[#2D69B3] focus:ring-4 focus:ring-[#E8F2FF]";
const labelClass = "mb-1.5 block text-[12px] font-semibold text-[#344256]";

export function CustomerOnboardingForm({ action }: Props) {
  const [formState, formAction] = useActionState(action, { error: null });
  const [partnerType, setPartnerType] = useState("");
  const [gstRegistered, setGstRegistered] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);

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

  return (
    <form action={formAction} className="space-y-4 pb-10">
      {formState.error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {formState.error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-[#DCE7F5] bg-white px-5 py-4 shadow-[0_8px_22px_rgba(7,29,73,0.04)]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4773A8]">Customer onboarding</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-[#071D49]">Select partner type</h2>
            <p className="mt-1 text-[12.5px] text-[#68758A]">The onboarding sections will adapt to the selected business relationship.</p>
          </div>
          <span className="rounded-full bg-[#EEF5FF] px-3 py-1 text-[11px] font-semibold text-[#245A9A]">Step 1</span>
        </div>
        <div className="max-w-xl">
          <label className={labelClass} htmlFor="partner_type">Partner Type *</label>
          <select id="partner_type" name="partner_type" required className={inputClass} value={partnerType} onChange={(event) => setPartnerType(event.target.value)}>
            <option value="">Select partner type</option>
            <option value="individual_proprietor">Individual / Proprietor</option>
            <option value="dealership">Dealership</option>
            <option value="corporate">Corporate</option>
            <option value="group">Group</option>
          </select>
        </div>
      </section>

      {partnerType && !isIndividual ? (
        <section className="rounded-2xl border border-dashed border-[#B9CCE3] bg-[#F8FBFF] px-5 py-8 text-center">
          <p className="text-sm font-semibold text-[#071D49]">{partnerType === "dealership" ? "Dealership" : partnerType === "corporate" ? "Corporate" : "Group"} workflow will be added next.</p>
          <p className="mt-1 text-xs text-[#68758A]">For this build, continue with Individual / Proprietor.</p>
        </section>
      ) : null}

      {isIndividual ? (
        <>
          <Section step="2" title="Personal Information" description="Primary contact and registered address details.">
            <Field label="Name" name="contact_name" required placeholder="Customer or proprietor name" />
            <Field label="Mobile Number" name="phone" required placeholder="10-digit mobile number" inputMode="tel" pattern="[0-9+ ]{10,14}" />
            <Field label="Email ID" name="email" type="email" placeholder="Optional email address" />
            <Field label="Street" name="address_street" required placeholder="House, building or street" />
            <Field label="Locality" name="address_locality" placeholder="Area or locality" />
            <div className="relative">
              <label className={labelClass} htmlFor="city_search">City *</label>
              <input id="city_search" className={inputClass} value={cityQuery} required autoComplete="off" placeholder="Start typing a city" onChange={(event) => { setCityQuery(event.target.value); setSelectedLocation(null); }} />
              {locations.length ? (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[#D8E2EE] bg-white p-1 shadow-xl">
                  {locations.map((location) => (
                    <button key={location.id} type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#F1F6FC]" onClick={() => { setSelectedLocation(location); setCityQuery(location.city_name); setLocations([]); }}>
                      <span className="block text-sm font-semibold text-[#071D49]">{location.city_name}</span>
                      <span className="block text-[11px] text-[#68758A]">{location.district ? `${location.district}, ` : ""}{location.state_name} · {location.pincode}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <Field label="State" name="state_display" value={selectedLocation?.state_name ?? ""} readOnly placeholder="Auto-filled after city selection" />
            <Field label="PIN Code" name="pincode_display" value={selectedLocation?.pincode ?? ""} readOnly placeholder="Auto-filled after city selection" />
            <input type="hidden" name="india_location_id" value={selectedLocation?.id ?? ""} />
            <input type="hidden" name="city" value={selectedLocation?.city_name ?? ""} />
            <input type="hidden" name="state" value={selectedLocation?.state_name ?? ""} />
            <input type="hidden" name="postal_code" value={selectedLocation?.pincode ?? ""} />
          </Section>

          <Section step="3" title="Document Details" description="Upload PDF, JPG or PNG files up to 5 MB each.">
            <Field label="PAN Number" name="pan_number" required placeholder="ABCDE1234F" maxLength={10} />
            <FileField label="Upload PAN Copy" name="pan_copy" required />
            <div className="md:col-span-2">
              <Field label="Aadhaar Number" name="aadhaar_number" required placeholder="12-digit Aadhaar number" inputMode="numeric" pattern="[0-9]{12}" maxLength={12} />
            </div>
            <div className="grid gap-3 md:col-span-2 sm:grid-cols-2">
              <FileField label="Aadhaar Front" name="aadhaar_front" required compact />
              <FileField label="Aadhaar Back" name="aadhaar_back" required compact />
            </div>
            <div className="md:col-span-2 rounded-xl border border-[#E2EAF4] bg-[#F8FBFF] px-4 py-3">
              <label className="flex items-center gap-3 text-sm font-semibold text-[#071D49]">
                <input type="checkbox" name="is_gst_registered" value="true" checked={gstRegistered} onChange={(event) => setGstRegistered(event.target.checked)} className="h-4 w-4 rounded border-[#AFC0D5]" />
                GST Registered
              </label>
              <p className="mt-1 pl-7 text-[11.5px] text-[#68758A]">Enable this to capture GST legal trade details.</p>
            </div>
            <Field label="Legal Trade Name" name="legal_trade_name" required={gstRegistered} placeholder={gstRegistered ? "As registered under GST" : "Optional"} />
            {gstRegistered ? <Field label="GST Number" name="gst_number" required placeholder="22AAAAA0000A1Z5" maxLength={15} /> : <div />}
            {gstRegistered ? <FileField label="Upload GST Copy" name="gst_copy" required /> : null}
          </Section>

          <Section step="4" title="Fleet Details" description="Current commercial vehicle fleet size.">
            <div className="md:max-w-xl">
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

          <div className="flex flex-col-reverse gap-3 rounded-2xl border border-[#DCE7F5] bg-white px-5 py-4 shadow-[0_8px_22px_rgba(7,29,73,0.04)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11.5px] text-[#68758A]">Submitting creates the customer’s mobile OTP account and stores KYC documents in private storage.</p>
            <div className="flex gap-3">
              <Link href="/customers" className="rounded-xl border border-[#D5E0EC] px-5 py-2.5 text-sm font-semibold text-[#344256] hover:bg-[#F7FAFE]">Cancel</Link>
              <FormSubmitButton label="Create Customer" />
            </div>
          </div>
        </>
      ) : null}
    </form>
  );
}

function Section({ step, title, description, children }: { step: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#DCE7F5] bg-white px-5 py-4 shadow-[0_8px_22px_rgba(7,29,73,0.04)]">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#E8EEF6] pb-4">
        <div><h3 className="text-[17px] font-semibold text-[#071D49]">{title}</h3><p className="mt-1 text-[12px] text-[#68758A]">{description}</p></div>
        <span className="rounded-full bg-[#EEF5FF] px-3 py-1 text-[11px] font-semibold text-[#245A9A]">Step {step}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, name, type = "text", required = false, placeholder = "", value, readOnly = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} type={type} required={required} placeholder={placeholder} value={value} readOnly={readOnly} className={`${inputClass} ${readOnly ? "bg-[#F4F7FA] text-[#68758A]" : ""}`} {...props} /></div>;
}

function FileField({ label, name, required = false, compact = false }: { label: string; name: string; required?: boolean; compact?: boolean }) {
  return (
    <div className="min-w-0">
      <label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label>
      <input
        id={name}
        name={name}
        type="file"
        required={required}
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className={compact
          ? "block h-10 w-full min-w-0 rounded-xl border border-dashed border-[#B7C8DB] bg-[#FAFCFF] px-2 py-1.5 text-[11px] text-[#536274] file:mr-2 file:rounded-md file:border-0 file:bg-[#EAF3FF] file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-[#245A9A]"
          : "block h-11 w-full rounded-xl border border-dashed border-[#B7C8DB] bg-[#FAFCFF] px-3 py-2 text-xs text-[#536274] file:mr-3 file:rounded-lg file:border-0 file:bg-[#EAF3FF] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#245A9A]"}
      />
    </div>
  );
}
