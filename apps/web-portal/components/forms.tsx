import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "./shell";
import { FormSubmitButton } from "./form-submit-button";

type FormAction = (formData: FormData) => void | Promise<void>;

type SelectOption = {
  label: string;
  value: string;
};

type CustomerValues = {
  contact_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
};

type VehicleValues = {
  customer_id?: string | null;
  vehicle_no?: string | null;
  vehicle_type?: string | null;
  make?: string | null;
  model?: string | null;
  chassis_no?: string | null;
  engine_no?: string | null;
  permit_no?: string | null;
  year?: number | null;
};

type PolicyValues = {
  customer_id?: string | null;
  vehicle_id?: string | null;
  insurance_company_id?: string | null;
  policy_no?: string | null;
  policy_type?: string | null;
  insured_declared_value?: number | null;
  start_date?: string | null;
  end_date?: string | null;
};

export function CustomerForm({ action, values, submitLabel = "Save record" }: { action: FormAction; values?: CustomerValues; submitLabel?: string }) {
  return (
    <Card>
      <form action={action}>
        <FormSection title="Customer profile">
          <Field label="Contact name" name="contact_name" placeholder="Fleet owner or manager" required defaultValue={values?.contact_name} />
          <Field label="Company name" name="company_name" placeholder="Transport company" defaultValue={values?.company_name} />
          <Field label="Phone" name="phone" placeholder="Primary mobile number" required defaultValue={values?.phone} />
          <Field label="Email" name="email" placeholder="billing@example.com" type="email" defaultValue={values?.email} />
          <Field label="City" name="city" placeholder="Mumbai" defaultValue={values?.city} />
          <Field label="State" name="state" placeholder="Maharashtra" defaultValue={values?.state} />
          <div className="grid gap-2 md:col-span-2">
            <label htmlFor="address">Address</label>
            <textarea id="address" name="address" className="w-full" rows={4} placeholder="Registered or operating address" defaultValue={values?.address ?? ""} />
          </div>
        </FormSection>
        <FormActions cancelHref="/customers" submitLabel={submitLabel} />
      </form>
    </Card>
  );
}

export function VehicleForm({ action, customers, values, submitLabel = "Save record" }: { action: FormAction; customers: SelectOption[]; values?: VehicleValues; submitLabel?: string }) {
  return (
    <Card>
      <form action={action}>
        <FormSection title="Vehicle and permit details">
          <Field label="Vehicle number" name="vehicle_no" placeholder="MH12AB1234" required defaultValue={values?.vehicle_no} />
          <SelectField label="Customer" name="customer_id" options={customers} required defaultValue={values?.customer_id} emptyLabel="Select customer" />
          <Field label="Vehicle type" name="vehicle_type" placeholder="Truck / Bus / Taxi / Goods carrier" required defaultValue={values?.vehicle_type} />
          <Field label="Make" name="make" placeholder="Tata" defaultValue={values?.make} />
          <Field label="Model" name="model" placeholder="407" defaultValue={values?.model} />
          <Field label="Chassis number" name="chassis_no" placeholder="Chassis number" defaultValue={values?.chassis_no} />
          <Field label="Engine number" name="engine_no" placeholder="Engine number" defaultValue={values?.engine_no} />
          <Field label="Permit number" name="permit_no" placeholder="Commercial permit" defaultValue={values?.permit_no} />
          <Field label="Year" name="year" placeholder="2024" type="number" defaultValue={values?.year?.toString()} />
        </FormSection>
        <FormActions cancelHref="/vehicles" submitLabel={submitLabel} />
      </form>
    </Card>
  );
}

export function PolicyForm({ action, customers, vehicles, insurers, values, submitLabel = "Save record" }: { action: FormAction; customers: SelectOption[]; vehicles: SelectOption[]; insurers: SelectOption[]; values?: PolicyValues; submitLabel?: string }) {
  return (
    <Card>
      <form action={action}>
        <FormSection title="Insurance policy mapping">
          <Field label="Policy number" name="policy_no" placeholder="POL-123456" required defaultValue={values?.policy_no} />
          <SelectField label="Customer" name="customer_id" options={customers} required defaultValue={values?.customer_id} emptyLabel="Select customer" />
          <SelectField label="Vehicle" name="vehicle_id" options={vehicles} required defaultValue={values?.vehicle_id} emptyLabel="Select vehicle" />
          <SelectField label="Existing insurance company" name="insurance_company_id" options={insurers} defaultValue={values?.insurance_company_id} emptyLabel="Select insurer or enter a new one" />
          <Field label="New insurance company" name="insurance_company_name" placeholder="Insurer name" />
          <Field label="Policy type" name="policy_type" placeholder="Comprehensive / Third-party" required defaultValue={values?.policy_type} />
          <Field label="IDV" name="insured_declared_value" placeholder="Insured declared value" type="number" defaultValue={values?.insured_declared_value?.toString()} />
          <Field label="Start date" name="start_date" type="date" required defaultValue={values?.start_date} />
          <Field label="End date" name="end_date" type="date" required defaultValue={values?.end_date} />
        </FormSection>
        <FormActions cancelHref="/policies" submitLabel={submitLabel} />
      </form>
    </Card>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, name, placeholder = "", type = "text", required = false, defaultValue }: { label: string; name: string; placeholder?: string; type?: string; required?: boolean; defaultValue?: string | null }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} className="w-full" type={type} placeholder={placeholder} required={required} defaultValue={defaultValue ?? ""} />
    </div>
  );
}

function SelectField({ label, name, options, emptyLabel, required = false, defaultValue }: { label: string; name: string; options: SelectOption[]; emptyLabel: string; required?: boolean; defaultValue?: string | null }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} className="w-full" required={required} defaultValue={defaultValue ?? ""}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function FormActions({ cancelHref, submitLabel }: { cancelHref: string; submitLabel: string }) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
      <Link className="rounded-xl border border-slate-200 px-5 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50" href={cancelHref}>Cancel</Link>
      <FormSubmitButton label={submitLabel} />
    </div>
  );
}
