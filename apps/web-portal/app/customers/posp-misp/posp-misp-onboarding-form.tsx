"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { freshDynamicRouteUrl } from "@/components/fresh-dynamic-route-navigation";
import { IndianDateField } from "@/components/indian-date-field";
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
};

const inputClass = "h-11 w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const dateInputClass = inputClass;
const labelClass = "mb-1.5 block text-[10.5px] font-semibold text-[#344054]";

export function PospMispOnboardingForm({ action, submitPath, partnerType, initialError = null, initialField = null, initialValues = {}, salesManagers, oems, banks }: Props) {
  const [state, formAction] = useActionState(action, { error: null, field: null, applicationId: null });
  const [clientError, setClientError] = useState<string | null>(null);
  const [rmValue, setRmValue] = useState(initialValues.associate_employee_id ?? "");
  const [posting, setPosting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const isMisp = partnerType === "misp";
  const manualValidation = Boolean(submitPath);
  const backHref = isMisp ? "/intermediaries/misp" : "/intermediaries/posp";

  useEffect(() => {
    if (state.applicationId && !state.error) {
      window.location.replace(freshDynamicRouteUrl(`/intermediaries/applications/${state.applicationId}/workflow?stage=documents&success=primary_details_saved`));
      return;
    }
  }, [initialError, initialField, state.applicationId, state.error, state.field]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (submitPath) return;
    validateForSubmit(event.currentTarget, event);
  }

  function handleRouteSubmit() {
    const form = formRef.current;
    if (!form || posting) return;
    setPosting(true);
    form.submit();
  }

  function validateForSubmit(form: HTMLFormElement, event?: React.FormEvent<HTMLFormElement>) {
    const invalidField = firstInvalidControl(form);
    if (!invalidField) {
      setClientError(null);
      return true;
    }
    event?.preventDefault();
    setClientError(validationMessage(invalidField));
    requestAnimationFrame(() => {
      invalidField.focus({ preventScroll: true });
      invalidField.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return false;
  }

  const visibleError = clientError ?? state.error ?? initialError;

  return <>
    <div className="w-full space-y-3 pb-20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="w-fit rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">New {partnerType.toUpperCase()} Application</span>
        <div className="flex gap-3"><Link href="/customers/posp-misp/import" className="text-[10.5px] font-semibold text-[#4F46E5]">Import Excel</Link><Link href={backHref} className="text-[10.5px] font-semibold text-[#4F46E5]">Back</Link></div>
      </div>
      {visibleError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">{visibleError}</div> : null}
      <form ref={formRef} action={submitPath ?? formAction} method={submitPath ? "post" : undefined} onSubmitCapture={handleSubmit} noValidate className="w-full overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <input type="hidden" name="partner_type" value={partnerType} />
        <header className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3 sm:px-5 sm:py-4"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#071D49] text-[10px] font-bold text-white">1</span><div><h2 className="text-[14px] font-semibold text-[#0F172A]">Primary information & PAN check</h2><p className="mt-0.5 text-[10px] leading-4 text-[#64748B]">The POSP/MISP ID is issued only after successful onboarding. A Partner ID is issued after Stage 2 documents are submitted.</p></div></div></header>
        <Section title={isMisp ? "MISP details" : "POSP details"}>
          <div className={`grid min-w-0 gap-3 md:grid-cols-2 xl:col-span-4 ${isMisp ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}><SelectField label="RM Name" name="associate_employee_id" required manualValidation={manualValidation} options={salesManagers} placeholder="Select RM" value={rmValue} onChange={event => { setRmValue(event.target.value); setClientError(null); }} />{isMisp ? <Field label="MISP Name" name="misp_name" required manualValidation={manualValidation} defaultValue={initialValues.misp_name} /> : null}<PanInput label={isMisp ? "MISP PAN" : "PAN Number"} name="pan_number" compact manualValidation={manualValidation} defaultValue={initialValues.pan_number} /><IndianDateField label="Document Received Date" name="document_received_at" defaultValue={initialValues.document_received_at} inputClassName={dateInputClass} /></div>
          {!isMisp ? <div className="grid min-w-0 gap-3 md:grid-cols-3 xl:col-span-4"><Field label="POS First Name" name="pos_first_name" required manualValidation={manualValidation} defaultValue={initialValues.pos_first_name} /><Field label="POS Middle Name" name="pos_middle_name" manualValidation={manualValidation} defaultValue={initialValues.pos_middle_name} /><Field label="POS Last Name" name="pos_last_name" required manualValidation={manualValidation} defaultValue={initialValues.pos_last_name} /></div> : null}
          {isMisp ? <SelectField label="OEM Name" name="oem_name" required manualValidation={manualValidation} options={oems} placeholder="Select OEM" defaultValue={initialValues.oem_name} /> : null}
          <Field label="Address" name="address" required manualValidation={manualValidation} defaultValue={initialValues.address} /><Field label="City" name="city" required manualValidation={manualValidation} defaultValue={initialValues.city} /><Field label="State" name="state" required manualValidation={manualValidation} defaultValue={initialValues.state} /><Field label="PIN Code" name="postal_code" required manualValidation={manualValidation} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} defaultValue={initialValues.postal_code} />
        </Section>
        {!isMisp ? <Section title="POSP contact"><Field label="Mobile Number" name="applicant_phone" required manualValidation={manualValidation} inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" defaultValue={initialValues.applicant_phone} /><Field label="Email" name="applicant_email" type="email" required manualValidation={manualValidation} defaultValue={initialValues.applicant_email} /><IndianDateField label="Date of Birth" name="date_of_birth" required={!manualValidation} defaultValue={initialValues.date_of_birth} inputClassName={dateInputClass} /><Field label="Aadhaar Number" name="aadhaar_number" required manualValidation={manualValidation} inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} defaultValue={initialValues.aadhaar_number} /></Section> : null}
        {isMisp ? <Section title="Designated Person (DP)"><Field label="DP First Name" name="dp_first_name" required manualValidation={manualValidation} defaultValue={initialValues.dp_first_name} /><Field label="DP Middle Name" name="dp_middle_name" manualValidation={manualValidation} defaultValue={initialValues.dp_middle_name} /><Field label="DP Last Name" name="dp_last_name" required manualValidation={manualValidation} defaultValue={initialValues.dp_last_name} /><Field label="DP Contact" name="dp_phone" required manualValidation={manualValidation} inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" defaultValue={initialValues.dp_phone} /><Field label="DP Email" name="dp_email" required type="email" manualValidation={manualValidation} defaultValue={initialValues.dp_email} /><PanInput label="DP PAN No" name="dp_pan_number" manualValidation={manualValidation} defaultValue={initialValues.dp_pan_number} /><IndianDateField label="DP Date of Birth" name="date_of_birth" required={!manualValidation} defaultValue={initialValues.date_of_birth} inputClassName={dateInputClass} /><Field label="DP Aadhaar Number" name="aadhaar_number" required manualValidation={manualValidation} inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} defaultValue={initialValues.aadhaar_number} /></Section> : null}
        <Section title="Bank details"><SelectField label="Bank Name" name="bank_id" required manualValidation={manualValidation} options={banks} placeholder="Select bank" defaultValue={initialValues.bank_id} /><Field label="Account Number" name="bank_account_number" required manualValidation={manualValidation} inputMode="numeric" pattern="[0-9]{6,20}" defaultValue={initialValues.bank_account_number} /><Field label="IFSC Code" name="bank_ifsc_code" required manualValidation={manualValidation} maxLength={11} minLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" transform="uppercase" defaultValue={initialValues.bank_ifsc_code} /><Field label="GST Number" name="gst_number" required={isMisp} manualValidation={manualValidation} maxLength={15} minLength={isMisp ? 15 : undefined} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" transform="uppercase" defaultValue={initialValues.gst_number} /></Section>
        <div className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-[#E2E8F0] bg-white/96 px-3 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-[9.5px] text-[#64748B]">Stage 1 saves the application, queues the PAN check and opens Documents.</p>{submitPath ? <button type="button" disabled={posting} onClick={handleRouteSubmit} className="w-full rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4285F4] px-5 py-2.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-80 sm:w-auto">{posting ? "Saving & opening Documents" : "Save & check PAN"}</button> : <FormSubmitButton label="Save & check PAN" pendingLabel="Saving & opening Documents" className="w-full rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4285F4] px-5 py-2.5 text-[11px] font-semibold text-white sm:w-auto" />}</div>
      </form>
    </div>
  </>;
}

function PanInput({ label, name, compact = false, manualValidation = false, defaultValue }: { label: string; name: string; compact?: boolean; manualValidation?: boolean; defaultValue?: string }) { return <div className={`min-w-0 ${compact ? "" : "xl:col-span-2"}`}><label className={labelClass} htmlFor={name}>{label} *</label><input id={name} name={name} defaultValue={defaultValue} required={!manualValidation} data-required={manualValidation || undefined} data-pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" data-label={label} maxLength={10} minLength={manualValidation ? undefined : 10} pattern={manualValidation ? undefined : "[A-Za-z]{5}[0-9]{4}[A-Za-z]"} onInvalid={event => { const input = event.currentTarget; input.setCustomValidity(input.validity.valueMissing ? `${label} is required.` : `Enter a valid ${label.toLowerCase()} in the format ABCDE1234F.`); }} onInput={event => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); event.currentTarget.setCustomValidity(""); }} className={`${inputClass} font-mono tracking-[0.03em]`} /></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-[#E2E8F0] px-3 py-4 sm:px-5 sm:py-5"><h3 className="mb-4 text-[12px] font-semibold text-[#0F172A]">{title}</h3><div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function Field({ label, name, required = false, transform, manualValidation = false, onInvalid, onInput, pattern, minLength, maxLength, type, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; transform?: "uppercase"; manualValidation?: boolean }) { return <div className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} type={manualValidation && type === "email" ? "text" : type} required={!manualValidation && required} data-required={manualValidation && required || undefined} data-email={manualValidation && type === "email" || undefined} data-pattern={manualValidation ? pattern : undefined} data-min-length={manualValidation ? minLength : undefined} data-label={label} pattern={manualValidation ? undefined : pattern} minLength={manualValidation ? undefined : minLength} maxLength={maxLength} className={inputClass} onInvalid={event => { const input = event.currentTarget; if (input.validity.valueMissing) input.setCustomValidity(`${label} is required.`); else if (input.validity.typeMismatch || input.validity.patternMismatch || input.validity.tooShort) input.setCustomValidity(`Enter a valid ${label.toLowerCase()}.`); onInvalid?.(event); }} onInput={event => { if (transform === "uppercase") event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); event.currentTarget.setCustomValidity(""); onInput?.(event); }} {...props} /></div>; }
function SelectField({ label, name, required = false, options, placeholder, manualValidation = false, onInvalid, onChange, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: SelectOption[]; placeholder: string; manualValidation?: boolean }) { return <div className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} required={!manualValidation && required} data-required={manualValidation && required || undefined} data-label={label} className={inputClass} onInvalid={event => { event.currentTarget.setCustomValidity(`Please select a valid ${label.toLowerCase()} from the list.`); onInvalid?.(event); }} onChange={event => { event.currentTarget.setCustomValidity(""); onChange?.(event); }} {...props}><option value="">{placeholder}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; }
function firstInvalidControl(form: HTMLFormElement) { for (const control of Array.from(form.elements)) { if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) continue; if (control.disabled || control.type === "hidden") continue; control.setCustomValidity(""); if (control.dataset.required && !control.value.trim()) return control; if (control.dataset.email && control.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(control.value)) return control; if (control.dataset.minLength && control.value.length < Number(control.dataset.minLength)) return control; if (control.dataset.pattern && control.value && !new RegExp(`^(?:${control.dataset.pattern})$`).test(control.value)) return control; if (!control.validity.valid) return control; } return null; }
function validationMessage(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) { const label = control.dataset.label || control.labels?.[0]?.textContent?.replace(/\s\*$/, "").trim() || control.name.replaceAll("_", " "); if (control instanceof HTMLSelectElement && (!control.value || control.validity.valueMissing)) return `Please select a valid ${label.toLowerCase()} from the list.`; if (!control.value.trim() || control.validity.valueMissing) return `${label} is required.`; return `Enter a valid ${label.toLowerCase()}.`; }
