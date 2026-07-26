import { FormSubmitButton } from "@/components/form-submit-button";
import { CompactRegistrationForm } from "./compact-registration-form";
import { allotIntermediaryExam, assignIntermediaryTraining, updateIntermediaryExamResult, updateIntermediaryTrainingStatus } from "./training-exam-actions";

type Assignment = {
  training_title: string | null;
  training_url: string | null;
  training_instructions: string | null;
  training_assigned_at: string | null;
  training_deadline: string | null;
  training_status: string;
  exam_title: string | null;
  exam_url: string | null;
  passing_percentage: number | null;
  maximum_attempts: number | null;
  exam_duration_minutes: number | null;
  exam_available_from: string | null;
  exam_available_until: string | null;
  exam_status: string;
  exam_score: number | null;
  exam_attempts_used: number;
};

type Profile = {
  partner_type: "posp" | "misp";
  external_onboarding_id: string | null;
  document_received_at: string | null;
  pos_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  pan_number: string | null;
  gst_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  dp_name: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  dp_pan_number: string | null;
  aadhaar_number: string | null;
};

type Props = {
  applicationId: string;
  profile: Profile;
  assignment: Assignment | null;
  documents: Array<{ document_type: string; file_name: string }>;
  iibVerified: boolean;
  finalType: string | null;
};

const inputClass = "h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10.5px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#E7E5FF]";
const labelClass = "mb-1.5 block text-[9px] font-semibold uppercase tracking-[.05em] text-[#526178]";

