import type { ReactNode } from "react";
import Link from "next/link";
import { FormSubmitButton } from "./form-submit-button";

type FormAction = (formData: FormData) => void | Promise<void>;
type SelectOption = { label: string; value: string };
type CustomerValues = { contact_name?: string | null; company_name?: string | null; phone?: string | null; email?: string | null; city?: string | null; state?: string | null; address?: string | null; assigned_agent_id?: string | null };
type VehicleValues = { customer_id?: string | null; vehicle_no?: string | null; vehicle_type?: string | null; make?: string | null; model?: string | null; chassis_no?: string | null; engine_no?: string | null; permit_no?: string | null; year?: number | null };
type PolicyValues = { customer_id?: string | null; vehicle_id?: string | null; insurance_company_id?: string | null; policy_no?: string | null; policy_type?: string | null; insured_declared_value?: number | null; start_date?: string | null; end_date?: string | null };

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";

export function CustomerForm({ action, values, agents = [], submitLabel = "Save record" }: { action: FormAction; values?: CustomerValues; agents?: SelectOption[]; submitLabel?: string }) {
  return <EnterpriseForm action={action} cancelHref="/customers" submitLabel={submitLabel}>
    <FormSection title="Customer profile" columns="three"><Field label="Contact name" name="contact_name" placeholder="Fleet owner or manager" required defaultValue={values?.contact_name} /><Field label="Company name" name="company_name" placeholder="Transport company" defaultValue={values?.company_name} /><Field label="Phone" name="phone" placeholder="Primary mobile number" required defaultValue={values?.phone} /><Field label="Email" name="email" placeholder="billing@example.com" type="email" defaultValue={values?.email} /><SelectField label="Assigned agent" name="assigned_agent_id" options={agents} defaultValue={values?.assigned_agent_id} emptyLabel="No assigned agent" /><Field label="City" name="city" placeholder="Mumbai" defaultValue={values?.city} /><Field label="State" name="state" placeholder="Maharashtra" defaultValue={values?.state} /><div className="md:col-span-2 xl:col-span-3"><label className={labelClass} htmlFor="address">Address</label><textarea id="address" name="address" rows={3} className="w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]" defaultValue={values?.address ?? ""} /></div></FormSection>
  </EnterpriseForm>;
}

export function VehicleForm({ action, customers, manufacturers = [], values, submitLabel = "Save record" }: { action: FormAction; customers: SelectOption[]; manufacturers?: SelectOption[]; values?: VehicleValues; submitLabel?: string }) {
  return <EnterpriseForm action={action} cancelHref="/vehicles" submitLabel={submitLabel}>
    <FormSection title="Vehicle ownership" columns="three"><SelectField label="Customer" name="customer_id" options={customers} required defaultValue={values?.customer_id} emptyLabel="Select customer" /><Field label="Vehicle number" name="vehicle_no" placeholder="MH12AB1234" required defaultValue={values?.vehicle_no} uppercase /><Field label="Vehicle type" name="vehicle_type" placeholder="Truck / Bus / Goods carrier" required defaultValue={values?.vehicle_type} /></FormSection>
    <FormSection title="Manufacturer and identity" columns="three"><SelectField label="Manufacturer" name="make" options={manufacturers} required defaultValue={values?.make} emptyLabel="Select manufacturer" /><Field label="Model" name="model" placeholder="Model name" defaultValue={values?.model} /><Field label="Manufacturing year" name="year" placeholder="2024" type="number" min="1950" max="2100" defaultValue={values?.year?.toString()} /><Field label="Chassis number" name="chassis_no" placeholder="Chassis number" defaultValue={values?.chassis_no} uppercase /><Field label="Engine number" name="engine_no" placeholder="Engine number" defaultValue={values?.engine_no} uppercase /></FormSection>
    <FormSection title="Commercial permit" columns="three"><Field label="Permit number" name="permit_no" placeholder="Commercial permit number" defaultValue={values?.permit_no} uppercase /></FormSection>
  </EnterpriseForm>;
}

export function PolicyForm({ action, customers, vehicles, insurers, values, submitLabel = "Save record" }: { action: FormAction; customers: SelectOption[]; vehicles: SelectOption[]; insurers: SelectOption[]; values?: PolicyValues; submitLabel?: string }) {
  return <EnterpriseForm action={action} cancelHref="/policies" submitLabel={submitLabel}>
    <FormSection title="Policy mapping" columns="three"><SelectField label="Customer" name="customer_id" options={customers} required defaultValue={values?.customer_id} emptyLabel="Select customer" /><SelectField label="Vehicle" name="vehicle_id" options={vehicles} required defaultValue={values?.vehicle_id} emptyLabel="Select vehicle" /><Field label="Policy number" name="policy_no" placeholder="POL-123456" required defaultValue={values?.policy_no} uppercase /></FormSection>
    <FormSection title="Insurer details" columns="three"><SelectField label="Existing insurance company" name="insurance_company_id" options={insurers} defaultValue={values?.insurance_company_id} emptyLabel="Select insurer" /><Field label="New insurance company" name="insurance_company_name" placeholder="Use only when insurer is not listed" /><Field label="Policy type" name="policy_type" placeholder="Comprehensive / Third-party" required defaultValue={values?.policy_type} /></FormSection>
    <FormSection title="Coverage and validity" columns="three"><Field label="Insured declared value (IDV)" name="insured_declared_value" placeholder="Amount" type="number" min="0" defaultValue={values?.insured_declared_value?.toString()} /><Field label="Start date" name="start_date" type="date" required defaultValue={values?.start_date} /><Field label="End date" name="end_date" type="date" required defaultValue={values?.end_date} /></FormSection>
  </EnterpriseForm>;
}

function EnterpriseForm({ action, cancelHref, submitLabel, children }: { action: FormAction; cancelHref: string; submitLabel: string; children: ReactNode }) {
  return <div className="mx-auto max-w-[1240px] pb-20"><form action={action} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">{children}<div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur"><Link href={cancelHref} className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155] hover:bg-[#F8FAFC]">Cancel</Link><FormSubmitButton label={submitLabel} /></div></form></div>;
}

function FormSection({ title, children, columns = "three" }: { title: string; children: ReactNode; columns?: "two" | "three" | "four" }) {
  const grid = columns === "two" ? "md:grid-cols-2" : columns === "four" ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3";
  return <section className="border-b border-[#E2E8F0] px-5 py-4 last:border-b-0"><div className="mb-3"><h3 className="text-[13px] font-semibold text-[#0F172A]">{title}</h3></div><div className={`grid gap-x-3 gap-y-3 ${grid}`}>{children}</div></section>;
}

function Field({ label, name, placeholder = "", type = "text", required = false, defaultValue, uppercase = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; uppercase?: boolean }) {
  return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><input id={name} name={name} type={type} placeholder={placeholder} required={required} defaultValue={defaultValue ?? ""} className={`${inputClass} ${uppercase ? "uppercase" : ""}`} onInput={uppercase ? (event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase(); } : undefined} {...props} /></div>;
}

function SelectField({ label, name, options, emptyLabel, required = false, defaultValue }: { label: string; name: string; options: SelectOption[]; emptyLabel: string; required?: boolean; defaultValue?: string | null }) {
  return <div><label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label><select id={name} name={name} className={inputClass} required={required} defaultValue={defaultValue ?? ""}><option value="">{emptyLabel}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
