"use client";

import Link from "next/link";
import { useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";

type Customer = { id: string; customer_code: string; contact_name: string; company_name: string | null; phone: string; email: string | null; partner_type: string | null; address_street: string | null; address_locality: string | null; address: string | null; city: string | null; state: string | null; postal_code: string | null; pan_number: string | null; aadhaar_last_four: string | null; legal_trade_name: string | null; is_gst_registered: boolean; gst_number: string | null; fleet_size_band: string | null; onboarding_status: string; assigned_agent_id: string | null; created_at: string; updated_at: string };
type DocumentRow = { id: string; document_type: string; file_name: string; verification_status: string; created_at: string; signedUrl: string | null };
type VehicleRow = { id: string; vehicle_no: string; vehicle_type: string; make: string | null; model: string | null };
type AgentOption = { id: string; full_name: string };
type Props = { customer: Customer; documents: DocumentRow[]; vehicles: VehicleRow[]; agents: AgentOption[]; action: (formData: FormData) => void | Promise<void> };

const inputClass = "h-8 w-full rounded-md border border-[var(--border)] bg-white px-2.5 text-[11.5px] text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[#E8E8FF]";
const labelClass = "mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#68758A]";
const allDocumentTypes = ["pan_copy", "aadhaar_front", "aadhaar_back", "gst_copy"] as const;
type DocumentType = (typeof allDocumentTypes)[number];

export function CustomerProfileEditor({ customer, documents, vehicles, agents, action }: Props) {
  const [gstRegistered, setGstRegistered] = useState(customer.is_gst_registered);
  const [selectedFileNames, setSelectedFileNames] = useState<Partial<Record<DocumentType, string>>>({});
  const requiredTypes = gstRegistered ? allDocumentTypes : allDocumentTypes.filter((type) => type !== "gst_copy");
  const documentMap = new Map(documents.map((document) => [document.document_type, document]));

  function handleDocumentSelection(type: DocumentType, file: File | null) {
    setSelectedFileNames((current) => {
      const next = { ...current };
      if (file) next[type] = file.name;
      else delete next[type];
      return next;
    });
  }

  return (
    <form action={action} encType="multipart/form-data" className="space-y-2 pb-5">
      <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-[var(--border)] bg-white px-3 py-2.5 shadow-[var(--shadow-panel)] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-[16px] font-semibold text-[var(--text)]">{customer.contact_name}</h2><StatusPill status={customer.onboarding_status} /></div><p className="mt-0.5 text-[10.5px] text-[var(--muted)]">{customer.phone}{customer.company_name ? ` · ${customer.company_name}` : ""}</p></div>
        <div className="flex items-center gap-1.5"><Link href="/customers" className="inline-flex h-8 items-center rounded-md border border-[var(--border)] bg-white px-3 text-[10.5px] font-semibold text-[var(--text)] hover:bg-[#F8FAFD]">Back</Link><FormSubmitButton label="Save changes" /></div>
      </section>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-2">
          <Panel title="Customer profile"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3"><Field label="Customer name" name="contact_name" defaultValue={customer.contact_name} required /><ReadOnlyField label="Login mobile" value={customer.phone} hint="Linked with OTP account" /><Field label="Email" name="email" type="email" defaultValue={customer.email ?? ""} /><SelectField label="Partner type" name="partner_type" defaultValue={customer.partner_type ?? "individual_proprietor"} options={[["individual_proprietor","Individual / Proprietor"],["dealership","Dealership"],["corporate","Corporate"],["group","Group"]]} /><SelectField label="Fleet size" name="fleet_size_band" defaultValue={customer.fleet_size_band ?? ""} options={[["","Select fleet size"],["less_than_5","Less than 5"],["5_to_20","5–20"],["20_to_50","20–50"],["more_than_50","More than 50"]]} /><SelectField label="Onboarding status" name="onboarding_status" defaultValue={customer.onboarding_status} options={[["active","Active"],["documents_pending","KYC incomplete"],["inactive","Inactive"]]} /><SelectField label="Assigned agent" name="assigned_agent_id" defaultValue={customer.assigned_agent_id ?? ""} options={[["","No assigned agent"],...agents.map((agent) => [agent.id, agent.full_name] as [string,string])]} /></div></Panel>
          <Panel title="Address"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5"><Field label="Street" name="address_street" defaultValue={customer.address_street ?? ""} /><Field label="Locality" name="address_locality" defaultValue={customer.address_locality ?? ""} /><Field label="City" name="city" defaultValue={customer.city ?? ""} /><Field label="State" name="state" defaultValue={customer.state ?? ""} /><Field label="PIN code" name="postal_code" defaultValue={customer.postal_code ?? ""} /><div className="md:col-span-2 xl:col-span-5"><label className={labelClass} htmlFor="address">Full address</label><textarea id="address" name="address" rows={2} defaultValue={customer.address ?? ""} className="w-full rounded-md border border-[var(--border)] bg-white px-2.5 py-2 text-[11.5px] text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[#E8E8FF]" /></div></div></Panel>
          <Panel title="KYC and tax details"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4"><Field label="PAN number" name="pan_number" defaultValue={customer.pan_number ?? ""} maxLength={10} uppercase /><ReadOnlyField label="Aadhaar" value={customer.aadhaar_last_four ? `XXXX XXXX ${customer.aadhaar_last_four}` : "Not available"} /><Field label="Legal trade name" name="legal_trade_name" defaultValue={customer.legal_trade_name ?? customer.company_name ?? ""} /><div className="flex items-end"><label className="flex h-8 w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[#F8FAFC] px-2.5 text-[10.5px] font-semibold text-[var(--text)]"><input type="checkbox" name="is_gst_registered" value="true" checked={gstRegistered} onChange={(event) => setGstRegistered(event.target.checked)} className="h-3 w-3" />GST registered</label></div>{gstRegistered ? <Field label="GST number" name="gst_number" defaultValue={customer.gst_number ?? ""} maxLength={15} uppercase /> : null}</div></Panel>
        </div>

        <aside className="space-y-2">
          <Panel title={`Documents (${documents.length})`} id="documents">
            <div className="space-y-2">
              {requiredTypes.map((type) => {
                const document = documentMap.get(type);
                const selectedFileName = selectedFileNames[type];
                const displayedFileName = selectedFileName ?? document?.file_name ?? "Not uploaded";
                return (
                  <div key={type} className="rounded-md border border-[#E3E9F1] bg-[#FAFBFD] p-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#ECEEFF] text-[12px]">↥</span>
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
          </Panel>
          <Panel title={`Vehicles (${vehicles.length})`}><div className="space-y-1.5">{vehicles.length ? vehicles.map((vehicle) => <div key={vehicle.id} className="rounded-md border border-[#E3E9F1] bg-[#FAFBFD] px-2.5 py-2"><p className="text-[10.5px] font-semibold text-[var(--text)]">{vehicle.vehicle_no}</p><p className="mt-0.5 text-[9.5px] text-[var(--muted)]">{[vehicle.make, vehicle.model, vehicle.vehicle_type].filter(Boolean).join(" · ")}</p></div>) : <EmptyText text="No vehicles linked yet." />}</div></Panel>
          <Panel title="Record information"><dl className="space-y-2 text-[10px]"><Info label="Customer code" value={customer.customer_code} /><Info label="Created" value={formatDate(customer.created_at)} /><Info label="Last updated" value={formatDate(customer.updated_at)} /></dl></Panel>
        </aside>
      </div>
    </form>
  );
}

function Panel({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) { return <section id={id} className="scroll-mt-20 rounded-[var(--radius-panel)] border border-[var(--border)] bg-white shadow-[var(--shadow-panel)]"><div className="border-b border-[var(--border)] px-3 py-2"><h3 className="text-[11.5px] font-semibold text-[var(--text)]">{title}</h3></div><div className="p-3">{children}</div></section>; }
function Field({ label, name, defaultValue = "", type = "text", required = false, maxLength, uppercase = false }: { label: string; name: string; defaultValue?: string; type?: string; required?: boolean; maxLength?: number; uppercase?: boolean }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} type={type} required={required} maxLength={maxLength} defaultValue={defaultValue} className={`${inputClass} ${uppercase ? "uppercase" : ""}`} onInput={uppercase ? (event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase(); } : undefined} /></div>; }
function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: [string,string][] }) { return <div><label className={labelClass} htmlFor={name}>{label}</label><select id={name} name={name} defaultValue={defaultValue} className={inputClass}>{options.map(([value,text]) => <option key={`${name}-${value}`} value={value}>{text}</option>)}</select></div>; }
function ReadOnlyField({ label, value, hint }: { label: string; value: string; hint?: string }) { return <div><span className={labelClass}>{label}</span><div className="flex h-8 items-center justify-between rounded-md border border-[#E1E7EF] bg-[#F5F7FA] px-2.5 text-[11.5px] text-[#526176]"><span>{value}</span>{hint ? <span className="text-[8.5px] text-[#8A96A7]">{hint}</span> : null}</div></div>; }
function StatusPill({ status }: { status: string }) { const active = status === "active"; return <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{active ? "active" : "KYC incomplete"}</span>; }
function DocumentStatus({ status }: { status: string }) { const label = status === "verified" ? "Verified" : status === "rejected" ? "Rejected" : "Uploaded · Pending verification"; return <span className={`inline-flex max-w-[132px] items-center justify-center rounded-full border px-1.5 py-0.5 text-center text-[8px] font-semibold leading-tight ${status === "verified" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "rejected" ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{label}</span>; }
function documentLabel(type: string) { return ({ pan_copy: "PAN Copy", aadhaar_front: "Aadhaar Front", aadhaar_back: "Aadhaar Back", gst_copy: "GST Copy" } as Record<string,string>)[type] ?? type.replaceAll("_", " "); }
function EmptyText({ text }: { text: string }) { return <p className="rounded-md border border-dashed border-[#D8E0EA] px-3 py-5 text-center text-[9.5px] text-[var(--muted)]">{text}</p>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3"><dt className="text-[var(--muted)]">{label}</dt><dd className="text-right font-semibold text-[var(--text)]">{value}</dd></div>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date); }
