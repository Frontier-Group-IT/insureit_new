import type { ReactNode } from "react";
import { Card } from "./shell";

export function CustomerForm() {
  return (
    <Card>
      <FormSection title="Customer profile" description="Capture commercial fleet ownership and primary contact information.">
        <Field label="Contact name" placeholder="Fleet owner or manager" />
        <Field label="Company name" placeholder="Transport company" />
        <Field label="Phone" placeholder="Primary mobile number" />
        <Field label="Email" placeholder="billing@example.com" />
        <Field label="City" placeholder="Mumbai" />
        <Field label="State" placeholder="Maharashtra" />
        <div className="grid gap-2 md:col-span-2"><label>Address</label><textarea rows={4} placeholder="Registered or operating address" /></div>
      </FormSection>
      <FormActions />
    </Card>
  );
}

export function VehicleForm() {
  return (
    <Card>
      <FormSection title="Vehicle and permit details" description="Maintain registration, commercial permit, chassis, and engine details.">
        <Field label="Vehicle number" placeholder="MH12AB1234" />
        <Field label="Customer" placeholder="Select customer" />
        <Field label="Vehicle type" placeholder="Truck / Bus / Taxi / Goods carrier" />
        <Field label="Make and model" placeholder="Tata 407" />
        <Field label="Chassis number" placeholder="Chassis number" />
        <Field label="Engine number" placeholder="Engine number" />
        <Field label="Permit number" placeholder="Commercial permit" />
        <Field label="Year" placeholder="2024" />
      </FormSection>
      <FormActions />
    </Card>
  );
}

export function PolicyForm() {
  return (
    <Card>
      <FormSection title="Insurance policy mapping" description="Connect the insurer, policy period, IDV, customer, and vehicle in one record.">
        <Field label="Policy number" placeholder="POL-123456" />
        <Field label="Insurance company" placeholder="Select insurer" />
        <Field label="Customer" placeholder="Select customer" />
        <Field label="Vehicle" placeholder="Select vehicle" />
        <Field label="Policy type" placeholder="Comprehensive / Third-party" />
        <Field label="IDV" placeholder="Insured declared value" />
        <Field label="Start date" type="date" />
        <Field label="End date" type="date" />
      </FormSection>
      <FormActions />
    </Card>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h3 className="text-lg font-semibold text-navy-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, placeholder = "", type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return <div className="grid gap-2"><label>{label}</label><input className="w-full" type={type} placeholder={placeholder} /></div>;
}

function FormActions() {
  return (
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
      <button className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="button">Cancel</button>
      <button className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-900" type="button">Save record</button>
    </div>
  );
}
