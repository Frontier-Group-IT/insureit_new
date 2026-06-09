import { Card } from "./shell";

export function CustomerForm() {
  return (
    <Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Contact name" placeholder="Fleet owner or manager" />
        <Field label="Company name" placeholder="Transport company" />
        <Field label="Phone" placeholder="Primary mobile number" />
        <Field label="Email" placeholder="billing@example.com" />
        <Field label="City" placeholder="Mumbai" />
        <Field label="State" placeholder="Maharashtra" />
        <div className="md:col-span-2 grid gap-2"><label>Address</label><textarea rows={4} placeholder="Registered or operating address" /></div>
      </div>
      <FormActions />
    </Card>
  );
}

export function VehicleForm() {
  return (
    <Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Vehicle number" placeholder="MH12AB1234" />
        <Field label="Customer" placeholder="Select customer" />
        <Field label="Vehicle type" placeholder="Truck / Bus / Taxi / Goods carrier" />
        <Field label="Make and model" placeholder="Tata 407" />
        <Field label="Chassis number" placeholder="Chassis number" />
        <Field label="Engine number" placeholder="Engine number" />
        <Field label="Permit number" placeholder="Commercial permit" />
        <Field label="Year" placeholder="2024" />
      </div>
      <FormActions />
    </Card>
  );
}

export function PolicyForm() {
  return (
    <Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Policy number" placeholder="POL-123456" />
        <Field label="Insurance company" placeholder="Select insurer" />
        <Field label="Customer" placeholder="Select customer" />
        <Field label="Vehicle" placeholder="Select vehicle" />
        <Field label="Policy type" placeholder="Comprehensive / Third-party" />
        <Field label="IDV" placeholder="Insured declared value" />
        <Field label="Start date" type="date" />
        <Field label="End date" type="date" />
      </div>
      <FormActions />
    </Card>
  );
}

function Field({ label, placeholder = "", type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return <div className="grid gap-2"><label>{label}</label><input type={type} placeholder={placeholder} /></div>;
}

function FormActions() {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <button className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white" type="button">Save record</button>
      <button className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700" type="button">Cancel</button>
    </div>
  );
}
