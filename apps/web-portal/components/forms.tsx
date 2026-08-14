import type { ReactNode } from "react";
import Link from "next/link";
import { FormSubmitButton } from "./form-submit-button";
import { ManufacturerYearFields, VehicleSpecificationFields } from "./vehicle-class-capacity-fields";

type FormAction = (formData: FormData) => void | Promise<void>;
type SelectOption = { label: string; value: string };
type CustomerValues = { contact_name?: string | null; company_name?: string | null; phone?: string | null; email?: string | null; city?: string | null; state?: string | null; address?: string | null; assigned_agent_id?: string | null };
type VehicleValues = { customer_id?: string | null; vehicle_no?: string | null; vehicle_type?: string | null; make?: string | null; model?: string | null; chassis_no?: string | null; engine_no?: string | null; permit_no?: string | null; year?: number | null; gvw_kg?: number | null; fuel_type?: string | null; registration_date?: string | null; fitness_expiry_date?: string | null; puc_expiry_date?: string | null; road_tax_expiry_date?: string | null; national_permit_expiry_date?: string | null; local_permit_expiry_date?: string | null };
type PolicyValues = { customer_id?: string | null; vehicle_id?: string | null; insurance_company_id?: string | null; policy_no?: string | null; policy_type?: string | null; insured_declared_value?: number | null; start_date?: string | null; end_date?: string | null };

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const onboardingInputClass = "h-11 w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";
const onboardingLabelClass = "mb-1.5 block text-[10.5px] font-semibold text-[#344054]";

export function CustomerForm({ action, values, agents = [], submitLabel = "Save record" }: { action: FormAction; values?: CustomerValues; agents?: SelectOption[]; submitLabel?: string }) {
  return <EnterpriseForm action={action} cancelHref="/customers" submitLabel={submitLabel}>
    <FormSection title="Customer profile" columns="three"><Field label="Contact name" name="contact_name" placeholder="Fleet owner or manager" required defaultValue={values?.contact_name ?? ""} /><Field label="Company name" name="company_name" placeholder="Transport company" defaultValue={values?.company_name ?? ""} /><Field label="Phone" name="phone" placeholder="Primary mobile number" required defaultValue={values?.phone ?? ""} /><Field label="Email" name="email" placeholder="billing@example.com" type="email" defaultValue={values?.email ?? ""} /><SelectField label="Assigned agent" name="assigned_agent_id" options={agents} defaultValue={values?.assigned_agent_id ?? ""} emptyLabel="No assigned agent" /><Field label="City" name="city" placeholder="Mumbai" defaultValue={values?.city ?? ""} /><Field label="State" name="state" placeholder="Maharashtra" defaultValue={values?.state ?? ""} /><div className="md:col-span-2 xl:col-span-3"><label className={labelClass} htmlFor="address">Address</label><textarea id="address" name="address" rows={3} className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]" defaultValue={values?.address ?? ""} /></div></FormSection>
  </EnterpriseForm>;
}

