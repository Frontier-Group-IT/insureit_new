"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { AlertModal } from "@/components/ui-feedback";
import type { DealershipEditState } from "./dealership-actions";

type Option = { value: string; label: string };
type DocumentItem = { id: string; document_type: string; file_name: string; signedUrl: string | null };
type Contact = { contact_role: string; contact_name: string | null; mobile: string | null; email: string | null };
type Values = {
  dealership_type: "posp" | "misp"; dealership_name: string; owner_name: string; phone: string; email: string | null;
  address_street: string | null; address_locality: string | null; city: string | null; state: string | null; postal_code: string | null;
  india_location_id: string | null; oem_name: string | null; yearly_sales_band: string | null; is_gst_registered: boolean; gst_number: string | null;
  representative_name: string; representative_mobile: string; representative_email: string | null; representative_pan: string | null; aadhaar_last_four: string | null;
};
type Props = { action: (state: DealershipEditState, formData: FormData) => Promise<DealershipEditState>; values: Values; contacts: Contact[]; documents: DocumentItem[]; oems: Option[] };
type FileKey = "gst_copy" | "representative_aadhaar_front" | "representative_aadhaar_back" | "representative_pan_copy";

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";
const documentTypes: Record<FileKey, string> = { gst_copy: "gst_copy", representative_aadhaar_front: "aadhaar_front", representative_aadhaar_back: "aadhaar_back", representative_pan_copy: "pan_copy" };

