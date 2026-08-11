"use client";

import Link from "next/link";
import { useState } from "react";
import { IndianDateField } from "@/components/indian-date-field";
import { InsureItButtonLoader } from "@/components/loading/insureit-loader";

type SelectOption = { value: string; label: string };

type Props = {
  initialError?: string | null;
  initialField?: string | null;
  initialValues?: Record<string, string>;
  salesManagers: SelectOption[];
  oems: SelectOption[];
  banks: SelectOption[];
};

const inputClass = "h-11 w-full min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1.5 block text-[10.5px] font-semibold text-[#344054]";

export function MispModernOnboardingForm({ initialError = null, initialField = null, initialValues = {}, salesManagers, oems, banks }: Props) {
  const [activeIntent, setActiveIntent] = useState<"exit" | "documents" | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    setActiveIntent(submitter instanceof HTMLButtonElement && submitter.value === "exit" ? "exit" : "documents");
  }

  const errorFor = (name: string) => initialField === name ? initialError : null;

  return (
    <div className="w-full pb-24">
      {initialError ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-semibold text-red-700">{initialError}</div> : null}
      <form action="/customers/posp-misp/new/submit" method="post" onSubmitCapture={handleSubmit} data-posp-misp-onboarding-form="true" data-validation-mode="route-post-native-v7" className="w-full">
        <input type="hidden" name="partner_type" value="misp" />

        <header className="overflow-hidden rounded-t-2xl border border-b-0 border-[#17365D] bg-[#17365D] px-4 py-4 text-white sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-[18px] font-semibold">MISP Onboarding</h1>
            <div className="flex items-center gap-2">
              <Link href="/intermediaries/misp" className="rounded-lg border border-white/20 px-3 py-2 text-[9.5px] font-semibold text-white/90 transition hover:bg-white/10">Back</Link>
            </div>
          </div>
        </header>

        <nav className="sticky top-[66px] z-30 mb-4 grid grid-cols-4 overflow-hidden rounded-b-2xl border border-t-0 border-[#D9E2F0] bg-white/95 shadow-[0_7px_18px_rgba(15,23,42,.08)] backdrop-blur" aria-label="MISP onboarding sections">
          <MispNavItem href="#misp-section-1" number="01" label="MISP details" />
          <MispNavItem href="#misp-section-2" number="02" label="Designated Person" />
          <MispNavItem href="#misp-section-3" number="03" label="Address" />
          <MispNavItem href="#misp-section-4" number="04" label="Bank & tax" last />
        </nav>

        <div className="space-y-4">
          <MispSection id="misp-section-1" number="01" title="MISP details">
            <div className="grid min-w-0 gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-5">
              <IndianDateField label="Documents received" name="document_received_at" defaultValue={initialValues.document_received_at} inputClassName={inputClass} />
              <SelectField label="OEM Name" name="oem_name" required options={oems} placeholder="Select OEM" defaultValue={initialValues.oem_name} error={errorFor("oem_name")} />
              <SelectField label="RM" name="associate_employee_id" required options={salesManagers} placeholder="Select RM" defaultValue={initialValues.associate_employee_id} error={errorFor("associate_employee_id")} />
              <Field label="MISP Name" name="misp_name" required defaultValue={initialValues.misp_name} error={errorFor("misp_name")} />
              <PanField label="MISP PAN" name="pan_number" defaultValue={initialValues.pan_number} error={errorFor("pan_number")} />
            </div>
          </MispSection>

          <MispSection id="misp-section-2" number="02" title="Designated Person (DP)">
            <div className="grid min-w-0 gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-4">
              <div className="md:col-span-2 xl:col-span-3">
                <label className={labelClass}>DP Name *</label>
                <div className="grid min-w-0 gap-2 md:grid-cols-3">
                  <Field label="DP First Name" name="dp_first_name" required hideLabel placeholder="First name" defaultValue={initialValues.dp_first_name} error={errorFor("dp_first_name")} />
                  <Field label="DP Middle Name" name="dp_middle_name" hideLabel placeholder="Middle name" defaultValue={initialValues.dp_middle_name} error={errorFor("dp_middle_name")} />
                  <Field label="DP Last Name" name="dp_last_name" hideLabel placeholder="Last name" defaultValue={initialValues.dp_last_name} error={errorFor("dp_last_name")} />
                </div>
              </div>
              <IndianDateField label="DP Date of Birth" name="date_of_birth" required defaultValue={initialValues.date_of_birth} inputClassName={inputClass} />
            </div>
            <div className="grid min-w-0 gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-4">
              <Field label="DP Contact" name="dp_phone" required inputMode="tel" pattern="(?:\+91)?[6-9][0-9]{9}" defaultValue={initialValues.dp_phone} error={errorFor("dp_phone")} />
              <Field label="DP Email" name="dp_email" required type="email" defaultValue={initialValues.dp_email} error={errorFor("dp_email")} />
              <PanField label="DP PAN No" name="dp_pan_number" defaultValue={initialValues.dp_pan_number} error={errorFor("dp_pan_number")} />
              <Field label="DP Aadhaar Number" name="aadhaar_number" required inputMode="numeric" pattern="[0-9]{12}" maxLength={12} minLength={12} defaultValue={initialValues.aadhaar_number} error={errorFor("aadhaar_number")} />
            </div>
          </MispSection>

          <MispSection id="misp-section-3" number="03" title="Address">
            <div className="grid min-w-0 gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-5">
              <div className="md:col-span-2 xl:col-span-2"><Field label="Address" name="address" required defaultValue={initialValues.address} error={errorFor("address")} /></div>
              <Field label="City" name="city" required defaultValue={initialValues.city} error={errorFor("city")} />
              <Field label="State" name="state" required defaultValue={initialValues.state} error={errorFor("state")} />
              <Field label="PIN Code" name="postal_code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} defaultValue={initialValues.postal_code} error={errorFor("postal_code")} />
            </div>
          </MispSection>

          <MispSection id="misp-section-4" number="04" title="Bank & tax">
            <SelectField label="Bank" name="bank_id" required options={banks} placeholder="Select bank" defaultValue={initialValues.bank_id} error={errorFor("bank_id")} />
            <Field label="Account Number" name="bank_account_number" required inputMode="numeric" pattern="[0-9]{6,20}" defaultValue={initialValues.bank_account_number} error={errorFor("bank_account_number")} />
            <Field label="IFSC" name="bank_ifsc_code" required maxLength={11} minLength={11} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" transform="uppercase" defaultValue={initialValues.bank_ifsc_code} error={errorFor("bank_ifsc_code")} />
            <Field label="GST Number" name="gst_number" required maxLength={15} minLength={15} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]" transform="uppercase" defaultValue={initialValues.gst_number} error={errorFor("gst_number")} />
          </MispSection>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur">
          <div className="mx-auto flex max-w-[1480px] justify-end gap-2">
            <SubmitButton intent="exit" activeIntent={activeIntent} label="Save & Exit" pendingLabel="Saving & exiting…" secondary />
            <SubmitButton intent="documents" activeIntent={activeIntent} label="Upload Documents" pendingLabel="Saving & opening documents…" />
          </div>
        </div>
      </form>
    </div>
  );
}

