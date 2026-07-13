"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { AlertModal, ConfirmModal } from "@/components/ui-feedback";
import type { CustomerOnboardingState } from "./actions";

type LocationOption = { id: string; city_name: string; district: string | null; state_name: string; pincode: string };
type DocumentField = "pan_copy" | "aadhaar_front" | "aadhaar_back" | "gst_copy";
type DocumentFiles = Partial<Record<DocumentField, File>>;
type FormSnapshot = Record<string, string | boolean>;
type GridColumns = "three" | "four" | "five";
type Props = { action: (previousState: CustomerOnboardingState, formData: FormData) => Promise<CustomerOnboardingState>; partnerType: string };

const inputClass = "h-9 w-full rounded-md border bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:ring-2";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";
const partnerLabels: Record<string, string> = { individual_proprietor: "Individual / Proprietor", dealership: "Dealership", corporate: "Corporate", group: "Group" };
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function CustomerOnboardingForm({ action, partnerType }: Props) {
  const [formState, formAction] = useActionState(action, { error: null, field: null });
  const [gstRegistered, setGstRegistered] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [stateValue, setStateValue] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [documentFiles, setDocumentFiles] = useState<DocumentFiles>({});
  const [showWarning, setShowWarning] = useState(false);
  const [warningAccepted, setWarningAccepted] = useState(false);
  const [errorPopup, setErrorPopup] = useState<{ message: string; field?: string } | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const snapshotRef = useRef<FormSnapshot>({});

  const closeErrorPopup = useCallback(() => {
    const fieldName = errorPopup?.field;
    setErrorPopup(null);
    if (!fieldName) return;
    requestAnimationFrame(() => {
      const field = formRef.current?.elements.namedItem(fieldName);
      if (field instanceof HTMLElement) {
        field.focus({ preventScroll: true });
        field.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [errorPopup?.field]);

  useEffect(() => {
    if (!formState.error) return;
    const snapshot = snapshotRef.current;
    setErrorPopup({ message: formState.error, field: formState.field ?? undefined });
    setGstRegistered(Boolean(snapshot.is_gst_registered));
    setCityQuery(String(snapshot.city_search ?? snapshot.city ?? ""));
    setStateValue(String(snapshot.state ?? ""));
    setPostalCode(String(snapshot.postal_code ?? ""));
    const locationId = String(snapshot.india_location_id ?? "");
    const cityName = String(snapshot.city ?? snapshot.city_search ?? "");
    if (locationId) {
      setSelectedLocation({ id: locationId, city_name: cityName, district: null, state_name: String(snapshot.state ?? ""), pincode: String(snapshot.postal_code ?? "") });
    }
    requestAnimationFrame(() => {
      if (!formRef.current) return;
      for (const [name, value] of Object.entries(snapshot)) {
        const element = formRef.current.elements.namedItem(name);
        if (element instanceof HTMLInputElement) {
          if (element.type === "checkbox") element.checked = Boolean(value);
          else if (element.type !== "file") element.value = String(value);
        } else if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
          element.value = String(value);
        }
      }
    });
  }, [formState.error, formState.field]);

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
        if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [cityQuery, selectedLocation]);

  useEffect(() => {
    if (!isDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  const supported = partnerType === "individual_proprietor";
  const missingDocuments = (["pan_copy", "aadhaar_front", "aadhaar_back", ...(gstRegistered ? ["gst_copy"] : [])] as DocumentField[]).filter((name) => !documentFiles[name]);

  function captureForm(form: HTMLFormElement) {
    const snapshot: FormSnapshot = {};
    for (const element of Array.from(form.elements)) {
      if (element instanceof HTMLInputElement) {
        if (!element.name || element.type === "file") continue;
        snapshot[element.name] = element.type === "checkbox" ? element.checked : element.value;
      } else if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        if (element.name) snapshot[element.name] = element.value;
      }
    }
    snapshot.city = selectedLocation?.city_name ?? cityQuery;
    snapshot.india_location_id = selectedLocation?.id ?? "";
    snapshotRef.current = snapshot;
  }

  function submitWithFiles(formData: FormData) {
    for (const [field, file] of Object.entries(documentFiles) as Array<[DocumentField, File]>) formData.set(field, file, file.name);
    formAction(formData);
  }

  function updateDocument(field: DocumentField, file: File | null) {
    setDocumentFiles((current) => { const next = { ...current }; if (file) next[field] = file; else delete next[field]; return next; });
    setIsDirty(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    captureForm(form);
    setIsDirty(true);
    const panInput = form.elements.namedItem("pan_number");
    const pan = panInput instanceof HTMLInputElement ? panInput.value.replace(/\s/g, "").toUpperCase() : "";
    if (!PAN_PATTERN.test(pan)) {
      event.preventDefault();
      setErrorPopup({ message: "Enter a valid PAN number in the format ABCDE1234F.", field: "pan_number" });
      return;
    }
    if (missingDocuments.length && !warningAccepted) {
      event.preventDefault();
      setShowWarning(true);
    }
  }

  return (
    <>
      <AlertModal open={Boolean(errorPopup)} message={errorPopup?.message ?? ""} onClose={closeErrorPopup} autoCloseMs={5000} />
      <ConfirmModal open={showWarning} title="Save customer without all documents?" message="The customer will be saved with KYC incomplete status. Missing documents can be uploaded later from View / Edit Customer." confirmLabel="Save with warning" cancelLabel="Continue editing" onConfirm={() => { setShowWarning(false); setWarningAccepted(true); window.setTimeout(() => formRef.current?.requestSubmit(), 0); }} onCancel={() => setShowWarning(false)} />

      <div className="mx-auto max-w-[1240px] space-y-2 pb-20">
        <div className="flex items-center justify-between"><span className="rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">{partnerLabels[partnerType] ?? partnerType}</span><Link href="/customers?choose_partner=1" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">Change partner type</Link></div>
        {!supported ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center"><p className="text-[14px] font-semibold text-amber-900">{partnerLabels[partnerType]} onboarding is coming soon.</p><Link href="/customers?choose_partner=1" className="mt-4 inline-flex rounded-md bg-[#4F46E5] px-4 py-2 text-[11px] font-semibold text-white">Choose another partner type</Link></section> : (
          <form ref={formRef} action={submitWithFiles} onSubmit={handleSubmit} onChange={() => setIsDirty(true)} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <input type="hidden" name="partner_type" value={partnerType} />
            <FormSection title="Personal Information" columns="three"><Field label="Customer / Proprietor Name" name="contact_name" required error={formState.field === "contact_name"} placeholder="Enter customer name" /><Field label="Mobile Number" name="phone" required error={formState.field === "phone"} placeholder="10-digit mobile number" inputMode="tel" /><Field label="Email ID" name="email" type="email" placeholder="Optional email" /></FormSection>
            <FormSection title="Address Details" columns="five"><Field label="Street" name="address_street" required placeholder="House, building or street" /><Field label="Locality" name="address_locality" placeholder="Area or locality" /><div className="relative"><label className={labelClass} htmlFor="city_search">City *</label><input id="city_search" name="city_search" value={cityQuery} required autoComplete="off" className={fieldClass(formState.field === "city_search")} placeholder="City" onChange={(event) => { setCityQuery(event.target.value); setSelectedLocation(null); }} />{locations.length ? <div className="absolute z-30 mt-1 max-h-52 w-72 overflow-auto rounded-lg border border-[#D8DEE8] bg-white p-1 shadow-xl">{locations.map((location) => <button key={location.id} type="button" className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-[#F8FAFC]" onClick={() => { setSelectedLocation(location); setCityQuery(location.city_name); setStateValue(location.state_name); setPostalCode(location.pincode); setLocations([]); }}><span className="block text-[11px] font-semibold">{location.city_name}</span><span className="text-[10px] text-[#64748B]">{location.district ? `${location.district}, ` : ""}{location.state_name} · {location.pincode}</span></button>)}</div> : null}</div><Field label="State" name="state" required value={stateValue} onChange={(event) => setStateValue(event.target.value)} placeholder="State" /><Field label="PIN Code" name="postal_code" required value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="PIN" inputMode="numeric" maxLength={6} /><input type="hidden" name="india_location_id" value={selectedLocation?.id ?? ""} /><input type="hidden" name="city" value={selectedLocation?.city_name ?? cityQuery} /></FormSection>
            <FormSection title="KYC and GST Details" columns="four" action={<label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-[#334155]"><input type="checkbox" name="is_gst_registered" value="true" checked={gstRegistered} onChange={(event) => setGstRegistered(event.target.checked)} className="h-3.5 w-3.5" /> GST Registered</label>}><Field label="PAN Number" name="pan_number" required error={formState.field === "pan_number"} placeholder="ABCDE1234F" maxLength={10} onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase(); }} /><Field label="Aadhaar Number" name="aadhaar_number" required error={formState.field === "aadhaar_number"} placeholder="12-digit Aadhaar number" inputMode="numeric" maxLength={12} /><Field label="Legal Trade Name" name="legal_trade_name" required={gstRegistered} error={formState.field === "legal_trade_name"} placeholder={gstRegistered ? "As per GST certificate" : "Optional"} />{gstRegistered ? <Field label="GST Number" name="gst_number" required error={formState.field === "gst_number"} placeholder="22AAAAA0000A1Z5" maxLength={15} /> : <div />}</FormSection>
            <FormSection title="Documents" columns="four" compact><DocumentUpload label="PAN Copy" name="pan_copy" file={documentFiles.pan_copy} onChange={(file) => updateDocument("pan_copy", file)} /><DocumentUpload label="Aadhaar Front" name="aadhaar_front" file={documentFiles.aadhaar_front} onChange={(file) => updateDocument("aadhaar_front", file)} /><DocumentUpload label="Aadhaar Back" name="aadhaar_back" file={documentFiles.aadhaar_back} onChange={(file) => updateDocument("aadhaar_back", file)} />{gstRegistered ? <DocumentUpload label="GST Copy" name="gst_copy" file={documentFiles.gst_copy} onChange={(file) => updateDocument("gst_copy", file)} /> : <div />}</FormSection>
            <FormSection title="Fleet Details" columns="four"><div><label className={labelClass} htmlFor="fleet_size_band">Fleet Size *</label><select id="fleet_size_band" name="fleet_size_band" required className={fieldClass(formState.field === "fleet_size_band")}><option value="">Select fleet size</option><option value="less_than_5">Less than 5</option><option value="5_to_20">5–20</option><option value="20_to_50">20–50</option><option value="more_than_50">More than 50</option></select></div></FormSection>
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur"><Link href="/customers" className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155]">Cancel</Link><FormSubmitButton label="Create Customer" /></div>
          </form>
        )}
      </div>
    </>
  );
}

function FormSection({ title, action, children, compact = false, columns }: { title: string; action?: React.ReactNode; children: React.ReactNode; compact?: boolean; columns: GridColumns }) { const gridClass = columns === "five" ? "md:grid-cols-2 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(90px,.75fr)]" : columns === "four" ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3"; return <section className={`border-b border-[#E2E8F0] px-5 ${compact ? "py-3" : "py-4"} last:border-b-0`}><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-[13px] font-semibold text-[#0F172A]">{title}</h3>{action}</div><div className={`grid gap-x-3 gap-y-3 ${gridClass}`}>{children}</div></section>; }
function fieldClass(error = false) { return `${inputClass} ${error ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-100" : "border-[#CBD5E1] focus:border-[#4F46E5] focus:ring-[#E0E7FF]"}`; }
function Field({ label, name, required = false, error = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: boolean }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} aria-invalid={error || undefined} className={fieldClass(error)} {...props} /></div>; }
function DocumentUpload({ label, name, file, onChange }: { label: string; name: DocumentField; file?: File; onChange: (file: File | null) => void }) { return <div><span className={labelClass}>{label}</span><label htmlFor={name} className={`flex h-9 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[10.5px] ${file ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-dashed border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] hover:border-[#818CF8]"}`}><span>{file ? "✓" : "↥"}</span><span className="min-w-0 flex-1 truncate">{file?.name ?? "Choose file"}</span><span className="text-[9px] font-semibold">{file ? "Uploaded" : "Optional"}</span></label><input id={name} name={name} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => onChange(event.target.files?.[0] ?? null)} /></div>; }