export function DealershipProfileEditor({ action, values, contacts, documents, oems }: Props) {
  const [state, formAction] = useActionState(action, { error: null, field: null });
  const [showError, setShowError] = useState(false);
  const [gstRegistered, setGstRegistered] = useState(values.is_gst_registered);
  const [files, setFiles] = useState<Partial<Record<FileKey, File>>>({});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => { setShowError(Boolean(state.error)); if (!state.field) return; requestAnimationFrame(() => { const field = formRef.current?.elements.namedItem(state.field ?? ""); if (field instanceof HTMLElement) { field.focus(); field.scrollIntoView({ behavior: "smooth", block: "center" }); } }); }, [state.error, state.field]);

  function submit(formData: FormData) { for (const [field, selected] of Object.entries(files) as Array<[FileKey, File]>) formData.set(field, selected, selected.name); formAction(formData); }
  function contact(role: string) { return contacts.find((item) => item.contact_role === role); }
  function currentDocument(field: FileKey) { return documents.find((item) => item.document_type === documentTypes[field]); }
  function setFile(field: FileKey, selected: File | null) { setFiles((current) => { const next = { ...current }; if (selected) next[field] = selected; else delete next[field]; return next; }); }
  const representativeLabel = values.dealership_type === "posp" ? "POSP" : "DP";

  return <>
    {state.error && showError ? <AlertModal open title="Unable to save dealership" message={state.error} tone="error" onClose={() => setShowError(false)} /> : null}
    <div className="mx-auto max-w-[1240px] space-y-2 pb-20">
      <div className="flex items-center justify-between"><div className="flex gap-2"><span className="rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">Dealership</span><span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[10.5px] font-semibold text-[#4338CA]">{values.dealership_type.toUpperCase()}</span></div></div>
      <form ref={formRef} action={submit} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <input type="hidden" name="dealership_type" value={values.dealership_type} />
        <input type="hidden" name="india_location_id" value={values.india_location_id ?? ""} />

        <Section title="Dealership Details"><Field label="Dealership Name" name="dealership_name" required defaultValue={values.dealership_name} /><Field label="Owner Name" name="owner_name" required defaultValue={values.owner_name} /><Field label="Mobile Number" name="phone" required defaultValue={values.phone.replace(/^\+91/, "")} inputMode="tel" maxLength={10} /><Field label="Email ID" name="email" type="email" defaultValue={values.email ?? ""} /></Section>
        <Section title="Address"><Field label="Street" name="address_street" required defaultValue={values.address_street ?? ""} /><Field label="Locality" name="address_locality" defaultValue={values.address_locality ?? ""} /><Field label="City" name="city" required defaultValue={values.city ?? ""} /><Field label="State" name="state" required defaultValue={values.state ?? ""} /><Field label="PIN Code" name="postal_code" required defaultValue={values.postal_code ?? ""} inputMode="numeric" maxLength={6} /></Section>
        <Section title="Business Profile"><Select label="Dealership OEM" name="oem_name" required options={oems} defaultValue={values.oem_name ?? ""} /><Select label="Yearly Sales" name="yearly_sales_band" required options={[{ value: "less_than_500", label: "Less than 500" }, { value: "500_to_1000", label: "500–1000" }, { value: "more_than_1000", label: "More than 1000" }]} defaultValue={values.yearly_sales_band ?? ""} /></Section>
        <Section title="GST Details" action={<label className="inline-flex items-center gap-2 text-[11px] font-semibold"><input type="checkbox" name="is_gst_registered" value="true" checked={gstRegistered} onChange={(event) => setGstRegistered(event.target.checked)} /> GST Registered</label>}><Field label="GST Number" name="gst_number" required={gstRegistered} defaultValue={values.gst_number ?? ""} maxLength={15} /><DocumentField label="GST Certificate" name="gst_copy" file={files.gst_copy} current={currentDocument("gst_copy")} onChange={(file) => setFile("gst_copy", file)} /></Section>
        <Section title={`${representativeLabel} Information`}><Field label={`${representativeLabel} Name`} name="representative_name" required defaultValue={values.representative_name} /><Field label="Mobile Number" name="representative_mobile" required defaultValue={values.representative_mobile.replace(/^\+91/, "")} inputMode="tel" maxLength={10} /><Field label="Email ID" name="representative_email" type="email" defaultValue={values.representative_email ?? ""} /><Field label="Aadhaar Number" name="representative_aadhaar" placeholder={values.aadhaar_last_four ? `Existing Aadhaar ending ${values.aadhaar_last_four}; enter only to replace` : "12-digit Aadhaar"} inputMode="numeric" maxLength={12} /><DocumentField label="Aadhaar Front" name="representative_aadhaar_front" file={files.representative_aadhaar_front} current={currentDocument("representative_aadhaar_front")} onChange={(file) => setFile("representative_aadhaar_front", file)} /><DocumentField label="Aadhaar Back" name="representative_aadhaar_back" file={files.representative_aadhaar_back} current={currentDocument("representative_aadhaar_back")} onChange={(file) => setFile("representative_aadhaar_back", file)} /><Field label="PAN Card Number" name="representative_pan" defaultValue={values.representative_pan ?? ""} maxLength={10} /><DocumentField label="PAN Card Copy" name="representative_pan_copy" file={files.representative_pan_copy} current={currentDocument("representative_pan_copy")} onChange={(file) => setFile("representative_pan_copy", file)} /></Section>

        <section className="border-b border-[#E2E8F0] px-5 py-4"><h3 className="mb-3 text-[13px] font-semibold">Additional Contact Information</h3><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[11px]"><thead className="bg-[#F8FAFC] text-[9.5px] uppercase text-[#64748B]"><tr><th className="px-3 py-2">Role</th><th>Name</th><th>Mobile</th><th>Email</th></tr></thead><tbody>{[["sales_head","Sales Head"],["bodyshop_head","Bodyshop Head"],["insurance_head","Insurance Head"],["insurance_spoc","Insurance SPOC"]].map(([role,label]) => { const row = contact(role); return <tr key={role} className="border-t border-[#EEF2F6]"><td className="px-3 py-2 font-semibold">{label}</td><td className="px-2"><input name={`${role}_name`} defaultValue={row?.contact_name ?? ""} className={inputClass} /></td><td className="px-2"><input name={`${role}_mobile`} defaultValue={(row?.mobile ?? "").replace(/^\+91/, "")} className={inputClass} inputMode="tel" maxLength={10} /></td><td className="px-2"><input name={`${role}_email`} defaultValue={row?.email ?? ""} className={inputClass} type="email" /></td></tr>; })}</tbody></table></div></section>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3"><Link href="/customers" className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold">Cancel</Link><FormSubmitButton label="Save Dealership" /></div>
      </form>
    </div>
  </>;
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="border-b border-[#E2E8F0] px-5 py-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-[13px] font-semibold">{title}</h3>{action}</div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function Field({ label, name, required = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) { return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} className={inputClass} {...props} /></div>; }
function Select({ label, name, options, defaultValue, required = false }: { label: string; name: string; options: Option[]; defaultValue: string; required?: boolean }) { return <div><label className={labelClass}>{label}{required ? " *" : ""}</label><select name={name} required={required} defaultValue={defaultValue} className={inputClass}><option value="">Select</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; }
function DocumentField({ label, name, file, current, onChange }: { label: string; name: FileKey; file?: File; current?: DocumentItem; onChange: (file: File | null) => void }) { return <div><span className={labelClass}>{label}</span>{current ? <div className="mb-1 flex items-center justify-between text-[9.5px]"><a href={current.signedUrl ?? "#"} target="_blank" rel="noreferrer" className="truncate font-semibold text-[#4F46E5]">{current.file_name}</a><span className="text-emerald-700">Saved</span></div> : null}<label htmlFor={name} className={`flex h-9 cursor-pointer items-center rounded-md border px-2.5 text-[10.5px] ${file ? "border-emerald-300 bg-emerald-50" : "border-dashed border-[#CBD5E1] bg-[#F8FAFC]"}`}><span className="truncate">{file?.name ?? (current ? "Replace file" : "Choose file")}</span></label><input id={name} name={name} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(event) => onChange(event.target.files?.[0] ?? null)} /></div>; }
