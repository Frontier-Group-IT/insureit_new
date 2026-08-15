"use client";

import Link from "next/link";
import { BadgeCheck, CalendarDays, CarFront, CircleAlert, CircleCheck, Phone, UserCheck, UserRound, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";

type Customer = { id: string; customer_code: string; contact_name: string; company_name: string | null; phone: string; email: string | null; partner_type: string | null; address_street: string | null; address_locality: string | null; address: string | null; city: string | null; state: string | null; postal_code: string | null; pan_number: string | null; aadhaar_last_four: string | null; legal_trade_name: string | null; is_gst_registered: boolean; gst_number: string | null; fleet_size_band: string | null; onboarding_status: string; assigned_agent_id: string | null; created_at: string; updated_at: string };
type DocumentRow = { id: string; document_type: string; file_name: string; verification_status: string; created_at: string; signedUrl: string | null };
type VehicleRow = { id: string; vehicle_no: string; vehicle_type: string; make: string | null; model: string | null };
type AgentOption = { id: string; full_name: string };
type Props = { customer: Customer; documents: DocumentRow[]; vehicles: VehicleRow[]; agents: AgentOption[]; internalOwnerName?: string; leadSourceName?: string; action: (formData: FormData) => void | Promise<void>; errorMessage?: string | null; errorField?: string | null };

const inputClass = "h-8 w-full rounded-md border border-[var(--border)] bg-white px-2.5 text-[11.5px] text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[#E8E8FF]";
const labelClass = "mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#68758A]";
const allDocumentTypes = ["pan_copy", "aadhaar_front", "aadhaar_back", "gst_copy"] as const;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
type DocumentType = (typeof allDocumentTypes)[number];

export function CustomerProfileEditor({ customer, documents, vehicles, agents, internalOwnerName: internalOwnerNameOverride, leadSourceName: leadSourceNameOverride, action, errorMessage, errorField }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [gstRegistered, setGstRegistered] = useState(customer.is_gst_registered);
  const [selectedFileNames, setSelectedFileNames] = useState<Partial<Record<DocumentType, string>>>({});
  const [validationPopup, setValidationPopup] = useState<{ message: string; field: string | null } | null>(
    errorMessage ? { message: errorMessage, field: errorField ?? null } : null
  );
  const requiredTypes = gstRegistered ? allDocumentTypes : allDocumentTypes.filter((type) => type !== "gst_copy");
  const documentMap = new Map(documents.map((document) => [document.document_type, document]));
  const internalOwnerName = internalOwnerNameOverride ?? (customer.assigned_agent_id
    ? agents.find((agent) => agent.id === customer.assigned_agent_id)?.full_name ?? "Not assigned"
    : "Not assigned");
  const leadSourceName = leadSourceNameOverride ?? "Not recorded";

  function handleDocumentSelection(type: DocumentType, file: File | null) {
    setSelectedFileNames((current) => {
      const next = { ...current };
      if (file) next[type] = file.name;
      else delete next[type];
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!gstRegistered) return;

    const formData = new FormData(event.currentTarget);
    const legalTradeName = String(formData.get("legal_trade_name") ?? "").trim();
    const gstNumber = String(formData.get("gst_number") ?? "").replace(/\s/g, "").toUpperCase();

    if (!legalTradeName) {
      event.preventDefault();
      setValidationPopup({ message: "Enter the Legal Trade Name before marking the customer as GST Registered.", field: "legal_trade_name" });
      return;
    }

    if (!gstNumber) {
      event.preventDefault();
      setValidationPopup({ message: "Enter the GST Number before marking the customer as GST Registered.", field: "gst_number" });
      return;
    }

    if (!GSTIN_PATTERN.test(gstNumber)) {
      event.preventDefault();
      setValidationPopup({ message: "Enter a valid 15-character GSTIN, for example 22AAAAA0000A1Z5.", field: "gst_number" });
    }
  }

  function closeValidationPopup() {
    const field = validationPopup?.field;
    setValidationPopup(null);
    window.setTimeout(() => {
      if (!field) return;
      const element = formRef.current?.elements.namedItem(field);
      if (element instanceof HTMLElement) {
        element.focus();
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  }

  return (
    <>
      {validationPopup ? <ValidationPopup message={validationPopup.message} onClose={closeValidationPopup} /> : null}
      <form ref={formRef} action={action} encType="multipart/form-data" onSubmit={handleSubmit} className="space-y-2 pb-5">
        <input type="hidden" name="partner_type" value={customer.partner_type ?? ""} />
        <input type="hidden" name="fleet_size_band" value={customer.fleet_size_band ?? ""} />
        <input type="hidden" name="onboarding_status" value={customer.onboarding_status} />
        <input type="hidden" name="assigned_agent_id" value={customer.assigned_agent_id ?? ""} />

        <section className="overflow-hidden rounded-2xl border border-[#173E7B] bg-gradient-to-br from-[#071D49] via-[#0A2B65] to-[#0C4A9A] text-white shadow-[0_18px_45px_rgba(7,29,73,.18)]">
          <div className="px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#315FEA] shadow-md">
                <UserRound className="h-5 w-5" strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-[18px] font-semibold tracking-[-0.01em] text-white">{customer.contact_name}</h2>
                  <StatusIcon status={customer.onboarding_status} />
                </div>
                {customer.company_name ? <p className="mt-0.5 text-[10.5px] font-medium text-blue-100">{customer.company_name}</p> : null}
              </div>
            </div>
          </div>

          <div className="grid border-t border-white/15 sm:grid-cols-2 xl:grid-cols-7" aria-label="Customer summary">
            <HeaderMetric icon={UserRound} label="Customer Type" value={partnerTypeLabel(customer.partner_type)} />
            <HeaderMetric icon={UserCheck} label="Internal Account Owner" value={internalOwnerName} />
            <HeaderMetric icon={BadgeCheck} label="Lead Source" value={leadSourceName} />
            <HeaderMetric icon={CarFront} label="Fleet Size" value={String(vehicles.length)} />
            <HeaderMetric icon={Phone} label="Mobile" value={customer.phone || "Not set"} />
            <HeaderMetric icon={BadgeCheck} label="Customer Code" value={customer.customer_code || "Not set"} />
            <HeaderMetric icon={CalendarDays} label="Active Since" value={formatDate(customer.created_at)} />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-[var(--shadow-panel)]">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <h3 className="text-[12px] font-semibold text-[var(--text)]">Personal Information</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Customer name" name="contact_name" defaultValue={customer.contact_name} required />
              <ReadOnlyField label="Login mobile" value={customer.phone} hint="Linked with OTP account" />
              <Field label="Email" name="email" type="email" defaultValue={customer.email ?? ""} />
            </div>
          </div>

          <div className="border-b border-[var(--border)] px-4 py-3">
            <h3 className="text-[12px] font-semibold text-[var(--text)]">Address Details</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Field label="Street" name="address_street" defaultValue={customer.address_street ?? ""} />
              <Field label="Locality" name="address_locality" defaultValue={customer.address_locality ?? ""} />
              <Field label="City" name="city" defaultValue={customer.city ?? ""} />
              <Field label="State" name="state" defaultValue={customer.state ?? ""} />
              <Field label="PIN code" name="postal_code" defaultValue={customer.postal_code ?? ""} />
            </div>
          </div>

          <div className="border-b border-[var(--border)] px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-[12px] font-semibold text-[var(--text)]">KYC and GST Details</h3>
              <label className="inline-flex items-center gap-2 text-[10.5px] font-semibold text-[#475569]">
                <input type="checkbox" name="is_gst_registered" value="true" checked={gstRegistered} onChange={(event) => setGstRegistered(event.target.checked)} className="h-3.5 w-3.5 rounded border-[#CBD5E1]" />
                GST Registered
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="PAN number" name="pan_number" defaultValue={customer.pan_number ?? ""} maxLength={10} uppercase />
              <ReadOnlyField label="Aadhaar" value={customer.aadhaar_last_four ? `**** ${customer.aadhaar_last_four}` : "Not available"} />
              <Field label="Legal trade name" name="legal_trade_name" defaultValue={customer.legal_trade_name ?? customer.company_name ?? ""} />
              {gstRegistered ? <Field label="GST number" name="gst_number" defaultValue={customer.gst_number ?? ""} maxLength={15} uppercase /> : null}
            </div>
          </div>

          <div id="documents" className="scroll-mt-20 border-b border-[var(--border)] bg-[#F7F8FF] px-4 py-3">
            <h3 className="text-[12px] font-semibold text-[var(--text)]">Documents</h3>
            <div className={`mt-3 grid gap-2.5 ${requiredTypes.length === 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3"}`}>
              {requiredTypes.map((type) => {
                const document = documentMap.get(type);
                const selectedFileName = selectedFileNames[type];
                const displayedFileName = selectedFileName ?? document?.file_name ?? "Not uploaded";
                return (
                  <div key={type} className="rounded-xl border border-[#E0E5EE] bg-white p-2.5 shadow-[0_3px_10px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#EEF1FF] text-[12px] text-[#315FEA]">↥</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10.5px] font-semibold text-[var(--text)]">{documentLabel(type)}</p>
                        <p className={`truncate text-[9px] ${selectedFileName ? "font-semibold text-[#4F46E5]" : "text-[var(--muted)]"}`}>{displayedFileName}</p>
                        {selectedFileName ? <p className="mt-0.5 text-[8px] font-semibold text-amber-700">Selected · save changes to upload</p> : null}
                      </div>
                      {selectedFileName ? <span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[8px] font-semibold text-indigo-700">Ready</span> : document ? <div className="text-right"><DocumentStatus status={document.verification_status} />{document.signedUrl ? <a href={document.signedUrl} target="_blank" rel="noreferrer" className="mt-1 block text-[9px] font-semibold text-[var(--accent)]">Open</a> : null}</div> : <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-700">Missing</span>}
                    </div>
                    <label className="mt-2 flex h-7 cursor-pointer items-center justify-center rounded-md border border-dashed border-[#C8D2E0] bg-white text-[9.5px] font-semibold text-[#475569] hover:border-[#6366F1] hover:text-[#4F46E5]">
                      {selectedFileName ? "Change selected file" : document ? "Replace document" : "Upload document"}
                      <input type="file" name={type} accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => handleDocumentSelection(type, event.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3">
            <Link href="/customers" className="inline-flex h-9 items-center justify-center rounded-md border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#334155] transition hover:bg-[#F8FAFC]">Back</Link>
            <FormSubmitButton label="Save changes" className="h-9 bg-[#315FEA] px-4 text-[10.5px] font-semibold text-white shadow-sm hover:bg-[#2851D9]" />
          </div>
        </section>
      </form>
    </>
  );
}

function HeaderMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <article className="flex min-w-0 items-center gap-2.5 border-b border-white/15 px-3 py-2.5 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(odd)]:border-white/15 xl:border-b-0 xl:border-r xl:border-white/15 xl:last:border-r-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-blue-100">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-[8px] font-semibold uppercase tracking-[0.07em] text-blue-200/85">{label}</p>
        <p className="mt-0.5 truncate text-[10.5px] font-semibold text-white" title={value}>{value}</p>
      </div>
    </article>
  );
}
function StatusIcon({ status }: { status: string }) {
  const active = status === "active";
  const Icon = active ? CircleCheck : CircleAlert;
  const label = active ? "Active" : "KYC incomplete";
  return <span title={label} aria-label={label} className={`inline-grid h-[18px] w-[18px] place-items-center rounded-full ${active ? "bg-emerald-500 text-white shadow-[0_0_0_2px_rgba(255,255,255,.18)]" : "border border-amber-300/60 bg-amber-300/15 text-amber-200"}`}><Icon className={active ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={active ? 2.5 : 2} /></span>;
}
function ValidationPopup({ message, onClose }: { message: string; onClose: () => void }) { return <div className="fixed inset-0 z-[160] grid place-items-center bg-[#0F172A]/35 px-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true" aria-labelledby="validation-title"><div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"><div className="flex items-start gap-3 border-b border-[#F1D7D7] bg-[#FFF7F7] px-5 py-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-100 text-[18px] text-red-700">!</span><div><h3 id="validation-title" className="text-[14px] font-semibold text-[#7F1D1D]">Complete GST details</h3><p className="mt-1 text-[11.5px] leading-5 text-[#9F3232]">{message}</p></div></div><div className="flex justify-end px-5 py-3"><button type="button" autoFocus onClick={onClose} className="inline-flex h-9 items-center justify-center rounded-md bg-[#4F46E5] px-4 text-[11px] font-semibold text-white shadow-sm hover:bg-[#4338CA]">Go to field</button></div></div></div>; }
function Field({ label, name, defaultValue = "", type = "text", required = false, maxLength, uppercase = false }: { label: string; name: string; defaultValue?: string; type?: string; required?: boolean; maxLength?: number; uppercase?: boolean }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} type={type} required={required} maxLength={maxLength} defaultValue={defaultValue} className={`${inputClass} ${uppercase ? "uppercase" : ""}`} onInput={uppercase ? (event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase(); } : undefined} /></div>; }
function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) { return <div><span className={labelClass}>{label}</span><div className="flex h-8 items-center justify-between rounded-md border border-[#E1E7EF] bg-[#F5F7FA] px-2.5 text-[11.5px] text-[#526176]"><span>{value}</span>{hint ? <span className="text-[8.5px] text-[#8A96A7]">{hint}</span> : null}</div></div>; }
function DocumentStatus({ status }: { status: string }) { const label = status === "verified" ? "Verified" : status === "rejected" ? "Rejected" : "Uploaded · Pending verification"; return <span className={`inline-flex max-w-[132px] items-center justify-center rounded-full border px-1.5 py-0.5 text-center text-[8px] font-semibold leading-tight ${status === "verified" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "rejected" ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{label}</span>; }
function documentLabel(type: string) { return ({ pan_copy: "PAN Copy", aadhaar_front: "Aadhaar Front", aadhaar_back: "Aadhaar Back", gst_copy: "GST Copy" } as Record<string,string>)[type] ?? type.replaceAll("_", " "); }
function partnerTypeLabel(value: string | null) { return ({ individual_proprietor: "Individual / Proprietor", dealership: "Dealership", corporate: "Corporate", group: "Group", posp: "POSP", misp: "MISP" } as Record<string,string>)[value ?? ""] ?? (value ? value.replaceAll("_", " ") : "Not set"); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date); }
