"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { FeedbackToast } from "@/components/ui-feedback";
import type { DealershipOnboardingState } from "./dealership-actions";

type Option = { value: string; label: string };
type LocationOption = { id: string; city_name: string; district: string | null; state_name: string; pincode: string };
type Props = { action: (state: DealershipOnboardingState, formData: FormData) => Promise<DealershipOnboardingState>; dealershipType: "posp" | "misp"; oems: Option[] };
type FileKey = "gst_copy" | "representative_aadhaar_front" | "representative_aadhaar_back" | "representative_pan_copy";

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";

export function DealershipOnboardingForm({ action, dealershipType, oems }: Props) {
  const [state, formAction] = useActionState(action, { error: null, field: null });
  const [showError, setShowError] = useState(false);
  const [gstRegistered, setGstRegistered] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [stateValue, setStateValue] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setShowError(Boolean(state.error));
    if (!state.field) return;
    requestAnimationFrame(() => {
      const field = formRef.current?.elements.namedItem(state.field ?? "");
      if (field instanceof HTMLElement) { field.focus({ preventScroll: true }); field.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });
  }, [state.error, state.field]);

  useEffect(() => {
    if (cityQuery.trim().length < 2 || selectedLocation?.city_name === cityQuery) { setLocations([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/india-locations?query=${encodeURIComponent(cityQuery.trim())}`, { signal: controller.signal });
      if (!response.ok) return;
      const data = (await response.json()) as { locations?: LocationOption[] };
      setLocations(data.locations ?? []);
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [cityQuery, selectedLocation]);

  function submit(formData: FormData) {
    for (const [field, selected] of Object.entries(files) as Array<[FileKey, File]>) formData.set(field, selected, selected.name);
    formAction(formData);
  }

  function setFile(field: FileKey, selected: File | null) {
    setFiles((current) => { const next = { ...current }; if (selected) next[field] = selected; else delete next[field]; return next; });
  }

  const representativeLabel = dealershipType === "posp" ? "POSP" : "DP";

  return (
    <>
      {state.error && showError ? <FeedbackToast tone="error" message={state.error} onClose={() => setShowError(false)} /> : null}
      <div className="mx-auto max-w-[1240px] space-y-2 pb-20">
        <div className="flex items-center justify-between">
          <div className="flex gap-2"><span className="rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">Dealership</span><span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[10.5px] font-semibold text-[#4338CA]">{dealershipType.toUpperCase()}</span></div>
          <Link href="/customers?choose_partner=1" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">Change partner type</Link>
        </div>
        <form ref={formRef} action={submit} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <input type="hidden" name="dealership_type" value={dealershipType} />

          <Section title="Dealership Details" columns="four">
            <Field label="Dealership Name" name="dealership_name" required placeholder="Registered dealership name" />
            <Field label="Owner Name" name="owner_name" required placeholder="Dealership owner" />
            <Field label="Mobile Number" name="phone" required inputMode="tel" maxLength={10} placeholder="10-digit mobile" />
            <Field label="Email ID" name="email" type="email" placeholder="Optional email" />
          </Section>

          <Section title="Address" columns="five">
            <Field label="Street" name="address_street" required placeholder="House, building or street" />
            <Field label="Locality" name="address_locality" placeholder="Area or locality" />
            <div className="relative"><label className={labelClass} htmlFor="city_search">City *</label><input id="city_search" name="city_search" required autoComplete="off" value={cityQuery} onChange={(event) => { setCityQuery(event.target.value); setSelectedLocation(null); }} className={inputClass} placeholder="Search city" />{locations.length ? <div className="absolute z-30 mt-1 max-h-52 w-72 overflow-auto rounded-lg border border-[#D8DEE8] bg-white p-1 shadow-xl">{locations.map((location) => <button key={location.id} type="button" className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-[#F8FAFC]" onClick={() => { setSelectedLocation(location); setCityQuery(location.city_name); setStateValue(location.state_name); setPostalCode(location.pincode); setLocations([]); }}><span className="block text-[11px] font-semibold">{location.city_name}</span><span className="text-[10px] text-[#64748B]">{location.district ? `${location.district}, ` : ""}{location.state_name} · {location.pincode}</span></button>)}</div> : null}</div>
            <Field label="State" name="state" required value={stateValue} onChange={(event) => setStateValue(event.target.value)} placeholder="State" />
            <Field label="PIN Code" name="postal_code" required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} inputMode="numeric" maxLength={6} placeholder="PIN" />
            <input type="hidden" name="india_location_id" value={selectedLocation?.id ?? ""} /><input type="hidden" name="city" value={selectedLocation?.city_name ?? cityQuery} />
          </Section>

          <Section title="Business Profile" columns="four">
            <Select label="Dealership OEM" name="oem_name" required options={oems} emptyLabel="Select OEM" />
            <Select label="Yearly Sales" name="yearly_sales_band" required options={[{ value: "less_than_500", label: "Less than 500" }, { value: "500_to_1000", label: "500–1000" }, { value: "more_than_1000", label: "More than 1000" }]} emptyLabel="Select yearly sales" />
          </Section>

          <Section title="GST Details" columns="four" action={<label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-[#334155]"><input type="checkbox" name="is_gst_registered" value="true" checked={gstRegistered} onChange={(event) => setGstRegistered(event.target.checked)} className="h-3.5 w-3.5" /> GST Registered</label>}>
            <Field label="GST Number" name="gst_number" required={gstRegistered} maxLength={15} placeholder="22AAAAA0000A1Z5" />
            <FileField label="GST Certificate" name="gst_copy" file={files.gst_copy} required={gstRegistered} onChange={(selected) => setFile("gst_copy", selected)} />
          </Section>

          <Section title={`${representativeLabel} Information`} columns="four">
            <Field label={`${representativeLabel} Name`} name="representative_name" required placeholder={`${representativeLabel} name`} />
            <Field label="Mobile Number" name="representative_mobile" required inputMode="tel" maxLength={10} placeholder="10-digit mobile" />
            <Field label="Email ID" name="representative_email" type="email" placeholder="Optional email" />
            <Field label="Aadhaar Number" name="representative_aadhaar" required inputMode="numeric" maxLength={12} placeholder="12-digit Aadhaar" />
            <FileField label="Aadhaar Front" name="representative_aadhaar_front" file={files.representative_aadhaar_front} required onChange={(selected) => setFile("representative_aadhaar_front", selected)} />
            <FileField label="Aadhaar Back" name="representative_aadhaar_back" file={files.representative_aadhaar_back} required onChange={(selected) => setFile("representative_aadhaar_back", selected)} />
            <Field label="PAN Card Number" name="representative_pan" required maxLength={10} placeholder="ABCDE1234F" />
            <FileField label="PAN Card Copy" name="representative_pan_copy" file={files.representative_pan_copy} required onChange={(selected) => setFile("representative_pan_copy", selected)} />
          </Section>

          <section className="border-b border-[#E2E8F0] px-5 py-4"><div className="mb-3"><h3 className="text-[13px] font-semibold text-[#0F172A]">Additional Contact Information</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[11px]"><thead className="bg-[#F8FAFC] text-[9.5px] uppercase tracking-[0.04em] text-[#64748B]"><tr><th className="px-3 py-2">Role</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Mobile</th><th className="px-3 py-2">Email</th></tr></thead><tbody className="divide-y divide-[#EEF2F6]">{[["sales_head","Sales Head"],["bodyshop_head","Bodyshop Head"],["insurance_head","Insurance Head"],["insurance_spoc","Insurance SPOC"]].map(([key,label]) => <tr key={key}><td className="px-3 py-2 font-semibold text-[#334155]">{label}</td><td className="px-3 py-2"><input name={`${key}_name`} className={inputClass} placeholder="Name" /></td><td className="px-3 py-2"><input name={`${key}_mobile`} className={inputClass} inputMode="tel" maxLength={10} placeholder="Mobile" /></td><td className="px-3 py-2"><input name={`${key}_email`} className={inputClass} type="email" placeholder="Email" /></td></tr>)}</tbody></table></div></section>

          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur"><Link href="/customers" className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155]">Cancel</Link><FormSubmitButton label="Create Dealership" /></div>
        </form>
      </div>
    </>
  );
}

function Section({ title, action, children, columns }: { title: string; action?: React.ReactNode; children: React.ReactNode; columns: "four" | "five" }) { const grid = columns === "five" ? "md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(90px,.8fr)]" : "md:grid-cols-2 xl:grid-cols-4"; return <section className="border-b border-[#E2E8F0] px-5 py-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-[13px] font-semibold text-[#0F172A]">{title}</h3>{action}</div><div className={`grid gap-x-3 gap-y-3 ${grid}`}>{children}</div></section>; }
function Field({ label, name, required = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} className={inputClass} {...props} /></div>; }
function Select({ label, name, options, emptyLabel, required = false }: { label: string; name: string; options: Option[]; emptyLabel: string; required?: boolean }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} required={required} className={inputClass}><option value="">{emptyLabel}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; }
function FileField({ label, name, file, required = false, onChange }: { label: string; name: FileKey; file?: File; required?: boolean; onChange: (file: File | null) => void }) { return <div><span className={labelClass}>{label}{required ? " *" : ""}</span><label htmlFor={name} className={`flex h-9 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[10.5px] ${file ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B]"}`}><span>{file ? "✓" : "↥"}</span><span className="min-w-0 flex-1 truncate">{file?.name ?? "Choose file"}</span><span className="text-[9px] font-semibold">{file ? "Ready" : required ? "Required" : "Optional"}</span></label><input id={name} name={name} type="file" required={required && !file} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => onChange(event.target.files?.[0] ?? null)} /></div>; }
