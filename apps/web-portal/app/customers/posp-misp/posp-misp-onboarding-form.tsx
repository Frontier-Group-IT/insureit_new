"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FormSubmitButton } from "@/components/form-submit-button";
import { InsureItButtonLoader } from "@/components/loading/insureit-loader";
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
const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MOBILE = /^(?:\+91)?[6-9][0-9]{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIN = /^[0-9]{6}$/;
const AADHAAR = /^[0-9]{12}$/;
const ACCOUNT = /^[0-9]{6,20}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function PospMispOnboardingForm({ action, submitPath, partnerType, initialError = null, initialField = null, initialValues = {}, salesManagers, oems, banks, legacyFields = null }: Props) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, { error: null, field: null, applicationId: null });
  const formRef = useRef<HTMLFormElement>(null);
  const touchedRef = useRef(new Set<string>());
  const invalidHandledRef = useRef(false);
  const actionSubmitIntentRef = useRef<"exit" | "documents">("documents");
  const [routeSubmitIntent, setRouteSubmitIntent] = useState<"exit" | "documents" | null>(null);
  const isMisp = partnerType === "misp";
  const backHref = isMisp ? "/intermediaries/misp" : "/intermediaries/posp";

  useEffect(() => {
    if (state.applicationId && !state.error) {
      const destination = actionSubmitIntentRef.current === "exit"
        ? "/customers/posp-misp"
        : `/intermediaries/applications/${state.applicationId}/workflow?stage=documents&success=primary_details_saved`;
      router.replace(destination);
    }
  }, [router, state.applicationId, state.error]);

  useEffect(() => {
    const fieldName = state.field ?? initialField;
    if (!fieldName) return;
    const message = state.error ?? initialError;
    const form = formRef.current;
    if (!form || !message) return;
    showFieldError(form, fieldName, message, false);
    const field = form.elements.namedItem(fieldName);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
    requestAnimationFrame(() => {
      field.focus({ preventScroll: true });
      field.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [initialError, initialField, state.error, state.field]);

  function setFieldError(name: string, message: string | null) {
    const form = formRef.current;
    if (!form) return;
    if (message) showFieldError(form, name, message, false);
    else clearFieldError(form, name);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    invalidHandledRef.current = false;
    if (!validateForm(event.currentTarget)) {
      event.preventDefault();
      return;
    }
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    actionSubmitIntentRef.current = submitter instanceof HTMLButtonElement && submitter.value === "exit" ? "exit" : "documents";
  }

  function handleRouteSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    setRouteSubmitIntent(submitter instanceof HTMLButtonElement && submitter.value === "exit" ? "exit" : "documents");
  }

  function handleInvalid(event: React.InvalidEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invalidHandledRef.current) return;
    const field = event.target;
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) || !field.name) return;
    invalidHandledRef.current = true;
    const form = event.currentTarget;
    touchedRef.current.add(field.name);
    showFieldError(form, field.name, validationErrorForField(field.name, new FormData(form), partnerType) ?? field.validationMessage, true);
  }

  function validateForm(form: HTMLFormElement) {
    const result = firstValidationError(new FormData(form), partnerType, orderedControlNames(form));
    if (!result) {
      clearFormErrors(form);
      return true;
    }
    touchedRef.current.add(result.field);
    showFieldError(form, result.field, result.message, true);
    return false;
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
    if (!form || !name || (!touchedRef.current.has(name) && !hasFieldError(form, name))) return;
    setFieldError(name, validationErrorForField(name, new FormData(form), partnerType));
  }

  const inputValidationHandlers = submitPath ? {} : { onBlur: handleFieldBlur, onInput: handleFieldInput };
  const selectValidationHandlers = submitPath ? {} : { onBlur: handleFieldBlur, onChange: handleFieldInput };
  const dateValidationHandlers = submitPath ? {} : { onBlur: handleFieldBlur };
  const visibleError = state.error ?? initialError;

  if (!isMisp && !legacyFields) {
    return <>
      <div className="w-full pb-24">
        {visibleError ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">{visibleError}</div> : null}
        <form ref={formRef} action={submitPath ?? formAction} method={submitPath ? "post" : undefined} onSubmitCapture={submitPath ? handleRouteSubmit : handleSubmit} onInvalidCapture={submitPath ? undefined : handleInvalid} data-posp-misp-onboarding-form="true" data-validation-mode={submitPath ? "route-post-native-v7" : "action-inline-v6"} className="w-full">
          <input type="hidden" name="partner_type" value={partnerType} />

          <header className="overflow-hidden rounded-t-2xl border border-b-0 border-[#17365D] bg-[#17365D] px-4 py-4 text-white sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-[18px] font-semibold">POSP Onboarding</h1>
              <div className="flex items-center gap-2">
                <Link href={backHref} className="rounded-lg border border-white/20 px-3 py-2 text-[9.5px] font-semibold text-white/90 transition hover:bg-white/10">Back</Link>
              </div>
            </div>
          </header>

          <nav className="sticky top-[66px] z-30 mb-4 grid grid-cols-3 overflow-hidden rounded-b-2xl border border-t-0 border-[#D9E2F0] bg-white/95 shadow-[0_7px_18px_rgba(15,23,42,.08)] backdrop-blur" aria-label="POSP onboarding sections">
            <PospNavItem href="#posp-section-1" number="01" label="Identity & contact" />
            <PospNavItem href="#posp-section-2" number="02" label="Address" />
            <PospNavItem href="#posp-section-3" number="03" label="Bank & tax" last />
          </nav>

          <div className="space-y-4">
            <PospSection id="posp-section-1" number="01" title="Identity & contact">
              <div className="grid min-w-0 gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-5">
                <IndianDateField label="Documents received" name="document_received_at" defaultValue={initialValues.document_received_at} inputClassName={dateInputClass} {...dateValidationHandlers} />
                <SelectField label="RM" name="associate_employee_id" required options={salesManagers} placeholder="Select RM" defaultValue={initialValues.associate_employee_id} {...selectValidationHandlers} />
                <div className="md:col-span-2 xl:col-span-3">
                  <label className={labelClass}>Applicant name *</label>
                  <div className="grid min-w-0 gap-2 md:grid-cols-3">
                    <Field label="First Name" name="pos_first_name" required hideLabel placeholder="First name" defaultValue={initialValues.pos_first_name} {...inputValidationHandlers} />
                    <Field label="Middle Name" name="pos_middle_name" hideLabel placeholder="Middle name" defaultValue={initialValues.pos_middle_name} {...inputValidationHandlers} />
                    <Field label="Last Name" name="pos_last_name" required hideLabel placeholder="Last name" defaultValue={initialValues.pos_last_name} {...inputValidationHandlers} />
                  </div>
                </div>
              </div>
              <div className="grid min-w-0 gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-5">
                <PanInput label="PAN" name="pan_number" compact defaultValue={initialValues.pan_number} {...inputValidationHandlers} />
                <Field label="Aadhaar" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} defaultValue={initialValues.aadhaar_number} {...inputValidationHandlers} />
                <IndianDateField label="Date of Birth" name="date_of_birth" required defaultValue={initialValues.date_of_birth} inputClassName={dateInputClass} {...dateValidationHandlers} />
                <Field label="Mobile" name="applicant_phone" required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" defaultValue={initialValues.applicant_phone} {...inputValidationHandlers} />
                <Field label="Email" name="applicant_email" type="email" required defaultValue={initialValues.applicant_email} {...inputValidationHandlers} />
              </div>
            </PospSection>

            <PospSection id="posp-section-2" number="02" title="Address">
              <div className="grid min-w-0 gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-5">
                <div className="md:col-span-2 xl:col-span-2"><Field label="Address" name="address" required defaultValue={initialValues.address} {...inputValidationHandlers} /></div>
                <Field label="City" name="city" required defaultValue={initialValues.city} {...inputValidationHandlers} />
                <Field label="State" name="state" required defaultValue={initialValues.state} {...inputValidationHandlers} />
                <Field label="PIN Code" name="postal_code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} defaultValue={initialValues.postal_code} {...inputValidationHandlers} />
              </div>
            </PospSection>

            <PospSection id="posp-section-3" number="03" title="Bank & tax">
              <SelectField label="Bank" name="bank_id" required options={banks} placeholder="Select bank" defaultValue={initialValues.bank_id} {...selectValidationHandlers} />
              <Field label="Account Number" name="bank_account_number" required inputMode="numeric" pattern="[0-9]{6,20}" defaultValue={initialValues.bank_account_number} {...inputValidationHandlers} />
              <Field label="IFSC" name="bank_ifsc_code" required maxLength={11} minLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" transform="uppercase" defaultValue={initialValues.bank_ifsc_code} {...inputValidationHandlers} />
              <Field label="GST Number" name="gst_number" maxLength={15} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" transform="uppercase" defaultValue={initialValues.gst_number} {...inputValidationHandlers} />
            </PospSection>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur">
            <div className="mx-auto flex max-w-[1480px] justify-end gap-2">
              {submitPath ? <>
                <RouteSubmitButton intent="exit" activeIntent={routeSubmitIntent} label="Save & Exit" pendingLabel="Saving & exiting…" secondary />
                <RouteSubmitButton intent="documents" activeIntent={routeSubmitIntent} label="Upload Documents" pendingLabel="Saving & opening documents…" />
              </> : <>
                <FormSubmitButton name="submit_intent" value="exit" label="Save & Exit" pendingLabel="Saving & exiting…" className="rounded-xl border border-[#CBD5E1] bg-white px-5 py-2.5 text-[11px] font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC]" />
                <FormSubmitButton name="submit_intent" value="documents" label="Upload Documents" pendingLabel="Saving & opening documents…" className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[11px] font-semibold text-white hover:bg-[#102A49]" />
              </>}
            </div>
          </div>
        </form>
      </div>
    </>;
  }

  return <>
    <div className="w-full space-y-3 pb-20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="w-fit rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">New {partnerType.toUpperCase()} Application</span>
        <div className="flex gap-3"><Link href="/customers/posp-misp/import" className="text-[10.5px] font-semibold text-[#4F46E5]">Import Excel</Link><Link href={backHref} className="text-[10.5px] font-semibold text-[#4F46E5]">Back</Link></div>
      </div>
      {visibleError ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">{visibleError}</div> : null}
      <form ref={formRef} action={submitPath ?? formAction} method={submitPath ? "post" : undefined} onSubmitCapture={submitPath ? handleRouteSubmit : handleSubmit} onInvalidCapture={submitPath ? undefined : handleInvalid} data-posp-misp-onboarding-form="true" data-validation-mode={submitPath ? "route-post-native-v7" : "action-inline-v6"} className="w-full overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <input type="hidden" name="partner_type" value={partnerType} />
        <header className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3 sm:px-5 sm:py-4"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#071D49] text-[10px] font-bold text-white">1</span><div><h2 className="text-[14px] font-semibold text-[#0F172A]">Primary information & PAN check</h2><p className="mt-0.5 text-[10px] leading-4 text-[#64748B]">The POSP/MISP ID is issued only after successful onboarding. A Partner ID is issued after Stage 2 documents are submitted.</p></div></div></header>
        <Section title={isMisp ? "MISP details" : "POSP details"}>
          <div className={`grid min-w-0 gap-3 md:grid-cols-2 xl:col-span-4 ${isMisp ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}><SelectField label="RM Name" name="associate_employee_id" required options={salesManagers} placeholder="Select RM" defaultValue={initialValues.associate_employee_id} {...selectValidationHandlers} />{isMisp ? <Field label="MISP Name" name="misp_name" required defaultValue={initialValues.misp_name} {...inputValidationHandlers} /> : null}<PanInput label={isMisp ? "MISP PAN" : "PAN Number"} name="pan_number" compact defaultValue={initialValues.pan_number} {...inputValidationHandlers} /><IndianDateField label="Document Received Date" name="document_received_at" defaultValue={initialValues.document_received_at} inputClassName={dateInputClass} {...dateValidationHandlers} /></div>
          {!isMisp ? <div className="grid min-w-0 gap-3 md:grid-cols-3 xl:col-span-4"><Field label="POS First Name" name="pos_first_name" required defaultValue={initialValues.pos_first_name} {...inputValidationHandlers} /><Field label="POS Middle Name" name="pos_middle_name" defaultValue={initialValues.pos_middle_name} {...inputValidationHandlers} /><Field label="POS Last Name" name="pos_last_name" required defaultValue={initialValues.pos_last_name} {...inputValidationHandlers} /></div> : null}
          {isMisp ? <SelectField label="OEM Name" name="oem_name" required options={oems} placeholder="Select OEM" defaultValue={initialValues.oem_name} {...selectValidationHandlers} /> : null}
          <Field label="Address" name="address" required defaultValue={initialValues.address} {...inputValidationHandlers} /><Field label="City" name="city" required defaultValue={initialValues.city} {...inputValidationHandlers} /><Field label="State" name="state" required defaultValue={initialValues.state} {...inputValidationHandlers} /><Field label="PIN Code" name="postal_code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} defaultValue={initialValues.postal_code} {...inputValidationHandlers} />
        </Section>
        {!isMisp ? <Section title="POSP contact"><Field label="Mobile Number" name="applicant_phone" required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" defaultValue={initialValues.applicant_phone} {...inputValidationHandlers} /><Field label="Email" name="applicant_email" type="email" required defaultValue={initialValues.applicant_email} {...inputValidationHandlers} /><IndianDateField label="Date of Birth" name="date_of_birth" required defaultValue={initialValues.date_of_birth} inputClassName={dateInputClass} {...dateValidationHandlers} /><Field label="Aadhaar Number" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} defaultValue={initialValues.aadhaar_number} {...inputValidationHandlers} /></Section> : null}
        {isMisp ? <Section title="Designated Person (DP)"><Field label="DP First Name" name="dp_first_name" required defaultValue={initialValues.dp_first_name} {...inputValidationHandlers} /><Field label="DP Middle Name" name="dp_middle_name" defaultValue={initialValues.dp_middle_name} {...inputValidationHandlers} /><Field label="DP Last Name" name="dp_last_name" required defaultValue={initialValues.dp_last_name} {...inputValidationHandlers} /><Field label="DP Contact" name="dp_phone" required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" defaultValue={initialValues.dp_phone} {...inputValidationHandlers} /><div className="grid min-w-0 gap-4 md:col-span-2 md:grid-cols-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(140px,0.75fr)_minmax(170px,0.9fr)_minmax(0,1.1fr)] xl:col-span-4"><Field label="DP Email" name="dp_email" required type="email" defaultValue={initialValues.dp_email} {...inputValidationHandlers} /><PanInput label="DP PAN No" name="dp_pan_number" compact defaultValue={initialValues.dp_pan_number} {...inputValidationHandlers} /><IndianDateField label="DP Date of Birth" name="date_of_birth" required defaultValue={initialValues.date_of_birth} inputClassName={dateInputClass} {...dateValidationHandlers} /><Field label="DP Aadhaar Number" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} defaultValue={initialValues.aadhaar_number} {...inputValidationHandlers} /></div></Section> : null}
        <Section title="Bank details"><SelectField label="Bank Name" name="bank_id" required options={banks} placeholder="Select bank" defaultValue={initialValues.bank_id} {...selectValidationHandlers} /><Field label="Account Number" name="bank_account_number" required inputMode="numeric" pattern="[0-9]{6,20}" defaultValue={initialValues.bank_account_number} {...inputValidationHandlers} /><Field label="IFSC Code" name="bank_ifsc_code" required maxLength={11} minLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" transform="uppercase" defaultValue={initialValues.bank_ifsc_code} {...inputValidationHandlers} /><Field label="GST Number" name="gst_number" required={isMisp} maxLength={15} minLength={isMisp ? 15 : undefined} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" transform="uppercase" defaultValue={initialValues.gst_number} {...inputValidationHandlers} /></Section>
        {legacyFields}
        <div className="sticky bottom-0 z-20 flex flex-col gap-2 border-t border-[#E2E8F0] bg-white/96 px-3 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[9.5px] text-[#64748B]">Stage 1 saves the application, queues the PAN check and opens Documents.</p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {submitPath ? <>
              <RouteSubmitButton intent="exit" activeIntent={routeSubmitIntent} label="Save & Exit" pendingLabel="Saving & exiting…" secondary />
              <RouteSubmitButton intent="documents" activeIntent={routeSubmitIntent} label="Save & return to documents" pendingLabel="Saving & opening documents…" />
            </> : <>
              <FormSubmitButton name="submit_intent" value="exit" label="Save & Exit" pendingLabel="Saving & exiting…" className="w-full rounded-xl border border-[#CBD5E1] bg-white px-5 py-2.5 text-[11px] font-semibold text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC] sm:w-auto" />
              <FormSubmitButton name="submit_intent" value="documents" label="Save & return to documents" pendingLabel="Saving & opening documents…" className="w-full rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4285F4] px-5 py-2.5 text-[11px] font-semibold text-white sm:w-auto" />
            </>}
          </div>
        </div>
      </form>
    </div>
  </>;
}

function PospNavItem({ href, number, label, last = false }: { href:string; number:string; label:string; last?:boolean }) {
  return <a href={href} className={`flex min-w-0 items-center justify-center gap-2 px-3 py-2.5 text-[9.5px] font-semibold text-[#526277] transition hover:bg-[#F7F9FC] hover:text-[#17365D] ${last ? "" : "border-r border-[#E4EAF1]"}`}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EEF3F8] text-[8px] font-bold text-[#315B6B]">{number}</span><span className="truncate">{label}</span></a>;
}

function PospSection({ id, number, title, children }: { id:string; number:string; title:string; children:React.ReactNode }) {
  return <section id={id} className="scroll-mt-[132px] overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex min-h-12 items-center border-b border-[#E4EAF1] bg-[#FBFCFE] px-4 py-2.5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><h2 className="text-[13px] font-semibold text-[#17203A]">{title}</h2></div></div><div className="grid min-w-0 grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;
}

function RouteSubmitButton({ intent, activeIntent, label, pendingLabel, secondary = false }: { intent: "exit" | "documents"; activeIntent: "exit" | "documents" | null; label: string; pendingLabel: string; secondary?: boolean }) {
  const isPending = activeIntent === intent;
  return <button type="submit" name="submit_intent" value={intent} disabled={Boolean(activeIntent)} aria-busy={isPending} data-validation-mode="route-post-native-v7" className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto ${secondary ? "border border-[#CBD5E1] bg-white text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC]" : "bg-gradient-to-r from-[#635BFF] to-[#4285F4] text-white hover:brightness-110"}`}>
    {isPending ? <InsureItButtonLoader label={pendingLabel} /> : label}
  </button>;
}

function PanInput({ label, name, compact = false, defaultValue, error, onBlur, onInput }: { label: string; name: string; compact?: boolean; defaultValue?: string; error?: string; onBlur?: React.FocusEventHandler<HTMLInputElement>; onInput?: React.FormEventHandler<HTMLInputElement> }) {
  const errorId = inlineFieldErrorId(name);
  return <div data-field-container className={`min-w-0 ${compact ? "" : "xl:col-span-2"}`}><label className={labelClass} htmlFor={name}>{label} *</label><input id={name} name={name} defaultValue={defaultValue} required pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" maxLength={10} minLength={10} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onBlur={onBlur} onInput={event => { event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); onInput?.(event); }} className={`${inputClass} font-mono tracking-[0.03em]`} /><p id={errorId} data-field-error hidden={!error} className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-[#E2E8F0] px-3 py-4 sm:px-5 sm:py-5"><h3 className="mb-4 text-[12px] font-semibold text-[#0F172A]">{title}</h3><div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>; }
function Field({ label, name, required = false, transform, onInput, error, hideLabel = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; transform?: "uppercase"; error?: string; hideLabel?: boolean }) {
  const errorId = inlineFieldErrorId(name);
  return <div data-field-container className="min-w-0"><label className={hideLabel ? "sr-only" : labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={inputClass} onInput={event => { if (transform === "uppercase") event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); onInput?.(event); }} {...props} /><p id={errorId} data-field-error hidden={!error} className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p></div>;
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

function showFieldError(form: HTMLFormElement, name: string, message: string, clearPrevious: boolean) {
  if (clearPrevious) clearFormErrors(form);
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
  const error = field.closest<HTMLElement>("[data-field-container]")?.querySelector<HTMLElement>("[data-field-error]");
  field.setAttribute("aria-invalid", "true");
  if (error) {
    error.textContent = message;
    error.hidden = false;
    field.setAttribute("aria-describedby", error.id);
  }
  focusField(form, name);
}

function clearFieldError(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
  const error = field.closest<HTMLElement>("[data-field-container]")?.querySelector<HTMLElement>("[data-field-error]");
  field.removeAttribute("aria-invalid");
  field.removeAttribute("aria-describedby");
  if (error) {
    error.textContent = "";
    error.hidden = true;
  }
}

function clearFormErrors(form: HTMLFormElement) {
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[aria-invalid='true']").forEach((field) => {
    if (field.name) clearFieldError(form, field.name);
  });
}

function hasFieldError(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return false;
  return field.getAttribute("aria-invalid") === "true";
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
