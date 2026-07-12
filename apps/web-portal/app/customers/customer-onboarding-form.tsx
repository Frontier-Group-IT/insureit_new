"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConfirmModal, FeedbackToast } from "@/components/ui-feedback";
import type { CustomerOnboardingState } from "./actions";

type LocationOption = { id: string; city_name: string; district: string | null; state_name: string; pincode: string };
type Props = { action: (previousState: CustomerOnboardingState, formData: FormData) => Promise<CustomerOnboardingState> };
type PartnerType = "individual_proprietor" | "dealership" | "corporate" | "group";
type DocumentField = "pan_copy" | "aadhaar_front" | "aadhaar_back" | "gst_copy";
type DocumentFiles = Partial<Record<DocumentField, File>>;
type FormSnapshot = Record<string, string | boolean>;

const inputClass = "h-8 w-full rounded-md border bg-white px-2.5 text-[12px] text-[#071D49] outline-none transition placeholder:text-[#9AA7B8] focus:ring-2";
const labelClass = "mb-0.5 block text-[10.5px] font-semibold text-[#344256]";
const partnerOptions: Array<{ value: PartnerType; label: string }> = [
  { value: "individual_proprietor", label: "Individual / Proprietor" },
  { value: "dealership", label: "Dealership" },
  { value: "corporate", label: "Corporate" },
  { value: "group", label: "Group" }
];

