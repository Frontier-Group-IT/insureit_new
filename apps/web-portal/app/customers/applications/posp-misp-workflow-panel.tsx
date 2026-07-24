import { FormSubmitButton } from "@/components/form-submit-button";
import { IndianDateField } from "@/components/indian-date-field";
import { completePospMispTraining, movePospMispToIib, savePospMispIibOutcome } from "./posp-misp-workflow-actions";

export type PospMispWorkflowProfile = {
  workflow_stage: "pre_iib" | "iib_processing" | "training" | "completed";
  iib_remarks: string | null;
  iib_uploaded: boolean;
  iib_uploaded_at: string | null;
  training_login_id: string | null;
  training_credentials_shared_flag: boolean;
  training_start_date: string | null;
  training_end_date: string | null;
  training_status: string | null;
  training_certificate_number: string | null;
  exam_status: string | null;
  onboarding_date: string | null;
};

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[11px] text-[#17203A] outline-none focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10px] font-semibold text-[#344054]";

export function PospMispWorkflowPanel({ applicationId, profile }: { applicationId: string; profile: PospMispWorkflowProfile }) {
  const stage = profile.workflow_stage;
  return (
    <section className="overflow-hidden rounded-xl border border-[#DCE5EF] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#64748B]">Operational workflow</p>
          <h2 className="mt-1 text-sm font-semibold text-[#0F172A]">{stageLabel(stage)}</h2>
        </div>
        <span className="rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-1 text-[9.5px] font-semibold text-[#4338CA]">{stage.replaceAll("_", " ")}</span>
      </div>

      <div className="border-b border-[#E2E8F0] px-4 py-3">
        <p className="text-[10.5px] font-medium text-[#475569]">Registration form</p>
        <p className="mt-1 text-[9.5px] text-[#64748B]">Download the prefilled form generated from the saved onboarding record.</p>
        <a href={`/customers/applications/${applicationId}/registration-form`} download className="mt-2 inline-flex rounded-md bg-[#0F2A55] px-3 py-2 text-[10.5px] font-semibold text-white">Download PDF</a>
      </div>

      {stage === "pre_iib" ? (
        <form action={movePospMispToIib} className="px-4 py-3">
          <input type="hidden" name="application_id" value={applicationId} />
          <p className="text-[10px] leading-4 text-[#64748B]">Confirm the pre-IIB information and documents before handing the case to the IIB portal workflow.</p>
          <FormSubmitButton label="Start IIB Processing" pendingLabel="Starting" className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-[#4F46E5] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-70" />
        </form>
      ) : null}

      {stage === "iib_processing" ? (
        <form action={savePospMispIibOutcome} className="space-y-3 px-4 py-3">
          <input type="hidden" name="application_id" value={applicationId} />
          <Select label="IIB Remarks" name="iib_remarks" defaultValue={profile.iib_remarks ?? ""} options={["Matching Record Found In DataBase", "No Data Found In POS System"]} />
          <label className="flex items-center gap-2 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[10.5px] font-semibold text-[#344054]">
            <input type="checkbox" name="iib_uploaded" value="true" defaultChecked={profile.iib_uploaded} className="h-4 w-4" />
            Details uploaded to IIB
          </label>
          <IndianDateField label="IIB Upload Date" name="iib_uploaded_at" defaultValue={profile.iib_uploaded_at} required />
          <FormSubmitButton label="Complete IIB Stage" pendingLabel="Saving" className="inline-flex w-full items-center justify-center rounded-md bg-[#4F46E5] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-70" />
        </form>
      ) : null}

      {stage === "training" ? (
        <form action={completePospMispTraining} className="space-y-3 px-4 py-3">
          <input type="hidden" name="application_id" value={applicationId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Training Login ID" name="training_login_id" defaultValue={profile.training_login_id ?? ""} required />
            <Field label="Training Password" name="training_password" type="password" required />
            <IndianDateField label="Training Start Date" name="training_start_date" defaultValue={profile.training_start_date} required />
            <IndianDateField label="Training End Date" name="training_end_date" defaultValue={profile.training_end_date} required />
            <Field label="Training Status" name="training_status" defaultValue={profile.training_status ?? ""} required />
            <Field label="Certificate Number" name="training_certificate_number" defaultValue={profile.training_certificate_number ?? ""} />
            <Field label="Exam Status" name="exam_status" defaultValue={profile.exam_status ?? ""} required />
            <IndianDateField label="Onboarding Date" name="onboarding_date" defaultValue={profile.onboarding_date} required />
          </div>
          <label className="flex items-center gap-2 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-[10.5px] font-semibold text-[#344054]">
            <input type="checkbox" name="training_credentials_shared_flag" value="true" defaultChecked={profile.training_credentials_shared_flag} className="h-4 w-4" />
            Training credentials shared
          </label>
          <label>
            <span className={labelClass}>Agreement Copy *</span>
            <input name="agreement_copy" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="block w-full rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-[10px] file:mr-2 file:rounded-md file:border-0 file:bg-[#EEF2FF] file:px-2.5 file:py-1.5 file:text-[9.5px] file:font-semibold file:text-[#4338CA]" />
          </label>
          <FormSubmitButton label="Complete Training Stage" pendingLabel="Completing" className="inline-flex w-full items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-70" />
        </form>
      ) : null}

      {stage === "completed" ? <p className="px-4 py-4 text-[10.5px] font-medium text-emerald-700">IIB, training and post-IIB documentation are complete. This application is ready for approval.</p> : null}
    </section>
  );
}

function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <div><label className={labelClass} htmlFor={name}>{label}{props.required ? " *" : ""}</label><input id={name} name={name} className={inputClass} {...props} /></div>;
}

function Select({ label, name, options, defaultValue }: { label: string; name: string; options: string[]; defaultValue: string }) {
  return <div><label className={labelClass} htmlFor={name}>{label} *</label><select id={name} name={name} required defaultValue={defaultValue} className={inputClass}><option value="">Select IIB remark</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
}

function stageLabel(stage: PospMispWorkflowProfile["workflow_stage"]) {
  if (stage === "pre_iib") return "Pre-IIB collection";
  if (stage === "iib_processing") return "IIB portal processing";
  if (stage === "training") return "Training and post-IIB documents";
  return "Operational onboarding complete";
}