function MispNavItem({ href, number, label, last = false }: { href: string; number: string; label: string; last?: boolean }) {
  return <a href={href} className={`flex min-w-0 items-center justify-center gap-2 px-3 py-2.5 text-[9.5px] font-semibold text-[#526277] transition hover:bg-[#F7F9FC] hover:text-[#17365D] ${last ? "" : "border-r border-[#E4EAF1]"}`}><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EEF3F8] text-[8px] font-bold text-[#315B6B]">{number}</span><span className="truncate">{label}</span></a>;
}

function MispSection({ id, number, title, children }: { id: string; number: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-[132px] overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex min-h-12 items-center border-b border-[#E4EAF1] bg-[#FBFCFE] px-4 py-2.5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><h2 className="text-[13px] font-semibold text-[#17203A]">{title}</h2></div></div><div className="grid min-w-0 grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;
}

function SubmitButton({ intent, activeIntent, label, pendingLabel, secondary = false }: { intent: "exit" | "documents"; activeIntent: "exit" | "documents" | null; label: string; pendingLabel: string; secondary?: boolean }) {
  const isPending = activeIntent === intent;
  return <button type="submit" name="submit_intent" value={intent} disabled={Boolean(activeIntent)} aria-busy={isPending} className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${secondary ? "border border-[#CBD5E1] bg-white text-[#334155] hover:border-[#94A3B8] hover:bg-[#F8FAFC]" : "bg-[#17365D] text-white hover:bg-[#102A49]"}`}>{isPending ? <InsureItButtonLoader label={pendingLabel} /> : label}</button>;
}

function Field({ label, name, required = false, transform, error, hideLabel = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; transform?: "uppercase"; error?: string | null; hideLabel?: boolean }) {
  return <div className="min-w-0"><label className={hideLabel ? "sr-only" : labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} required={required} aria-invalid={Boolean(error)} className={`${inputClass} ${error ? "border-red-400 bg-red-50/40" : ""}`} onInput={event => { if (transform === "uppercase") event.currentTarget.value = event.currentTarget.value.toUpperCase().replace(/\s/g, ""); }} {...props} />{error ? <p className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p> : null}</div>;
}

function PanField({ label, name, defaultValue, error }: { label: string; name: string; defaultValue?: string; error?: string | null }) {
  return <Field label={label} name={name} required pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" maxLength={10} minLength={10} transform="uppercase" defaultValue={defaultValue} error={error} />;
}

function SelectField({ label, name, required = false, options, placeholder, error, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: SelectOption[]; placeholder: string; error?: string | null }) {
  return <div className="min-w-0"><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} required={required} aria-invalid={Boolean(error)} className={`${inputClass} ${error ? "border-red-400 bg-red-50/40" : ""}`} {...props}><option value="">{placeholder}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{error ? <p className="mt-1.5 text-[9.5px] font-semibold text-red-600">{error}</p> : null}</div>;
}
