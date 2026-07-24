"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";

type ServerAction = (formData: FormData) => void | Promise<void>;

type Props = {
  kind: "rc" | "insurance";
  title: string;
  action: ServerAction;
  disabled?: boolean;
};

export function VerificationModalLauncher({ kind, title, action, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const heading = kind === "rc" ? "RC Copy Verification Details" : "Insurance Copy Verification Details";
  const helper = kind === "rc"
    ? "Please verify the validity of the following details from RC. Select date and status for each item."
    : "Please verify the following details from the insurance document. Enter information and save.";

  return (
    <>
      <button className="w-full rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-50" type="button" disabled={disabled} onClick={() => setOpen(true)}>Verify</button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-[680px] overflow-hidden rounded-[1.7rem] bg-white shadow-2xl ring-1 ring-slate-900/10">
            <div className="flex items-start gap-4 border-b border-slate-100 px-8 py-6">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-blue-50 text-3xl text-navy-900">{kind === "rc" ? "📄" : "🛡️"}</div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-black text-navy-900">{heading}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{helper}</p>
                <p className="mt-1 text-xs font-bold text-blue-700">{title}</p>
              </div>
              <button className="text-3xl leading-none text-navy-900" type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            </div>
            <form action={action}>
              <div className="max-h-[66vh] overflow-y-auto px-8 py-6">
                {kind === "rc" ? <RcVerificationFields /> : <InsuranceVerificationFields />}
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-100 bg-white px-8 py-5">
                <button className="rounded-xl border border-slate-300 bg-white px-8 py-3 text-sm font-black text-navy-900" type="button" onClick={() => setOpen(false)}>Cancel</button>
                <input type="hidden" name="notes" value={`${heading} saved.`} />
                <FormSubmitButton label="Save & Close" pendingLabel="Saving" className="inline-flex items-center justify-center rounded-xl bg-blue-900 px-10 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70" />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function InsuranceVerificationFields() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[170px_1fr_1fr] md:items-end">
        <StepLabel number={1} label="Insurance Start Date" />
        <InputField name="insurance_start_date" label="Start Date" type="date" required />
        <InputField name="insurance_end_date" label="End Date" type="date" required />
      </div>
      <ModalRow number={2} label="NCB Verification"><InputField name="ncb_percent" label="" type="number" required suffix="%" placeholder="Enter NCB %" /></ModalRow>
      <ModalRow number={3} label="Hazardous or Non Hazardous Policy"><SelectField name="policy_risk_type" options={["Hazardous", "Non Hazardous"]} required /></ModalRow>
      <ModalRow number={4} label="GVW Mention (in Kgs)"><InputField name="gvw_kg" label="" type="number" required suffix="Kgs" placeholder="Enter GVW" /></ModalRow>
    </div>
  );
}

function RcVerificationFields() {
  return (
    <div className="space-y-4">
      <ValidityRow number={1} name="fitness" label="Fitness Valid Upto" />
      <ValidityRow number={2} name="tax" label="Tax Valid Upto" />
      <ValidityRow number={3} name="insurance" label="Insurance Valid Upto" />
      <ValidityRow number={4} name="pucc" label="PUCC Valid Upto" />
      <ValidityRow number={5} name="local_permit" label="Local Permit Valid Upto" />
      <ValidityRow number={6} name="national_permit" label="National Permit Valid Upto" />
    </div>
  );
}

function ValidityRow({ number, name, label }: { number: number; name: string; label: string }) {
  return <div className="grid gap-4 border-b border-slate-100 pb-4 last:border-0 md:grid-cols-[190px_1fr_1fr] md:items-end"><StepLabel number={number} label={label} /><InputField name={`${name}_valid_upto`} label="Valid Upto" type="date" required /><SelectField name={`${name}_status`} options={["Valid", "Expired"]} required /></div>;
}

function ModalRow({ number, label, children }: { number: number; label: string; children: React.ReactNode }) {
  return <div className="grid gap-4 border-b border-slate-100 pb-4 last:border-0 md:grid-cols-[190px_1fr] md:items-end"><StepLabel number={number} label={label} />{children}</div>;
}

function StepLabel({ number, label }: { number: number; label: string }) {
  return <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-base font-black text-blue-900">{number}</span><span className="text-sm font-black text-navy-900">{label}</span></div>;
}

function InputField({ name, label, type = "text", required = false, suffix, placeholder }: { name: string; label: string; type?: string; required?: boolean; suffix?: string; placeholder?: string }) {
  return <label className="block">{label ? <span className="text-xs font-black text-navy-900">{label}{required ? " *" : ""}</span> : null}<div className="mt-1 flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2.5"><input name={name} type={type} required={required} placeholder={placeholder} className="w-full border-0 bg-transparent p-0 text-sm font-semibold text-navy-900 outline-none" />{suffix ? <span className="pl-2 text-xs font-black text-slate-500">{suffix}</span> : null}</div></label>;
}

function SelectField({ name, options, required = false }: { name: string; options: string[]; required?: boolean }) {
  return <select name={name} required={required} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-navy-900"><option value="">Select</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}
