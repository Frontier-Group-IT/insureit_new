"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { freshDynamicRouteUrl } from "@/components/fresh-dynamic-route-navigation";
import { IndianDateField } from "@/components/indian-date-field";
import { inlineFieldErrorId } from "@/components/inline-field-validation";
import type { PospMispState } from "./actions";

type PartnerType = "posp" | "misp";
type CreateState = PospMispState & { applicationId?: string | null };
type SelectOption = { value: string; label: string };
type Props = {
  action: (state: CreateState, data: FormData) => Promise<CreateState>;
  submitPath?: string;
  partnerType: PartnerType;
  initialError?: string | null;
  initialField?: string | null;
  initialValues?: Record<string, string>;
  salesManagers: SelectOption[];
  oems: SelectOption[];
  banks: SelectOption[];
  legacyFields?: ReactNode;
};

const inputClass = "h-11 w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF] aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50/40 aria-[invalid=true]:focus:border-red-500 aria-[invalid=true]:focus:ring-red-100";
const dateInputClass = inputClass;
const labelClass = "mb-1.5 block text-[10.5px] font-semibold text-[#344054]";

export function PospMispOnboardingForm({ action, submitPath, partnerType, initialError = null, initialField = null, initialValues = {}, salesManagers, oems, banks, legacyFields = null }: Props) {
  const [state, formAction] = useActionState(action, { error: null, field: null, applicationId: null });
  const [rmValue, setRmValue] = useState(initialValues.associate_employee_id ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const isMisp = partnerType === "misp";
  const backHref = isMisp ? "/intermediaries/misp" : "/intermediaries/posp";

  useEffect(() => {
    if (state.applicationId && !state.error) {
      window.location.replace(freshDynamicRouteUrl(`/intermediaries/applications/${state.applicationId}/workflow?stage=documents&success=primary_details_saved`));
    }
  }, [state.applicationId, state.error]);

  useEffect(() => {
    const fieldName = state.field ?? initialField;
    if (!fieldName) return;
    const field = formRef.current?.elements.namedItem(fieldName);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
    requestAnimationFrame(() => {
      field.focus({ preventScroll: true });
      field.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [initialField, state.field]);

  const visibleError = state.error ?? initialError;

  return <>
    <div className="w-full space-y-3 pb-20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="w-fit rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">New {partnerType.toUpperCase()} Application</span>
        <div className="flex gap-3"><Link href="/customers/posp-misp/import" className="text-[10.5px] font-semibold text-[#4F46E5]">Import Excel</Link><Link href={backHref} className="text-[10.5px] font-semibold text-[#4F46E5]">Back</Link></div>
      </div>
      {visibleError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">{visibleError}</div> : null}
      <form ref={formRef} action={submitPath ?? formAction} method={submitPath ? "post" : undefined} noValidate className="w-full overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <input type="hidden" name="partner_type" value={partnerType} />
        <header className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3 sm:px-5 sm:py-4"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#071D49] text-[10px] font-bold text-white">1</span><div><h2 className="text-[14px] font-semibold text-[#0F172A]">Primary information & PAN check</h2><p className="mt-0.5 text-[10px] leading-4 text-[#64748B]">The POSP/MISP ID is issued only after successful onboarding. A Partner ID is issued after Stage 2 documents are submitted.</p></div></div></header>
        <Section title={isMisp ? "MISP details" : "POSP details"}>
          <div className={`grid min-w-0 gap-3 md:grid-cols-2 xl:col-span-4 ${isMisp ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}><SelectField label="RM Name" name="associate_employee_id" required options={salesManagers} placeholder="Select RM" value={rmValue} onChange={event => setRmValue(event.target.value)} />{isMisp ? <Field label="MISP Name" name="misp_name" required defaultValue={initialValues.misp_name} /> : null}<PanInput label={isMisp ? "MISP PAN" : "PAN Number"} name="pan_number" compact defaultValue={initialValues.pan_number} /><IndianDateField label="Document Received Date" name="document_received_at" defaultValue={initialValues.document_received_at} inputClassName={dateInputClass} /></div>
          {!isMisp ? <div className="grid min-w-0 gap-3 md:grid-cols-3 xl:col-span-4"><Field label="POS First Name" name="pos_first_name" required defaultValue={initialValues.pos_first_name} /><Field label="POS Middle Name" name="pos_middle_name" defaultValue={initialValues.pos_middle_name} /><Field label="POS Last Name" name="pos_last_name" required defaultValue={initialValues.pos_last_name} /></div> : null}
          {isMisp ? <SelectField label="OEM Name" name="oem_name" required options={oems} placeholder="Select OEM" defaultValue={initialValues.oem_name} /> : null}
          <Field label="Address" name="address" required defaultValue={initialValues.address} /><Field label="City" name="city" required defaultValue={initialValues.city} /><Field label="State" name="state" required defaultValue={initialValues.state} /><Field label="PIN Code" name="postal_code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} defaultValue={initialValues.postal_code} />
        </Section>
        {!isMisp ? <Section title="POSP contact"><Field label="Mobile Number" name="applicant_phone" required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" defaultValue={initialValues.applicant_phone} /><Field label="Email" name="applicant_email" type="email" required defaultValue={initialValues.applicant_email} /><IndianDateField label="Date of Birth" name="date_of_birth" required defaultValue={initialValues.date_of_birth} inputClassName={dateInputClass} /><Field label="Aadhaar Number" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} defaultValue={initialValues.aadhaar_number} /></Section> : null}
        {isMisp ? <Section title="Designated Person (DP)"><Field label="DP First Name" name="dp_first_name" required defaultValue={initialValues.dp_first_name} /><Field label="DP Middle Name" name="dp_middle_name" defaultValue={initialValues.dp_middle_name} /><Field label="DP Last Name" name="dp_last_name" required defaultValue={initialValues.dp_last_name} /><Field label="DP Contact" name="dp_phone" required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" defaultValue={initialValues.dp_phone} /><Field label="DP Email" name="dp_email" required type="email" defaultValue={initialValues.dp_email} /><PanInput label="DP PAN No" name="dp_pan_number" defaultValue={initialValues.dp_pan_number} /><IndianDateField label="DP Date of Birth" name="date_of_birth" required defaultValue={initialValues.date_of_birth} inputClassName={dateInputClass} /><Field label="DP Aadhaar Number" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} defaultValue={initialValues.aadhaar_number} /></Section> : null}
        <Section title="Bank details"><SelectField label="Bank Name" name="bank_id" required options={banks} placeholder="Select bank" defaultValue={initialValues.bank_id} /><Field label="Account Number" name="bank_account_number" required inputMode="numeric" pattern="[0-9]{6,20}" defaultValue={initialValues.bank_account_number} /><Field label="IFSC Code" name="bank_ifsc_code" required maxLength={11} minLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" transform="uppercase" defaultValue={initialValues.bank_ifsc_code} /><Field label="GST Number" name="gst_number" required={isMisp} maxLength={15} minLength={isMisp ? 15 : undefined} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" transform="uppercase" defaultValue={initialValues.gst_number} /></Section>
        {legacyFields}
        <div className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-[#E2E8F0] bg-white/96 px-3 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-[9.5px] text-[#64748B]">Stage 1 saves the application, queues the PAN check and opens Documents.</p>{submitPath ? <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4285F4] px-5 py-2.5 text-[11px] font-semibold text-white sm:w-auto">Save & check PAN</button> : <FormSubmitButton label="Save & check PAN" pendingLabel="Saving & opening Documents" className="w-full rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4285F4] px-5 py-2.5 text-[11px] font-semibold text-white sm:w-auto" />}</div>
      </form>
    </div>
  </>;
}

function PanInput({ label, name, compact = false, defaultValue }: { label: string; name: string; compact?: boolean; defaultValue?: string }) {
  const errorId = inlineFieldErrorId(name);
  return <div data-field-container className={`min-w-0 ${compact ? "" : "xl:col-span-2"}`}><label className={labelClass} htmlFor={name}>{label} *</label><input id={name} name={name} defaultValue={defaultValue} required pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" maxLength={10} minLength={10} onInput={event => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); }} className={`${inputClass} font-mono tracking-[0.03em]`} /><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold text-red-600" /></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-[#E2E8F0] px-3 py-4 sm:px-5 sm:py-5"><h3 className="mb-4 text-[12px] font-semibold text-[#0F172A]">{title}</h3><div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function Field({ label, name, required = false, transform, onInput, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; transform?: "uppercase" }) {
  const errorId = inlineFieldErrorId(name);
  return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} className={inputClass} onInput={event => { if (transform === "uppercase") event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); onInput?.(event); }} {...props} /><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold text-red-600" /></div>;
}
function SelectField({ label, name, required = false, options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: SelectOption[]; placeholder: string }) {
  const errorId = inlineFieldErrorId(name);
  return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} required={required} className={inputClass} {...props}><option value="">{placeholder}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><p id={errorId} data-field-error hidden className="mt-1.5 text-[9.5px] font-semibold text-red-600" /></div>;
}
