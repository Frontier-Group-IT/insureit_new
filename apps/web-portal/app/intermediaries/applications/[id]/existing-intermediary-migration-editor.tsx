"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateExistingIntermediaryMigrationDetails, type MigrationSaveState } from "./existing-intermediary-migration-actions";

type Props = {
  applicationId: string;
  accountType: "posp" | "misp";
  values: Record<string, unknown>;
  editable: boolean;
};

const inputClass = "h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition focus:border-[#635BFF] focus:ring-2 focus:ring-[#E7E5FF] disabled:bg-[#F8FAFC] disabled:text-[#475569]";
const labelClass = "mb-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#526178]";
const initialState: MigrationSaveState = { ok: true, message: "Migration fields save automatically." };

export function ExistingIntermediaryMigrationEditor({ applicationId, accountType, values, editable }: Props) {
  const registrationLabel = accountType === "misp" ? "Existing MISP ID" : "Existing POSP ID";
  const [state, formAction, pending] = useActionState(updateExistingIntermediaryMigrationDetails, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function scheduleSave() {
    if (!editable) return;
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (dirtyRef.current && formRef.current) {
        dirtyRef.current = false;
        formRef.current.requestSubmit();
      }
    }, 700);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-[#E7ECF3] bg-[#FAFBFD] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[12.5px] font-semibold text-[#17203A]">Existing Intermediary Migration</h2>
          <p className="mt-1 text-[9.5px] font-medium text-[#64748B]">Maintain historical IDs, original dates, workflow completion and verification notes imported from previous records.</p>
        </div>
        <p className={`text-[9px] font-semibold ${pending ? "text-indigo-600" : state.ok ? "text-emerald-700" : "text-red-700"}`} aria-live="polite">
          {pending ? "Saving migration changes…" : state.message}
        </p>
      </div>
      <form ref={formRef} action={formAction} onChange={scheduleSave} className="space-y-5 p-5">
        <input type="hidden" name="application_id" value={applicationId} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Existing Partner ID" name="legacy_partner_code" defaultValue={value(values, "legacy_partner_code")} disabled={!editable} />
          <Field label={registrationLabel} name="legacy_registration_code" defaultValue={value(values, "legacy_registration_code")} disabled={!editable} />
          <DateField label="Original Onboarding Date" name="legacy_original_onboarding_date" defaultValue={value(values, "legacy_original_onboarding_date")} disabled={!editable} />
          <DateField label="Original Activation Date" name="legacy_original_activation_date" defaultValue={value(values, "legacy_original_activation_date")} disabled={!editable} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Select label="Training Status" name="legacy_training_status" defaultValue={value(values, "legacy_training_status") || "unknown"} options={trainingOptions} disabled={!editable} />
          <Select label="Exam Status" name="legacy_exam_status" defaultValue={value(values, "legacy_exam_status") || "unknown"} options={examOptions} disabled={!editable} />
          <Select label="Agreement Status" name="legacy_agreement_status" defaultValue={value(values, "legacy_agreement_status") || "unknown"} options={agreementOptions} disabled={!editable} />
          <Select label="IIB Upload Status" name="legacy_iib_upload_status" defaultValue={value(values, "legacy_iib_upload_status") || "unknown"} options={iibUploadOptions} disabled={!editable} />
          <Select label="IIB Registration Status" name="legacy_iib_registration_status" defaultValue={value(values, "legacy_iib_registration_status") || "unknown"} options={iibRegistrationOptions} disabled={!editable} />
        </div>

        <div>
          <label className={labelClass} htmlFor="legacy_verification_remarks">Verification Remarks</label>
          <textarea id="legacy_verification_remarks" name="legacy_verification_remarks" defaultValue={value(values, "legacy_verification_remarks")} disabled={!editable} rows={4} className="w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-[11px] font-medium text-[#17203A] outline-none transition focus:border-[#635BFF] focus:ring-2 focus:ring-[#E7E5FF] disabled:bg-[#F8FAFC] disabled:text-[#475569]" placeholder="Record source, verification outcome, missing historical evidence or correction reason" />
        </div>
      </form>
    </section>
  );
}

function Field({ label, name, defaultValue, disabled }: { label: string; name: string; defaultValue: string; disabled: boolean }) {
  return <div><label className={labelClass} htmlFor={name}>{label}</label><input id={name} name={name} defaultValue={defaultValue} disabled={disabled} className={inputClass} /></div>;
}
function DateField({ label, name, defaultValue, disabled }: { label: string; name: string; defaultValue: string; disabled: boolean }) {
  return <div><label className={labelClass} htmlFor={name}>{label}</label><input id={name} name={name} type="date" defaultValue={defaultValue} disabled={disabled} className={inputClass} /></div>;
}
function Select({ label, name, defaultValue, options, disabled }: { label: string; name: string; defaultValue: string; options: Array<{ value: string; label: string }>; disabled: boolean }) {
  return <div><label className={labelClass} htmlFor={name}>{label}</label><select id={name} name={name} defaultValue={defaultValue} disabled={disabled} className={inputClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
function value(values: Record<string, unknown>, key: string) {
  const item = values[key];
  return typeof item === "string" ? item : "";
}

const trainingOptions = [
  { value: "unknown", label: "Unknown / Not recorded" },
  { value: "not_assigned", label: "Not assigned" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];
const examOptions = [
  { value: "unknown", label: "Unknown / Not recorded" },
  { value: "not_allotted", label: "Not allotted" },
  { value: "allotted", label: "Allotted" },
  { value: "in_progress", label: "In progress" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
];
const agreementOptions = [
  { value: "unknown", label: "Unknown / Not recorded" },
  { value: "not_started", label: "Not started" },
  { value: "sent", label: "Sent" },
  { value: "opened", label: "Opened" },
  { value: "signed", label: "Signed" },
];
const iibUploadOptions = [
  { value: "unknown", label: "Unknown / Not recorded" },
  { value: "pending", label: "Pending" },
  { value: "uploaded", label: "Uploaded" },
];
const iibRegistrationOptions = [
  { value: "unknown", label: "Unknown / Not recorded" },
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "registered", label: "Registered" },
];
