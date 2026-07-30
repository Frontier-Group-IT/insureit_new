"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { FeedbackToast } from "@/components/ui-feedback";
import { IndianDateField } from "@/components/indian-date-field";
import type { PospMispState } from "./actions";

type PartnerType = "posp" | "misp";
type CreateState = PospMispState & { applicationId?: string | null };
type Props = {
  action: (state: CreateState, data: FormData) => Promise<CreateState>;
  partnerType: PartnerType;
  salesManagers: Array<{ id: string; fullName: string; employeeCode: string | null }>;
  oems: Array<{ value: string; label: string }>;
  banks: Array<{ value: string; label: string }>;
};

const inputClass = "h-11 w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF] invalid:border-red-500 invalid:ring-2 invalid:ring-red-100";
const dateInputClass = inputClass;
const labelClass = "mb-1.5 block text-[10.5px] font-semibold text-[#344054]";

export function PospMispOnboardingForm({ action, partnerType, salesManagers, oems, banks }: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, { error: null, field: null, applicationId: null });
  const [showError, setShowError] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const isMisp = partnerType === "misp";
  const backHref = isMisp ? "/intermediaries/misp" : "/intermediaries/posp";

  useEffect(() => {
    if (state.applicationId && !state.error) {
      router.replace(`/intermediaries/applications/${state.applicationId}/workflow?stage=documents&success=primary_details_saved`);
      return;
    }
    setShowError(Boolean(state.error));
    if (!state.field) return;
    requestAnimationFrame(() => {
      const field = formRef.current?.elements.namedItem(state.field ?? "");
      if (field instanceof HTMLElement) {
        field.focus({ preventScroll: true });
        field.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }, [router, state.applicationId, state.error, state.field]);

  function handleInvalid(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.target;
    if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLSelectElement)) return;
    const label = field.labels?.[0]?.textContent?.replace(" *", "").trim() || field.name.replaceAll("_", " ");
    setClientError(field.validationMessage || `Please enter a valid value for ${label}.`);
    setShowError(true);
    requestAnimationFrame(() => {
      field.focus({ preventScroll: true });
      field.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  const visibleError = clientError ?? state.error;

  return <>
    {visibleError && showError ? <FeedbackToast tone="error" message={visibleError} onClose={() => { setShowError(false); setClientError(null); }} /> : null}
    <div className="w-full space-y-3 pb-20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="w-fit rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">New {partnerType.toUpperCase()} Application</span>
        <div className="flex gap-3"><Link href="/customers/posp-misp/import" className="text-[10.5px] font-semibold text-[#4F46E5]">Import Excel</Link><Link href={backHref} className="text-[10.5px] font-semibold text-[#4F46E5]">Back</Link></div>
      </div>
      <StageBar />
      <form ref={formRef} action={formAction} onInvalidCapture={handleInvalid} onInputCapture={() => { if (clientError) setClientError(null); }} className="w-full overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <input type="hidden" name="partner_type" value={partnerType} />
        <header className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3 sm:px-5 sm:py-4"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#071D49] text-[10px] font-bold text-white">1</span><div><h2 className="text-[14px] font-semibold text-[#0F172A]">Primary information & PAN check</h2><p className="mt-0.5 text-[10px] leading-4 text-[#64748B]">The POSP/MISP ID is issued only after successful onboarding. A Partner ID is issued after Stage 2 documents are submitted.</p></div></div></header>
        <Section title={isMisp ? "MISP details" : "POSP details"}>
          <div className={`grid min-w-0 gap-3 md:grid-cols-2 xl:col-span-4 ${isMisp ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}><SelectField label="RM Name" name="associate_employee_id" required options={salesManagers.map(manager => ({ value: manager.id, label: `${manager.fullName}${manager.employeeCode ? ` - ${manager.employeeCode}` : ""}` }))} placeholder="Select RM" />{isMisp ? <Field label="MISP Name" name="misp_name" required /> : null}<PanInput label={isMisp ? "MISP PAN" : "PAN Number"} name="pan_number" compact /><IndianDateField label="Document Received Date" name="document_received_at" inputClassName={dateInputClass} /></div>
          {!isMisp ? <div className="grid min-w-0 gap-3 md:grid-cols-3 xl:col-span-4"><Field label="POS First Name" name="pos_first_name" required /><Field label="POS Middle Name" name="pos_middle_name" /><Field label="POS Last Name" name="pos_last_name" required /></div> : null}
          {isMisp ? <SelectField label="OEM Name" name="oem_name" required options={oems} placeholder="Select OEM" /> : null}
          <Field label="Address" name="address" required /><Field label="City" name="city" required /><Field label="State" name="state" required /><Field label="PIN Code" name="postal_code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} />
        </Section>
        {!isMisp ? <Section title="POSP contact"><Field label="Mobile Number" name="applicant_phone" required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" /><Field label="Email" name="applicant_email" type="email" required /><IndianDateField label="Date of Birth" name="date_of_birth" required inputClassName={dateInputClass} /><Field label="Aadhaar Number" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} /></Section> : null}
        {isMisp ? <Section title="Designated Person (DP)"><Field label="DP First Name" name="dp_first_name" required /><Field label="DP Middle Name" name="dp_middle_name" /><Field label="DP Last Name" name="dp_last_name" required /><Field label="DP Contact" name="dp_phone" required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" /><Field label="DP Email" name="dp_email" required type="email" /><PanInput label="DP PAN No" name="dp_pan_number" /><IndianDateField label="DP Date of Birth" name="date_of_birth" required inputClassName={dateInputClass} /><Field label="DP Aadhaar Number" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} /></Section> : null}
        <Section title="Bank details"><SelectField label="Bank Name" name="bank_id" required options={banks} placeholder="Select bank" /><Field label="Account Number" name="bank_account_number" required inputMode="numeric" pattern="[0-9]{6,20}" /><Field label="IFSC Code" name="bank_ifsc_code" required maxLength={11} minLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" transform="uppercase" /></Section>
        <div className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-[#E2E8F0] bg-white/96 px-3 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-[9.5px] text-[#64748B]">Stage 1 saves the application, queues the PAN check and opens Documents.</p><FormSubmitButton label="Save & check PAN" pendingLabel="Saving & opening Documents" className="w-full rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4285F4] px-5 py-2.5 text-[11px] font-semibold text-white sm:w-auto" /></div>
      </form>
    </div>
  </>;
}

function StageBar() { return <div className="grid grid-cols-1 gap-1.5 rounded-2xl border border-[#DCE5EF] bg-white p-2 shadow-sm sm:grid-cols-3 sm:gap-2"><Stage active number="1" label="Primary & IIB" /><Stage number="2" label="Documents" /><Stage number="3" label="Review" /></div>; }
function Stage({ number, label, active = false }: { number: string; label: string; active?: boolean }) { return <div className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-semibold ${active ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#4338CA]" : "border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]"}`}><span>{number}</span><span>{label}</span></div>; }
function PanInput({ label, name, compact = false }: { label: string; name: string; compact?: boolean }) { return <div className={`min-w-0 ${compact ? "" : "xl:col-span-2"}`}><label className={labelClass} htmlFor={name}>{label} *</label><input id={name} name={name} required maxLength={10} minLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" onInvalid={event => { const input = event.currentTarget; input.setCustomValidity(input.validity.valueMissing ? `${label} is required.` : `Enter a valid ${label.toLowerCase()} in the format ABCDE1234F.`); }} onInput={event => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); event.currentTarget.setCustomValidity(""); }} className={`${inputClass} font-mono tracking-[0.03em]`} /></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-[#E2E8F0] px-3 py-4 sm:px-5 sm:py-5"><h3 className="mb-4 text-[12px] font-semibold text-[#0F172A]">{title}</h3><div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function Field({ label, name, required = false, transform, onInvalid, onInput, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; transform?: "uppercase" }) { return <div className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} className={inputClass} onInvalid={event => { const input = event.currentTarget; if (input.validity.valueMissing) input.setCustomValidity(`${label} is required.`); else if (input.validity.typeMismatch || input.validity.patternMismatch || input.validity.tooShort) input.setCustomValidity(`Enter a valid ${label.toLowerCase()}.`); onInvalid?.(event); }} onInput={event => { if (transform === "uppercase") event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); event.currentTarget.setCustomValidity(""); onInput?.(event); }} {...props} /></div>; }
function SelectField({ label, name, required = false, options, placeholder, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: Array<{ value: string; label: string }>; placeholder: string }) { return <div className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} required={required} className={inputClass} onInvalid={event => event.currentTarget.setCustomValidity(`Please select a valid ${label.toLowerCase()} from the list.`)} onChange={event => { event.currentTarget.setCustomValidity(""); props.onChange?.(event); }} {...props}><option value="">{placeholder}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; }