export function VehicleForm({ action, customers, manufacturers = [], values, submitLabel = "Save record" }: { action: FormAction; customers: SelectOption[]; manufacturers?: SelectOption[]; values?: VehicleValues; submitLabel?: string }) {
  return <div className="mx-auto max-w-[1480px] rounded-2xl bg-[#F3F6FA] p-3 sm:p-4 lg:p-5">
    <form action={action} className="space-y-4">
      <VehicleSection number="01" title="Vehicle Ownership" columns="five">
        <SelectField variant="onboarding" label="Customer" name="customer_id" options={customers} required defaultValue={values?.customer_id ?? ""} emptyLabel="Select customer" />
        <Field variant="onboarding" label="Vehicle number" name="vehicle_no" placeholder="MH12AB1234" required defaultValue={values?.vehicle_no ?? ""} uppercase />
        <Field variant="onboarding" label="Registration date" name="registration_date" type="date" defaultValue={values?.registration_date ?? ""} />
        <ManufacturerYearFields manufacturers={manufacturers} defaultMake={values?.make ?? ""} defaultYear={values?.year?.toString() ?? ""} />
        <Field variant="onboarding" label="Model" name="model" placeholder="Model name" defaultValue={values?.model ?? ""} />
      </VehicleSection>

      <VehicleSection number="02" title="Vehicle Specification" columns="five">
        <VehicleSpecificationFields
          defaultClass={values?.vehicle_type ?? ""}
          defaultChassis={values?.chassis_no ?? ""}
          defaultEngine={values?.engine_no ?? ""}
          defaultFuel={values?.fuel_type ?? ""}
          defaultCapacity={values?.gvw_kg?.toString() ?? ""}
        />
      </VehicleSection>

      <VehicleSection number="03" title="Compliance & Permit" columns="five">
        <Field variant="onboarding" label="Fitness expiry" name="fitness_expiry_date" type="date" defaultValue={values?.fitness_expiry_date ?? ""} />
        <Field variant="onboarding" label="PUC expiry" name="puc_expiry_date" type="date" defaultValue={values?.puc_expiry_date ?? ""} />
        <Field variant="onboarding" label="Road tax expiry" name="road_tax_expiry_date" type="date" defaultValue={values?.road_tax_expiry_date ?? ""} />
        <Field variant="onboarding" label="National permit expiry" name="national_permit_expiry_date" type="date" defaultValue={values?.national_permit_expiry_date ?? ""} />
        <Field variant="onboarding" label="Local permit expiry" name="local_permit_expiry_date" type="date" defaultValue={values?.local_permit_expiry_date ?? ""} />
      </VehicleSection>

      <div className="sticky bottom-0 z-20 flex items-center justify-end gap-2 rounded-2xl border border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur sm:px-5">
        <Link href="/vehicles" className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[11px] font-semibold text-[#334155] transition hover:border-[#94A3B8] hover:bg-[#F8FAFC]">Cancel</Link>
        <FormSubmitButton label={submitLabel} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[11px] font-semibold text-white transition hover:bg-[#102A49]" />
      </div>
    </form>
  </div>;
}

export function PolicyForm({ action, customers, vehicles, insurers, values, submitLabel = "Save record" }: { action: FormAction; customers: SelectOption[]; vehicles: SelectOption[]; insurers: SelectOption[]; values?: PolicyValues; submitLabel?: string }) {
  return <EnterpriseForm action={action} cancelHref="/policies" submitLabel={submitLabel}>
    <FormSection title="Policy mapping" columns="three"><SelectField label="Customer" name="customer_id" options={customers} required defaultValue={values?.customer_id ?? ""} emptyLabel="Select customer" /><SelectField label="Vehicle" name="vehicle_id" options={vehicles} required defaultValue={values?.vehicle_id ?? ""} emptyLabel="Select vehicle" /><Field label="Policy number" name="policy_no" placeholder="POL-123456" required defaultValue={values?.policy_no ?? ""} uppercase /></FormSection>
    <FormSection title="Insurer details" columns="three"><SelectField label="Existing insurance company" name="insurance_company_id" options={insurers} defaultValue={values?.insurance_company_id ?? ""} emptyLabel="Select insurer" /><Field label="New insurance company" name="insurance_company_name" placeholder="Use only when insurer is not listed" /><Field label="Policy type" name="policy_type" placeholder="Comprehensive / Third-party" required defaultValue={values?.policy_type ?? ""} /></FormSection>
    <FormSection title="Coverage and validity" columns="three"><Field label="Insured declared value (IDV)" name="insured_declared_value" placeholder="Amount" type="number" min="0" defaultValue={values?.insured_declared_value?.toString() ?? ""} /><Field label="Start date" name="start_date" type="date" required defaultValue={values?.start_date ?? ""} /><Field label="End date" name="end_date" type="date" required defaultValue={values?.end_date ?? ""} /></FormSection>
  </EnterpriseForm>;
}

function EnterpriseForm({ action, cancelHref, submitLabel, children }: { action: FormAction; cancelHref: string; submitLabel: string; children: ReactNode }) {
  return <div className="mx-auto max-w-[1240px] pb-20"><form action={action} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">{children}<div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur"><Link href={cancelHref} className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155] hover:bg-[#F8FAFC]">Cancel</Link><FormSubmitButton label={submitLabel} /></div></form></div>;
}

function VehicleSection({ number, title, children, columns }: { number: string; title: string; children: ReactNode; columns: "two" | "three" | "four" | "five" }) {
  const grid = columns === "two" ? "md:grid-cols-2" : columns === "three" ? "md:grid-cols-2 xl:grid-cols-3" : columns === "four" ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
  return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
    <div className="flex min-h-14 items-center border-b border-[#E4EAF1] bg-[#FBFCFE] px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[10px] font-bold text-white">{number}</span>
        <h2 className="text-[13px] font-semibold text-[#17203A] sm:text-[14px]">{title}</h2>
      </div>
    </div>
    <div className={`grid min-w-0 grid-cols-1 gap-x-4 gap-y-4 p-4 sm:p-5 ${grid}`}>{children}</div>
  </section>;
}

function FormSection({ title, children, columns = "three" }: { title: string; children: ReactNode; columns?: "two" | "three" | "four" }) {
  const grid = columns === "two" ? "md:grid-cols-2" : columns === "four" ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3";
  return <section className="border-b border-[#E2E8F0] px-5 py-4 last:border-b-0"><div className="mb-3"><h3 className="text-[13px] font-semibold text-[#0F172A]">{title}</h3></div><div className={`grid gap-x-3 gap-y-3 ${grid}`}>{children}</div></section>;
}

function Field({ label, name, placeholder = "", type = "text", required = false, defaultValue, uppercase = false, variant = "default", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; uppercase?: boolean; variant?: "default" | "onboarding" }) {
  const fieldInputClass = variant === "onboarding" ? onboardingInputClass : inputClass;
  const fieldLabelClass = variant === "onboarding" ? onboardingLabelClass : labelClass;
  return <div className="min-w-0"><label className={fieldLabelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} type={type} placeholder={placeholder} required={required} defaultValue={defaultValue ?? ""} className={`${fieldInputClass} ${uppercase ? "uppercase" : ""}`} {...props} /></div>;
}

function SelectField({ label, name, options, emptyLabel, required = false, defaultValue, variant = "default" }: { label: string; name: string; options: SelectOption[]; emptyLabel: string; required?: boolean; defaultValue?: string | null; variant?: "default" | "onboarding" }) {
  const fieldInputClass = variant === "onboarding" ? onboardingInputClass : inputClass;
  const fieldLabelClass = variant === "onboarding" ? onboardingLabelClass : labelClass;
  return <div className="min-w-0"><label className={fieldLabelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} className={fieldInputClass} required={required} defaultValue={defaultValue ?? ""}><option value="">{emptyLabel}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