export function CustomerOnboardingForm({ action }: Props) {
  const [formState, formAction] = useActionState(action, { error: null, field: null });
  const [partnerType, setPartnerType] = useState<PartnerType | "">("");
  const [gstRegistered, setGstRegistered] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [documentFiles, setDocumentFiles] = useState<DocumentFiles>({});
  const [isDirty, setIsDirty] = useState(false);
  const [pendingPartner, setPendingPartner] = useState<PartnerType | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const snapshotRef = useRef<FormSnapshot>({});

  useEffect(() => {
    setShowError(Boolean(formState.error));
    if (!formState.error || !formRef.current) return;
    const form = formRef.current;
    for (const [name, value] of Object.entries(snapshotRef.current)) {
      const element = form.elements.namedItem(name);
      if (element instanceof HTMLInputElement) {
        if (element.type === "checkbox") element.checked = Boolean(value);
        else if (element.type !== "file" && element.type !== "radio") element.value = String(value);
      } else if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) element.value = String(value);
    }
    if (formState.field) requestAnimationFrame(() => {
      const field = form.elements.namedItem(formState.field ?? "");
      if (field instanceof HTMLElement) { field.focus({ preventScroll: true }); field.scrollIntoView({ behavior: "smooth", block: "center" }); }
    });
  }, [formState.error, formState.field]);

  useEffect(() => {
    if (!isDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const interceptLinks = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest("a");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
      event.preventDefault(); event.stopPropagation(); setPendingHref(href);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", interceptLinks, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", interceptLinks, true); };
  }, [isDirty]);

  useEffect(() => {
    if (cityQuery.trim().length < 2 || selectedLocation?.city_name === cityQuery) { setLocations([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/india-locations?query=${encodeURIComponent(cityQuery.trim())}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = (await response.json()) as { locations?: LocationOption[] };
        setLocations(data.locations ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) console.error("City search failed", error);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [cityQuery, selectedLocation]);

  const isIndividual = partnerType === "individual_proprietor";
  const errorField = formState.field;

  function resetPartnerData() {
    setGstRegistered(false); setCityQuery(""); setSelectedLocation(null); setLocations([]); setDocumentFiles({}); formRef.current?.reset();
  }

  function selectPartner(next: PartnerType) {
    if (partnerType && partnerType !== next && isDirty) { setPendingPartner(next); return; }
    if (partnerType && partnerType !== next) resetPartnerData();
    setPartnerType(next);
  }

  function captureForm(form: HTMLFormElement) {
    const snapshot: FormSnapshot = {};
    for (const element of Array.from(form.elements)) {
      if (element instanceof HTMLInputElement) {
        if (!element.name || element.type === "file" || element.type === "radio") continue;
        snapshot[element.name] = element.type === "checkbox" ? element.checked : element.value;
      } else if ((element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) && element.name) snapshot[element.name] = element.value;
    }
    snapshotRef.current = snapshot;
  }

  function submitWithCachedFiles(formData: FormData) {
    for (const [field, file] of Object.entries(documentFiles) as Array<[DocumentField, File]>) formData.set(field, file, file.name);
    formAction(formData);
  }

  function updateDocument(field: DocumentField, file: File | null) {
    setDocumentFiles((current) => { const next = { ...current }; file ? next[field] = file : delete next[field]; return next; });
    setIsDirty(true);
  }

  function confirmDiscard() {
    setIsDirty(false);
    if (pendingPartner) { resetPartnerData(); setPartnerType(pendingPartner); setPendingPartner(null); return; }
    if (pendingHref) { const href = pendingHref; setPendingHref(null); window.location.assign(href); }
  }

  return (
    <>
      {formState.error && showError ? <FeedbackToast message={formState.error} tone="error" onClose={() => setShowError(false)} /> : null}
      <ConfirmModal open={Boolean(pendingPartner || pendingHref)} title="Discard unsaved customer details?" message="Leaving or changing the partner type will discard the customer details you entered." confirmLabel="Discard and continue" cancelLabel="Keep editing" onConfirm={confirmDiscard} onCancel={() => { setPendingPartner(null); setPendingHref(null); }} />

      <form ref={formRef} action={submitWithCachedFiles} className="space-y-2 pb-4" onChange={(event) => { const target = event.target; if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) if (target.name !== "partner_type") setIsDirty(true); }} onSubmit={(event) => { captureForm(event.currentTarget); setIsDirty(true); }}>
        <section className="rounded-lg border border-[#DCE7F5] bg-white p-2.5 shadow-[0_3px_10px_rgba(7,29,73,0.025)]"><div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">{partnerOptions.map((option) => { const selected = partnerType === option.value; return <label key={option.value} className={`flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[11px] font-semibold transition ${errorField === "partner_type" ? "border-red-400 bg-red-50" : selected ? "border-[#7067E8] bg-[#E9EBFF] text-[#242653]" : "border-[#D8E2EE] bg-white text-[#344256] hover:bg-[#F7FAFE]"}`}><input type="radio" name="partner_type" value={option.value} checked={selected} onChange={() => selectPartner(option.value)} className="h-3 w-3 accent-[#7067E8]" />{option.label}</label>; })}</div></section>

        {partnerType && !isIndividual ? <section className="rounded-lg border border-dashed border-[#B9CCE3] bg-[#F8FBFF] px-3 py-2.5 text-center text-[11px] text-[#68758A]">This partner workflow is not available yet. Select Individual / Proprietor to continue.</section> : null}

        {isIndividual ? <>
          <Section step="1" title="Personal Information"><Field label="Name" name="contact_name" error={errorField === "contact_name"} required placeholder="Customer or proprietor name" /><Field label="Mobile Number" name="phone" error={errorField === "phone"} required placeholder="10-digit mobile number" inputMode="tel" pattern="[0-9+ ]{10,14}" /><Field label="Email ID" name="email" type="email" placeholder="Optional email" /></Section>

          <Section step="2" title="Address Details">
            <Field label="Street" name="address_street" required placeholder="House, building or street" />
            <Field label="Locality" name="address_locality" placeholder="Area or locality" />
            <div className="relative"><label className={labelClass} htmlFor="city_search">City *</label><input id="city_search" name="city_search" className={fieldClass(errorField === "city_search")} value={cityQuery} required autoComplete="off" placeholder="Start typing a city" onChange={(event) => { setCityQuery(event.target.value); setSelectedLocation(null); }} />{locations.length ? <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-[#D8E2EE] bg-white p-1 shadow-xl">{locations.map((location) => <button key={location.id} type="button" className="block w-full rounded px-2 py-1 text-left hover:bg-[#F1F6FC]" onClick={() => { setSelectedLocation(location); setCityQuery(location.city_name); setLocations([]); setIsDirty(true); }}><span className="block text-[11px] font-semibold text-[#071D49]">{location.city_name}</span><span className="block text-[9.5px] text-[#68758A]">{location.district ? `${location.district}, ` : ""}{location.state_name} · {location.pincode}</span></button>)}</div> : null}</div>
            <Field label="State" name="state_display" value={selectedLocation?.state_name ?? ""} readOnly placeholder="Auto-filled" />
            <Field label="PIN Code" name="pincode_display" value={selectedLocation?.pincode ?? ""} readOnly placeholder="Auto-filled" />
            <input type="hidden" name="india_location_id" value={selectedLocation?.id ?? ""} /><input type="hidden" name="city" value={selectedLocation?.city_name ?? ""} /><input type="hidden" name="state" value={selectedLocation?.state_name ?? ""} /><input type="hidden" name="postal_code" value={selectedLocation?.pincode ?? ""} />
          </Section>

          <Section step="3" title="Identity Documents">
            <DocumentInput label="PAN Number" name="pan_number" placeholder="ABCDE1234F" maxLength={10} fileField="pan_copy" file={documentFiles.pan_copy} error={errorField === "pan_number" || errorField === "pan_copy"} onFileChange={(file) => updateDocument("pan_copy", file)} />
            <DocumentInput label="Aadhaar Number" name="aadhaar_number" placeholder="12-digit Aadhaar number" maxLength={12} inputMode="numeric" pattern="[0-9]{12}" fileField="aadhaar_front" file={documentFiles.aadhaar_front} fileLabel="Front" error={errorField === "aadhaar_number" || errorField === "aadhaar_front"} onFileChange={(file) => updateDocument("aadhaar_front", file)} />
            <DocumentOnly label="Aadhaar Back" fileField="aadhaar_back" file={documentFiles.aadhaar_back} error={errorField === "aadhaar_back"} onFileChange={(file) => updateDocument("aadhaar_back", file)} />
          </Section>

          <Section step="4" title="GST Details">
            <label className={`mt-[15px] flex h-8 items-center gap-2 rounded-md border px-2.5 text-[11px] font-semibold text-[#071D49] ${errorField === "is_gst_registered" ? "border-red-400 bg-red-50" : "border-[#D8E2EE] bg-[#F8FBFF]"}`}><input type="checkbox" name="is_gst_registered" value="true" checked={gstRegistered} onChange={(event) => setGstRegistered(event.target.checked)} className="h-3 w-3 rounded" />GST Registered</label>
            <Field label="Legal Trade Name" name="legal_trade_name" error={errorField === "legal_trade_name"} required={gstRegistered} placeholder={gstRegistered ? "As per GST" : "Optional"} />
            {gstRegistered ? <DocumentInput label="GST Number" name="gst_number" placeholder="22AAAAA0000A1Z5" maxLength={15} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" fileField="gst_copy" file={documentFiles.gst_copy} error={errorField === "gst_number" || errorField === "gst_copy"} onFileChange={(file) => updateDocument("gst_copy", file)} /> : <div />}
          </Section>

          <section className="rounded-lg border border-[#DCE7F5] bg-white p-2.5 shadow-[0_3px_10px_rgba(7,29,73,0.025)]"><div className="mb-1.5 flex items-center justify-between border-b border-[#E8EEF6] pb-1.5"><h3 className="text-[12px] font-semibold text-[#071D49]">Fleet Details</h3><span className="rounded-full bg-[#EEF5FF] px-1.5 py-0.5 text-[9px] font-semibold text-[#245A9A]">5</span></div><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div className="w-full sm:max-w-xs"><label className={labelClass} htmlFor="fleet_size_band">Fleet Size *</label><select id="fleet_size_band" name="fleet_size_band" required className={fieldClass(errorField === "fleet_size_band")}><option value="">Select fleet size</option><option value="less_than_5">Less than 5</option><option value="5_to_20">5–20</option><option value="20_to_50">20–50</option><option value="more_than_50">More than 50</option></select></div><div className="flex justify-end gap-2"><Link href="/customers" className="rounded-md border border-[#D5E0EC] px-3.5 py-1.5 text-center text-[11px] font-semibold text-[#344256] hover:bg-[#F7FAFE]">Cancel</Link><FormSubmitButton label="Create Customer" /></div></div></section>
        </> : null}
      </form>
    </>
  );
}

function fieldClass(error = false, readOnly = false) { return `${inputClass} ${error ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-100" : "border-[#D8E2EE] focus:border-[#7067E8] focus:ring-[#E9EBFF]"} ${readOnly ? "bg-[#F4F7FA] text-[#68758A]" : ""}`; }

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) { return <section className="rounded-lg border border-[#DCE7F5] bg-white p-2.5 shadow-[0_3px_10px_rgba(7,29,73,0.025)]"><div className="mb-1.5 flex items-center justify-between border-b border-[#E8EEF6] pb-1.5"><h3 className="text-[12px] font-semibold text-[#071D49]">{title}</h3><span className="rounded-full bg-[#EEF5FF] px-1.5 py-0.5 text-[9px] font-semibold text-[#245A9A]">{step}</span></div><div className="grid gap-x-2.5 gap-y-1.5 md:grid-cols-2 xl:grid-cols-3">{children}</div></section>; }

function Field({ label, name, type = "text", required = false, placeholder = "", value, readOnly = false, error = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: boolean }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} type={type} required={required} placeholder={placeholder} value={value} readOnly={readOnly} aria-invalid={error || undefined} className={fieldClass(error, readOnly)} {...props} /></div>; }

function UploadControl({ field, file, label = "Upload", error, onFileChange }: { field: DocumentField; file?: File; label?: string; error?: boolean; onFileChange: (file: File | null) => void }) {
  return <><label htmlFor={field} className={`absolute right-1 top-1/2 flex h-6 -translate-y-1/2 cursor-pointer items-center gap-1 rounded px-2 text-[9px] font-semibold ${error ? "bg-red-100 text-red-700" : file ? "bg-emerald-100 text-emerald-700" : "bg-[#E9EBFF] text-[#454A76]"}`}><span>{file ? "✓" : "↥"}</span><span>{file ? "Uploaded" : label}</span></label><input id={field} name={field} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} /></>;
}

function DocumentInput({ label, name, placeholder, maxLength, pattern, inputMode, fileField, file, fileLabel, error, onFileChange }: { label: string; name: string; placeholder: string; maxLength?: number; pattern?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]; fileField: DocumentField; file?: File; fileLabel?: string; error?: boolean; onFileChange: (file: File | null) => void }) {
  return <div><label className={labelClass} htmlFor={name}>{label} *</label><div className="relative"><input id={name} name={name} required placeholder={placeholder} maxLength={maxLength} pattern={pattern} inputMode={inputMode} className={`${fieldClass(Boolean(error))} pr-[92px]`} /><UploadControl field={fileField} file={file} label={fileLabel} error={error} onFileChange={onFileChange} /></div><p className={`mt-0.5 text-[8.5px] ${file ? "text-emerald-600" : "text-amber-600"}`}>{file ? file.name : "Document pending"}</p></div>;
}

function DocumentOnly({ label, fileField, file, error, onFileChange }: { label: string; fileField: DocumentField; file?: File; error?: boolean; onFileChange: (file: File | null) => void }) {
  return <div><span className={labelClass}>{label} *</span><div className={`relative h-8 rounded-md border bg-white ${error ? "border-red-400" : "border-[#D8E2EE]"}`}><span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] ${file ? "text-emerald-700" : "text-amber-700"}`}>{file ? file.name : "Document pending"}</span><UploadControl field={fileField} file={file} error={error} onFileChange={onFileChange} /></div></div>;
}
