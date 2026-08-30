"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { FeedbackToast } from "@/components/ui-feedback";
import type { DealershipOnboardingState } from "./dealership-actions";

type Option = { value: string; label: string };
type LocationOption = { id: string; city_name: string; district: string | null; state_name: string; pincode: string };
type Props = { action: (state: DealershipOnboardingState, formData: FormData) => Promise<DealershipOnboardingState>; dealershipType: "posp" | "misp"; oems: Option[] };
type FileKey = "gst_copy" | "representative_aadhaar_front" | "representative_aadhaar_back" | "representative_pan_copy" | "representative_marksheet" | "company_cheque_copy";

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";

export function DealershipOnboardingForm({ action, dealershipType, oems }: Props) {
  const [state, formAction] = useActionState(action, { error: null, field: null });
  const [showError, setShowError] = useState(false);
  const [submittedValues, setSubmittedValues] = useState<Record<string, string>>({});
  const [cityQuery, setCityQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [stateValue, setStateValue] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setShowError(Boolean(state.error));
    if (!state.error) return;
    requestAnimationFrame(() => {
      const form = formRef.current;
      if (!form) return;

      for (const [name, value] of Object.entries(submittedValues)) {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement) {
          if (!["file", "checkbox", "radio", "hidden"].includes(field.type)) field.value = value;
        } else if (field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
          field.value = value;
        }
      }

      if (!state.field) return;
      const container = form.querySelector<HTMLElement>(`[data-field-name="${state.field}"]`);
      container?.scrollIntoView({ behavior: "smooth", block: "center" });
      const field = form.elements.namedItem(state.field);
      if (field instanceof HTMLElement && !(field instanceof HTMLInputElement && field.type === "file")) {
        field.focus({ preventScroll: true });
      }
    });
  }, [state.error, state.field, submittedValues]);

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
    const values: Record<string, string> = {};
    for (const [name, value] of formData.entries()) {
      if (typeof value === "string") values[name] = value;
    }
    setSubmittedValues(values);

    for (const [field, selected] of Object.entries(files) as Array<[FileKey, File]>) formData.set(field, selected, selected.name);
    formAction(formData);
  }

  function setFile(field: FileKey, selected: File | null) {
    setFiles((current) => { const next = { ...current }; if (selected) next[field] = selected; else delete next[field]; return next; });
  }

  const representativeLabel = dealershipType === "posp" ? "POSP" : "DP";
  const errorFor = (name: string) => state.field === name ? state.error : null;

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
            <Field label="Dealership Name" name="dealership_name" required placeholder="Registered dealership name" error={errorFor("dealership_name")} />
            <Field label="Owner Name" name="owner_name" required placeholder="Dealership owner" error={errorFor("owner_name")} />
            <Field label="Mobile Number" name="phone" required inputMode="tel" maxLength={10} placeholder="10-digit mobile" error={errorFor("phone")} />
            <Field label="Email ID" name="email" type="email" placeholder="Optional email" />
          </Section>

          <Section title="Address" columns="five">
            <Field label="Street" name="address_street" required placeholder="House, building or street" error={errorFor("address_street")} />
            <Field label="Locality" name="address_locality" placeholder="Area or locality" />
            <div data-field-name="city_search" className="relative"><label className={labelClass} htmlFor="city_search">City *</label><input id="city_search" name="city_search" required autoComplete="off" value={cityQuery} onChange={(event) => { setCityQuery(event.target.value); setSelectedLocation(null); }} aria-invalid={Boolean(errorFor("city_search"))} aria-describedby={errorFor("city_search") ? "city_search-error" : undefined} className={`${inputClass} ${errorFor("city_search") ? "border-red-400 bg-red-50/40" : ""}`} placeholder="Search city" />{errorFor("city_search") ? <p id="city_search-error" className="mt-1.5 text-[9.5px] font-semibold text-red-600">{errorFor("city_search")}</p> : null}{locations.length ? <div className="absolute z-30 mt-1 max-h-52 w-72 overflow-auto rounded-lg border border-[#D8DEE8] bg-white p-1 shadow-xl">{locations.map((location) => <button key={location.id} type="button" className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-[#F8FAFC]" onClick={() => { setSelectedLocation(location); setCityQuery(location.city_name); setStateValue(location.state_name); setPostalCode(location.pincode); setLocations([]); }}><span className="block text-[11px] font-semibold">{location.city_name}</span><span className="text-[10px] text-[#64748B]">{location.district ? `${location.district}, ` : ""}{location.state_name} · {location.pincode}</span></button>)}</div> : null}</div>
            <Field label="State" name="state" required value={stateValue} onChange={(event) => setStateValue(event.target.value)} placeholder="State" error={errorFor("state")} />
            <Field label="PIN Code" name="postal_code" required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} inputMode="numeric" maxLength={6} placeholder="PIN" error={errorFor("postal_code")} />
            <input type="hidden" name="india_location_id" value={selectedLocation?.id ?? ""} /><input type="hidden" name="city" value={selectedLocation?.city_name ?? cityQuery} />
          </Section>

          <Section title="Business Profile" columns="four">
            <Select label="Dealership OEM" name="oem_name" required options={oems} emptyLabel="Select OEM" error={errorFor("oem_name")} />
            <Select label="Yearly Sales" name="yearly_sales_band" required options={[{ value: "less_than_500", label: "Less than 500" }, { value: "500_to_1000", label: "500–1000" }, { value: "more_than_1000", label: "More than 1000" }]} emptyLabel="Select yearly sales" error={errorFor("yearly_sales_band")} />
          </Section>

          <Section title="GST Details" columns="four">
            <input type="hidden" name="is_gst_registered" value="true" />
            <Field label="GST Number" name="gst_number" required maxLength={15} minLength={15} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" placeholder="22AAAAA0000A1Z5" error={errorFor("gst_number")} />
            <FileField label="GST Certificate" name="gst_copy" file={files.gst_copy} required error={errorFor("gst_copy")} onChange={(selected) => setFile("gst_copy", selected)} />
          </Section>

          <Section title="Company Documents" columns="four">
            <FileField label="Company Cheque Copy" name="company_cheque_copy" file={files.company_cheque_copy} required error={errorFor("company_cheque_copy")} onChange={(selected) => setFile("company_cheque_copy", selected)} />
          </Section>

          <Section title={`${representativeLabel} Information`} columns="four">
            <Field label={`${representativeLabel} Name`} name="representative_name" required placeholder={`${representativeLabel} name`} error={errorFor("representative_name")} />
            <Field label="Mobile Number" name="representative_mobile" required inputMode="tel" maxLength={10} placeholder="10-digit mobile" error={errorFor("representative_mobile")} />
            <Field label="Email ID" name="representative_email" type="email" placeholder="Optional email" />
            <Field label="Aadhaar Number" name="representative_aadhaar" required inputMode="numeric" maxLength={12} minLength={12} pattern="[0-9]{12}" placeholder="12-digit Aadhaar" error={errorFor("representative_aadhaar")} />
            <FileField label="Aadhaar Front" name="representative_aadhaar_front" file={files.representative_aadhaar_front} required error={errorFor("representative_aadhaar_front")} onChange={(selected) => setFile("representative_aadhaar_front", selected)} />
            <FileField label="Aadhaar Back" name="representative_aadhaar_back" file={files.representative_aadhaar_back} required error={errorFor("representative_aadhaar_back")} onChange={(selected) => setFile("representative_aadhaar_back", selected)} />
            <Field label="PAN Card Number" name="representative_pan" required maxLength={10} minLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" placeholder="ABCDE1234F" error={errorFor("representative_pan")} />
            <FileField label="PAN Card Copy" name="representative_pan_copy" file={files.representative_pan_copy} required error={errorFor("representative_pan_copy")} onChange={(selected) => setFile("representative_pan_copy", selected)} />
            {dealershipType === "misp" ? <FileField label="DP Marksheet" name="representative_marksheet" file={files.representative_marksheet} required error={errorFor("representative_marksheet")} onChange={(selected) => setFile("representative_marksheet", selected)} /> : null}
          </Section>

          <section className="border-b border-[#E2E8F0] px-5 py-4"><div className="mb-3"><h3 className="text-[13px] font-semibold text-[#0F172A]">Additional Contact Information</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[11px]"><thead className="bg-[#F8FAFC] text-[9.5px] uppercase tracking-[0.04em] text-[#64748B]"><tr><th className="px-3 py-2">Role</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Mobile</th><th className="px-3 py-2">Email</th></tr></thead><tbody className="divide-y divide-[#EEF2F6]">{[["sales_head","Sales Head"],["bodyshop_head","Bodyshop Head"],["insurance_head","Insurance Head"],["insurance_spoc","Insurance SPOC"]].map(([key,label]) => <tr key={key}><td className="px-3 py-2 font-semibold text-[#334155]">{label}</td><td className="px-3 py-2"><input name={`${key}_name`} className={inputClass} placeholder="Name" /></td><td className="px-3 py-2"><input name={`${key}_mobile`} className={inputClass} inputMode="tel" maxLength={10} placeholder="Mobile" /></td><td className="px-3 py-2"><input name={`${key}_email`} className={inputClass} type="email" placeholder="Email" /></td></tr>)}</tbody></table></div></section>

          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur"><Link href="/customers" className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155]">Cancel</Link><FormSubmitButton label="Create Dealership" /></div>
        </form>
      </div>
    </>
  );
}

function Section({ title, action, children, columns }: { title: string; action?: React.ReactNode; children: React.ReactNode; columns: "four" | "five" }) { const grid = columns === "five" ? "md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(90px,.8fr)]" : "md:grid-cols-2 xl:grid-cols-4"; return <section className="border-b border-[#E2E8F0] px-5 py-4"><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-[13px] font-semibold text-[#0F172A]">{title}</h3>{action}</div><div className={`grid gap-x-3 gap-y-3 ${grid}`}>{children}</div></section>; }
function Field({ label, name, required = false, error = null, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string | null }) { const errorId = `${name}-error`; return <div data-field-name={name}><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`${inputClass} ${error ? "border-red-400 bg-red-50/40" : ""}`} {...props} />{error ? <p id={errorId} className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p> : null}</div>; }
function Select({ label, name, options, emptyLabel, required = false, error = null }: { label: string; name: string; options: Option[]; emptyLabel: string; required?: boolean; error?: string | null }) { const errorId = `${name}-error`; return <div data-field-name={name}><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`${inputClass} ${error ? "border-red-400 bg-red-50/40" : ""}`}><option value="">{emptyLabel}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error ? <p id={errorId} className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p> : null}</div>; }
function FileField({ label, name, file, required = false, error = null, onChange }: { label: string; name: FileKey; file?: File; required?: boolean; error?: string | null; onChange: (file: File | null) => void }) { const errorId = `${name}-error`; return <div data-field-name={name}><span className={labelClass}>{label}{required ? " *" : ""}</span><label htmlFor={name} className={`flex h-9 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[10.5px] ${error ? "border-red-400 bg-red-50/40 text-red-700" : file ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B]"}`}><span>{file ? "✓" : "↥"}</span><span className="min-w-0 flex-1 truncate">{file?.name ?? "Choose file"}</span><span className="text-[9px] font-semibold">{file ? "Ready" : required ? "Required" : "Optional"}</span></label><input id={name} name={name} type="file" required={required && !file} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />{error ? <p id={errorId} className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p> : null}</div>; }
