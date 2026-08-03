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
type FieldErrors = Record<string, string>;
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
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MOBILE = /^(?:\+91)?[6-9][0-9]{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN = /^[0-9]{6}$/;
const AADHAAR = /^[0-9]{12}$/;
const ACCOUNT = /^[0-9]{6,20}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function PospMispOnboardingForm({ action, submitPath, partnerType, initialError = null, initialField = null, initialValues = {}, salesManagers, oems, banks, legacyFields = null }: Props) {
  const [state, formAction] = useActionState(action, { error: null, field: null, applicationId: null });
  const [rmValue, setRmValue] = useState(initialValues.associate_employee_id ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const touchedRef = useRef(new Set<string>());
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
    const message = state.error ?? initialError;
    if (message) setFieldErrors((current) => ({ ...current, [fieldName]: message }));
    const field = formRef.current?.elements.namedItem(fieldName);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
    requestAnimationFrame(() => {
      field.focus({ preventScroll: true });
      field.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [initialError, initialField, state.error, state.field]);

  function setFieldError(name: string, message: string | null) {
    setFieldErrors((current) => {
      const next = { ...current };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const result = firstValidationError(new FormData(form), partnerType, orderedControlNames(form));
    if (!result) {
      setFieldErrors({});
      return;
    }
    event.preventDefault();
    touchedRef.current.add(result.field);
    setFieldErrors({ [result.field]: result.message });
    focusField(form, result.field);
  }

  function handleFieldBlur(event: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const form = formRef.current;
    const name = event.currentTarget.name;
    if (!form || !name) return;
    touchedRef.current.add(name);
    setFieldError(name, validationErrorForField(name, new FormData(form), partnerType));
  }

  function handleFieldInput(event: React.FormEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const form = formRef.current;
    const name = event.currentTarget.name;
    if (!form || !name || (!touchedRef.current.has(name) && !fieldErrors[name])) return;
    setFieldError(name, validationErrorForField(name, new FormData(form), partnerType));
  }

  const visibleError = state.error ?? initialError;

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
          <div className={`grid min-w-0 gap-3 md:grid-cols-2 xl:col-span-4 ${isMisp ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}><SelectField label="RM Name" name="associate_employee_id" required options={salesManagers} placeholder="Select RM" value={rmValue} error={fieldErrors.associate_employee_id} onBlur={handleFieldBlur} onChange={event => { setRmValue(event.target.value); handleFieldInput(event); }} />{isMisp ? <Field label="MISP Name" name="misp_name" required defaultValue={initialValues.misp_name} error={fieldErrors.misp_name} onBlur={handleFieldBlur} onInput={handleFieldInput} /> : null}<PanInput label={isMisp ? "MISP PAN" : "PAN Number"} name="pan_number" compact defaultValue={initialValues.pan_number} error={fieldErrors.pan_number} onBlur={handleFieldBlur} onInput={handleFieldInput} /><IndianDateField label="Document Received Date" name="document_received_at" defaultValue={initialValues.document_received_at} inputClassName={dateInputClass} error={fieldErrors.document_received_at} onBlur={handleFieldBlur} /></div>
          {!isMisp ? <div className="grid min-w-0 gap-3 md:grid-cols-3 xl:col-span-4"><Field label="POS First Name" name="pos_first_name" required defaultValue={initialValues.pos_first_name} error={fieldErrors.pos_first_name} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="POS Middle Name" name="pos_middle_name" defaultValue={initialValues.pos_middle_name} error={fieldErrors.pos_middle_name} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="POS Last Name" name="pos_last_name" required defaultValue={initialValues.pos_last_name} error={fieldErrors.pos_last_name} onBlur={handleFieldBlur} onInput={handleFieldInput} /></div> : null}
          {isMisp ? <SelectField label="OEM Name" name="oem_name" required options={oems} placeholder="Select OEM" defaultValue={initialValues.oem_name} error={fieldErrors.oem_name} onBlur={handleFieldBlur} onChange={handleFieldInput} /> : null}
          <Field label="Address" name="address" required defaultValue={initialValues.address} error={fieldErrors.address} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="City" name="city" required defaultValue={initialValues.city} error={fieldErrors.city} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="State" name="state" required defaultValue={initialValues.state} error={fieldErrors.state} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="PIN Code" name="postal_code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} defaultValue={initialValues.postal_code} error={fieldErrors.postal_code} onBlur={handleFieldBlur} onInput={handleFieldInput} />
        </Section>
        {!isMisp ? <Section title="POSP contact"><Field label="Mobile Number" name="applicant_phone" required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" defaultValue={initialValues.applicant_phone} error={fieldErrors.applicant_phone} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="Email" name="applicant_email" type="email" required defaultValue={initialValues.applicant_email} error={fieldErrors.applicant_email} onBlur={handleFieldBlur} onInput={handleFieldInput} /><IndianDateField label="Date of Birth" name="date_of_birth" required defaultValue={initialValues.date_of_birth} inputClassName={dateInputClass} error={fieldErrors.date_of_birth} onBlur={handleFieldBlur} /><Field label="Aadhaar Number" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} defaultValue={initialValues.aadhaar_number} error={fieldErrors.aadhaar_number} onBlur={handleFieldBlur} onInput={handleFieldInput} /></Section> : null}
        {isMisp ? <Section title="Designated Person (DP)"><Field label="DP First Name" name="dp_first_name" required defaultValue={initialValues.dp_first_name} error={fieldErrors.dp_first_name} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="DP Middle Name" name="dp_middle_name" defaultValue={initialValues.dp_middle_name} error={fieldErrors.dp_middle_name} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="DP Last Name" name="dp_last_name" required defaultValue={initialValues.dp_last_name} error={fieldErrors.dp_last_name} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="DP Contact" name="dp_phone" required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" defaultValue={initialValues.dp_phone} error={fieldErrors.dp_phone} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="DP Email" name="dp_email" required type="email" defaultValue={initialValues.dp_email} error={fieldErrors.dp_email} onBlur={handleFieldBlur} onInput={handleFieldInput} /><PanInput label="DP PAN No" name="dp_pan_number" defaultValue={initialValues.dp_pan_number} error={fieldErrors.dp_pan_number} onBlur={handleFieldBlur} onInput={handleFieldInput} /><IndianDateField label="DP Date of Birth" name="date_of_birth" required defaultValue={initialValues.date_of_birth} inputClassName={dateInputClass} error={fieldErrors.date_of_birth} onBlur={handleFieldBlur} /><Field label="DP Aadhaar Number" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} defaultValue={initialValues.aadhaar_number} error={fieldErrors.aadhaar_number} onBlur={handleFieldBlur} onInput={handleFieldInput} /></Section> : null}
        <Section title="Bank details"><SelectField label="Bank Name" name="bank_id" required options={banks} placeholder="Select bank" defaultValue={initialValues.bank_id} error={fieldErrors.bank_id} onBlur={handleFieldBlur} onChange={handleFieldInput} /><Field label="Account Number" name="bank_account_number" required inputMode="numeric" pattern="[0-9]{6,20}" defaultValue={initialValues.bank_account_number} error={fieldErrors.bank_account_number} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="IFSC Code" name="bank_ifsc_code" required maxLength={11} minLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" transform="uppercase" defaultValue={initialValues.bank_ifsc_code} error={fieldErrors.bank_ifsc_code} onBlur={handleFieldBlur} onInput={handleFieldInput} /><Field label="GST Number" name="gst_number" required={isMisp} maxLength={15} minLength={isMisp ? 15 : undefined} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" transform="uppercase" defaultValue={initialValues.gst_number} error={fieldErrors.gst_number} onBlur={handleFieldBlur} onInput={handleFieldInput} /></Section>
        {legacyFields}
        <div className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-[#E2E8F0] bg-white/96 px-3 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-[9.5px] text-[#64748B]">Stage 1 saves the application, queues the PAN check and opens Documents.</p>{submitPath ? <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4285F4] px-5 py-2.5 text-[11px] font-semibold text-white sm:w-auto">Save & check PAN</button> : <FormSubmitButton label="Save & check PAN" pendingLabel="Saving & opening Documents" className="w-full rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4285F4] px-5 py-2.5 text-[11px] font-semibold text-white sm:w-auto" />}</div>
      </form>
    </div>
  </>;
}

function PanInput({ label, name, compact = false, defaultValue, error, onBlur, onInput }: { label: string; name: string; compact?: boolean; defaultValue?: string; error?: string; onBlur?: React.FocusEventHandler<HTMLInputElement>; onInput?: React.FormEventHandler<HTMLInputElement> }) {
  const errorId = inlineFieldErrorId(name);
  return <div data-field-container className={`min-w-0 ${compact ? "" : "xl:col-span-2"}`}><label className={labelClass} htmlFor={name}>{label} *</label><input id={name} name={name} defaultValue={defaultValue} required pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" maxLength={10} minLength={10} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onBlur={onBlur} onInput={event => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); onInput?.(event); }} className={`${inputClass} font-mono tracking-[0.03em]`} /><p id={errorId} data-field-error hidden={!error} className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-[#E2E8F0] px-3 py-4 sm:px-5 sm:py-5"><h3 className="mb-4 text-[12px] font-semibold text-[#0F172A]">{title}</h3><div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function Field({ label, name, required = false, transform, onInput, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; transform?: "uppercase"; error?: string }) {
  const errorId = inlineFieldErrorId(name);
  return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={inputClass} onInput={event => { if (transform === "uppercase") event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); onInput?.(event); }} {...props} /><p id={errorId} data-field-error hidden={!error} className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p></div>;
}
function SelectField({ label, name, required = false, options, placeholder, error, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: SelectOption[]; placeholder: string; error?: string }) {
  const errorId = inlineFieldErrorId(name);
  return <div data-field-container className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={inputClass} {...props}><option value="">{placeholder}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><p id={errorId} data-field-error hidden={!error} className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p></div>;
}

function orderedControlNames(form: HTMLFormElement) {
  return Array.from(form.elements).flatMap((element) => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) return [];
    if (!element.name || element.disabled || element.type === "hidden") return [];
    return [element.name];
  });
}

function firstValidationError(data: FormData, partnerType: PartnerType, names: string[]) {
  for (const name of names) {
    const message = validationErrorForField(name, data, partnerType);
    if (message) return { field: name, message };
  }
  return null;
}

function validationErrorForField(name: string, data: FormData, partnerType: PartnerType) {
  const isMisp = partnerType === "misp";
  const value = text(data, name);
  if (requiredFields(partnerType).has(name) && !value) return requiredMessage(name, isMisp);
  if (!value) return null;

  if ((name === "pan_number" || name === "dp_pan_number") && !PAN.test(compactUpper(value))) return `${labelFor(name, isMisp)} must use PAN format ABCDE1234F.`;
  if ((name === "applicant_phone" || name === "dp_phone") && !MOBILE.test(compactPhone(value))) return `${labelFor(name, isMisp)} must be a valid Indian mobile number.`;
  if ((name === "applicant_email" || name === "dp_email") && !EMAIL.test(value.toLowerCase())) return `${labelFor(name, isMisp)} must be a valid email address.`;
  if (name === "postal_code" && !PIN.test(digits(value))) return "PIN Code must contain exactly 6 digits.";
  if (name === "aadhaar_number" && !AADHAAR.test(digits(value))) return `${labelFor(name, isMisp)} must contain exactly 12 digits.`;
  if (name === "bank_account_number" && !ACCOUNT.test(digits(value))) return "Account Number must contain 6 to 20 digits.";
  if (name === "bank_ifsc_code" && !IFSC.test(compactUpper(value))) return "IFSC Code must use format ABCD0123456.";
  if (name === "gst_number" && !GST.test(compactUpper(value))) return "GST Number must be a valid 15-character GSTIN.";
  if (name === "date_of_birth" && Number.isNaN(Date.parse(value))) return `${labelFor(name, isMisp)} must be a valid date.`;

  return null;
}

function requiredFields(partnerType: PartnerType) {
  const common = ["associate_employee_id", "pan_number", "address", "city", "state", "postal_code", "date_of_birth", "aadhaar_number", "bank_id", "bank_account_number", "bank_ifsc_code"];
  return new Set(partnerType === "misp"
    ? [...common, "misp_name", "oem_name", "dp_first_name", "dp_last_name", "dp_phone", "dp_email", "dp_pan_number", "gst_number"]
    : [...common, "pos_first_name", "pos_last_name", "applicant_phone", "applicant_email"]);
}

function focusField(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
  requestAnimationFrame(() => {
    field.focus({ preventScroll: true });
    field.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function compactUpper(value: string) {
  return value.replace(/\s/g, "").toUpperCase();
}

function compactPhone(value: string) {
  const digitsOnly = digits(value);
  if (digitsOnly.length > 10 && digitsOnly.startsWith("91")) return `+91${digitsOnly.slice(-10)}`;
  return value.replace(/\s/g, "");
}

function requiredMessage(name: string, isMisp: boolean) {
  if (name === "associate_employee_id") return "Please select RM Name.";
  if (name === "bank_id") return "Please select Bank Name.";
  if (name === "oem_name") return "Please select OEM Name.";
  return `${labelFor(name, isMisp)} is required.`;
}

function labelFor(name: string, isMisp: boolean) {
  const labels: Record<string, string> = {
    associate_employee_id: "RM Name",
    pan_number: isMisp ? "MISP PAN" : "PAN Number",
    misp_name: "MISP Name",
    pos_first_name: "POS First Name",
    pos_middle_name: "POS Middle Name",
    pos_last_name: "POS Last Name",
    oem_name: "OEM Name",
    address: "Address",
    city: "City",
    state: "State",
    postal_code: "PIN Code",
    applicant_phone: "Mobile Number",
    applicant_email: "Email",
    date_of_birth: isMisp ? "DP Date of Birth" : "Date of Birth",
    aadhaar_number: isMisp ? "DP Aadhaar Number" : "Aadhaar Number",
    dp_first_name: "DP First Name",
    dp_middle_name: "DP Middle Name",
    dp_last_name: "DP Last Name",
    dp_phone: "DP Contact",
    dp_email: "DP Email",
    dp_pan_number: "DP PAN No",
    bank_id: "Bank Name",
    bank_account_number: "Account Number",
    bank_ifsc_code: "IFSC Code",
    gst_number: "GST Number",
  };
  return labels[name] ?? name.replaceAll("_", " ");
}