export function TrainingExamStage({ applicationId, profile, assignment, documents, iibVerified, finalType }: Props) {
  const partnerRoute = finalType === "partner";
  if (partnerRoute) {
    return <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><h2 className="text-[12px] font-semibold text-violet-900">Business Associate onboarding</h2><p className="mt-1 text-[9.5px] text-violet-800">Training, examination and IIB registration are not applicable to this route.</p></section>;
  }

  const trainingAssigned = Boolean(assignment?.training_title && assignment.training_url);
  const trainingCompleted = assignment?.training_status === "completed";
  const examAllotted = Boolean(assignment?.exam_title && assignment.exam_url);
  const examPassed = assignment?.exam_status === "passed";

  return <div className="space-y-4">
    <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
      <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#64748B]">Stage 3</p><h2 className="mt-1 text-[13px] font-semibold text-[#0F172A]">Training and examination</h2></div>
      <div className="grid gap-4 p-4 xl:grid-cols-2">
        <div className="rounded-xl border border-[#DCE5EF] p-4">
          <div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="text-[11px] font-semibold text-[#0F172A]">Training material</h3><p className="mt-0.5 text-[9px] text-[#64748B]">External training link and status.</p></div><Status value={assignment?.training_status ?? "not_assigned"}/></div>
          {trainingAssigned ? <div className="space-y-3"><Info label="Training" value={assignment?.training_title ?? "-"}/><Info label="Deadline" value={formatDate(assignment?.training_deadline)}/><Info label="Instructions" value={assignment?.training_instructions ?? "-"}/><div className="flex flex-wrap gap-2"><a href={assignment?.training_url ?? "#"} target="_blank" rel="noreferrer" className="rounded-lg bg-[#071D49] px-3 py-2 text-[9.5px] font-semibold text-white">Open training link</a><form action={updateIntermediaryTrainingStatus} className="flex gap-2"><input type="hidden" name="application_id" value={applicationId}/><select name="training_status" defaultValue={assignment?.training_status ?? "assigned"} className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-2 text-[9.5px]"><option value="assigned">Assigned</option><option value="opened">Opened</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="expired">Expired</option></select><FormSubmitButton label="Update" pendingLabel="Updating" className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-[9.5px] font-semibold text-[#334155]"/></form></div></div> : <form action={assignIntermediaryTraining} className="grid gap-3"><input type="hidden" name="application_id" value={applicationId}/><Field label="Training title" name="training_title" defaultValue="POSP / MISP Training" required/><Field label="Training material URL" name="training_url" type="url" placeholder="https://" required/><Field label="Completion deadline" name="training_deadline" type="date"/><div><label className={labelClass}>Instructions</label><textarea name="training_instructions" className="min-h-20 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-[10.5px] outline-none focus:border-[#635BFF]"/></div><FormSubmitButton label="Assign training" pendingLabel="Assigning" className="rounded-lg bg-[#071D49] px-4 py-2.5 text-[10px] font-semibold text-white"/></form>}
        </div>

        <div className="rounded-xl border border-[#DCE5EF] p-4">
          <div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="text-[11px] font-semibold text-[#0F172A]">Examination</h3><p className="mt-0.5 text-[9px] text-[#64748B]">The exam stays locked until training is completed.</p></div><Status value={assignment?.exam_status ?? "not_allotted"}/></div>
          {!trainingAssigned ? <Empty text="Assign training material before allotting an examination."/> : examAllotted ? <div className="space-y-3"><Info label="Exam" value={assignment?.exam_title ?? "-"}/><Info label="Passing score" value={assignment?.passing_percentage !== null && assignment?.passing_percentage !== undefined ? `${assignment.passing_percentage}%` : "-"}/><Info label="Maximum attempts" value={String(assignment?.maximum_attempts ?? "-")}/><Info label="Duration" value={assignment?.exam_duration_minutes ? `${assignment.exam_duration_minutes} minutes` : "-"}/><div className="flex flex-wrap gap-2">{trainingCompleted ? <a href={assignment?.exam_url ?? "#"} target="_blank" rel="noreferrer" className="rounded-lg bg-[#4F46E5] px-3 py-2 text-[9.5px] font-semibold text-white">Open examination</a> : <span className="rounded-lg bg-[#F1F5F9] px-3 py-2 text-[9.5px] font-semibold text-[#64748B]">Locked until training completion</span>}<form action={updateIntermediaryExamResult} className="flex flex-wrap gap-2"><input type="hidden" name="application_id" value={applicationId}/><select name="exam_result" defaultValue={examPassed ? "passed" : "failed"} className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-2 text-[9.5px]"><option value="passed">Passed</option><option value="failed">Failed</option></select><input name="exam_score" type="number" min="0" max="100" step="0.01" placeholder="Score" className="h-9 w-20 rounded-lg border border-[#CBD5E1] px-2 text-[9.5px]"/><FormSubmitButton label="Save result" pendingLabel="Saving" className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-[9.5px] font-semibold text-[#334155]"/></form></div></div> : <form action={allotIntermediaryExam} className="grid gap-3"><input type="hidden" name="application_id" value={applicationId}/><Field label="Exam name" name="exam_title" defaultValue="Example Examination" required/><Field label="Exam URL" name="exam_url" type="url" placeholder="https://" required/><div className="grid grid-cols-2 gap-2"><Field label="Passing percentage" name="passing_percentage" type="number" min="1" max="100" defaultValue="60" required/><Field label="Maximum attempts" name="maximum_attempts" type="number" min="1" defaultValue="3" required/></div><div className="grid grid-cols-2 gap-2"><Field label="Duration (minutes)" name="exam_duration_minutes" type="number" min="1" defaultValue="30"/><Field label="Available from" name="exam_available_from" type="datetime-local"/></div><Field label="Available until" name="exam_available_until" type="datetime-local"/><FormSubmitButton label="Allot examination" pendingLabel="Allotting" className="rounded-lg bg-[#4F46E5] px-4 py-2.5 text-[10px] font-semibold text-white"/></form>}
        </div>
      </div>
    </section>

    <CompactRegistrationForm profile={profile} iibVerified={iibVerified} documents={documents}/>
  </div>;
}

function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) { return <div><label className={labelClass}>{label}{props.required ? " *" : ""}</label><input name={name} className={inputClass} {...props}/></div>; }
function Status({ value }: { value: string }) { return <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[8.5px] font-semibold capitalize text-[#475569]">{value.replaceAll("_", " ")}</span>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-[#F8FAFC] px-3 py-2"><p className="text-[8px] font-semibold uppercase tracking-[.05em] text-[#64748B]">{label}</p><p className="mt-1 text-[9.5px] font-medium text-[#0F172A]">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-8 text-center text-[9.5px] text-[#64748B]">{text}</div>; }
function formatDate(value: string | null | undefined) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN").format(date); }
