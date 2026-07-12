"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { FeedbackToast } from "@/components/ui-feedback";
import type { GroupOnboardingState } from "./group-actions";

type LocationOption = { id: string; city_name: string; district: string | null; state_name: string; pincode: string };
type FileKey = "owner_pan_copy" | "owner_aadhaar_front" | "owner_aadhaar_back" | "gst_copy" | "company_pan_copy";
type Props = { action: (state: GroupOnboardingState, formData: FormData) => Promise<GroupOnboardingState> };

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";

export function GroupOnboardingForm({ action }: Props) {
  const [state, formAction] = useActionState(action, { error: null, field: null });
  const [showError, setShowError] = useState(false);
  const [kycOpen, setKycOpen] = useState(false);
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
      const result = (await response.json()) as { locations?: LocationOption[] };
      setLocations(result.locations ?? []);
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [cityQuery, selectedLocation]);

  function submit(formData: FormData) { for (const [field, selected] of Object.entries(files) as Array<[FileKey, File]>) formData.set(field, selected, selected.name); formAction(formData); }
  function setFile(field: FileKey, selected: File | null) { setFiles((current) => { const next = { ...current }; if (selected) next[field] = selected; else delete next[field]; return next; }); }

  return <>
    {state.error && showError ? <FeedbackToast tone="error" message={state.error} onClose={() => setShowError(false)} /> : null}
    <div className="mx-auto max-w-[1240px] space-y-2 pb-20">
      <div className="flex items-center justify-between"><span className="rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">Group</span><Link href="/customers?choose_partner=1" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">Change partner type</Link></div>
      <form ref={formRef} action={submit} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <Section title="Group Details">
          <Field label="Group Name" name="group_name" required placeholder="Group or umbrella name" />
          <Field label="Owner Name" name="owner_name" required placeholder="Owner or promoter" />
          <Field label="Contact Number" name="phone" required inputMode="tel" maxLength={10} placeholder="10-digit mobile" />
          <Field label="Email ID" name="email" type="email" placeholder="Optional email" />
        </Section>

        <section className="border-b border-[#E2E8F0] px-5 py-4">
          <button type="button" onClick={() => setKycOpen((value) => !value)} className="flex w-full items-center justify-between text-left"><div><h3 className="text-[13px] font-semibold text-[#0F172A]">KYC Details</h3><p className="mt-0.5 text-[10px] text-[#64748B]">Optional owner KYC information</p></div><span className="text-[18px] text-[#64748B]">{kycOpen ? "−" : "+"}</span></button>
          {kycOpen ? <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="PAN Number" name="owner_pan" maxLength={10} placeholder="ABCDE1234F" />
            <FileField label="PAN Card Copy" name="owner_pan_copy" file={files.owner_pan_copy} onChange={(selected) => setFile("owner_pan_copy", selected)} />
            <Field label="Aadhaar Number" name="owner_aadhaar" inputMode="numeric" maxLength={12} placeholder="12-digit Aadhaar" />
            <FileField label="Aadhaar Front" name="owner_aadhaar_front" file={files.owner_aadhaar_front} onChange={(selected) => setFile("owner_aadhaar_front", selected)} />
            <FileField label="Aadhaar Back" name="owner_aadhaar_back" file={files.owner_aadhaar_back} onChange={(selected) => setFile("owner_aadhaar_back", selected)} />
          </div> : null}
        </section>

        <Section title="Company Details">
          <Field label="Company Name" name="company_name" required placeholder="Registered company name" />
          <Field label="GST Number" name="gst_number" maxLength={15} placeholder="Optional GSTIN" />
          <FileField label="GST Certificate" name="gst_copy" file={files.gst_copy} onChange={(selected) => setFile("gst_copy", selected)} />
          <Field label="Company PAN Number" name="company_pan" required maxLength={10} placeholder="ABCDE1234F" />
          <FileField label="Company PAN Copy" name="company_pan_copy" required file={files.company_pan_copy} onChange={(selected) => setFile("company_pan_copy", selected)} />
        </Section>

        <section className="border-b border-[#E2E8F0] px-5 py-4"><h3 className="mb-3 text-[13px] font-semibold text-[#0F172A]">Company Address</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(90px,.8fr)]">
          <Field label="Street" name="address_street" required placeholder="Building, road or street" />
          <Field label="Locality" name="address_locality" placeholder="Area or locality" />
          <div className="relative"><label className={labelClass} htmlFor="city_search">City *</label><input id="city_search" name="city_search" required autoComplete="off" value={cityQuery} onChange={(event) => { setCityQuery(event.target.value); setSelectedLocation(null); }} className={inputClass} placeholder="Search city" />{locations.length ? <div className="absolute z-30 mt-1 max-h-52 w-72 overflow-auto rounded-lg border border-[#D8DEE8] bg-white p-1 shadow-xl">{locations.map((location) => <button key={location.id} type="button" className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-[#F8FAFC]" onClick={() => { setSelectedLocation(location); setCityQuery(location.city_name); setStateValue(location.state_name); setPostalCode(location.pincode); setLocations([]); }}><span className="block text-[11px] font-semibold">{location.city_name}</span><span className="text-[10px] text-[#64748B]">{location.district ? `${location.district}, ` : ""}{location.state_name} · {location.pincode}</span></button>)}</div> : null}</div>
          <Field label="State" name="state" required value={stateValue} onChange={(event) => setStateValue(event.target.value)} />
          <Field label="PIN Code" name="postal_code" required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} inputMode="numeric" maxLength={6} />
          <input type="hidden" name="india_location_id" value={selectedLocation?.id ?? ""} /><input type="hidden" name="city" value={selectedLocation?.city_name ?? cityQuery} />
        </div></section>

        <Section title="Fleet Profile"><Select label="Fleet Size" name="fleet_size_band" required options={[{value:"less_than_5",label:"Less than 5"},{value:"5_to_20",label:"5–20"},{value:"20_to_50",label:"20–50"},{value:"more_than_50",label:"More than 50"}]} /></Section>

        <section className="border-b border-[#E2E8F0] px-5 py-4"><h3 className="mb-3 text-[13px] font-semibold text-[#0F172A]">Additional Contact Details</h3><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[11px]"><thead className="bg-[#F8FAFC] text-[9.5px] uppercase tracking-[0.04em] text-[#64748B]"><tr><th className="px-3 py-2">Role</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Number</th><th className="px-3 py-2">Email</th></tr></thead><tbody className="divide-y divide-[#EEF2F6]">{[["ceo_head","CEO / Head"],["admin_head","Admin Head"],["dedicated_spoc","Dedicated SPOC"]].map(([key,label]) => <tr key={key}><td className="px-3 py-2 font-semibold text-[#334155]">{label}</td><td className="px-3 py-2"><input name={`${key}_name`} className={inputClass} placeholder="Name" /></td><td className="px-3 py-2"><input name={`${key}_mobile`} className={inputClass} inputMode="tel" maxLength={10} placeholder="Mobile" /></td><td className="px-3 py-2"><input name={`${key}_email`} className={inputClass} type="email" placeholder="Email" /></td></tr>)}</tbody></table></div></section>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur"><Link href="/customers" className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155]">Cancel</Link><FormSubmitButton label="Create Group" /></div>
      </form>
    </div>
  </>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-[#E2E8F0] px-5 py-4"><h3 className="mb-3 text-[13px] font-semibold text-[#0F172A]">{title}</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function Field({ label, name, required = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} className={inputClass} {...props} /></div>; }
function Select({ label, name, options, required = false }: { label: string; name: string; options: Array<{value:string;label:string}>; required?: boolean }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} required={required} className={inputClass}><option value="">Select</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; }
function FileField({ label, name, file, required = false, onChange }: { label: string; name: FileKey; file?: File; required?: boolean; onChange: (file: File | null) => void }) { return <div><span className={labelClass}>{label}{required ? " *" : ""}</span><label htmlFor={name} className={`flex h-9 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[10.5px] ${file ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B]"}`}><span>{file ? "✓" : "↥"}</span><span className="min-w-0 flex-1 truncate">{file?.name ?? "Choose file"}</span></label><input id={name} name={name} type="file" required={required && !file} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => onChange(event.target.files?.[0] ?? null)} /></div>; }
