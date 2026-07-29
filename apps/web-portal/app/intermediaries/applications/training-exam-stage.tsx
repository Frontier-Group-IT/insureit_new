import { FormSubmitButton } from "@/components/form-submit-button";
import { CompactRegistrationForm } from "./compact-registration-form";
import { IcallTrainingDashboard, type IcallTrainingAssignment } from "./icall-training-dashboard";
import { IcallUatPanel } from "./icall-uat-panel";
import {
  allotIntermediaryExam,
  assignIntermediaryTraining,
  updateIntermediaryExamResult,
  updateIntermediaryTrainingStatus,
} from "./training-exam-actions";
import { sendIntermediaryAgreement, updateIntermediaryAgreementStatus } from "./agreement-actions";

type Assignment = IcallTrainingAssignment & {
  training_instructions: string | null;
  exam_title: string | null;
  exam_url: string | null;
  passing_percentage: number | null;
  maximum_attempts: number | null;
  exam_duration_minutes: number | null;
  exam_available_from: string | null;
  exam_available_until: string | null;
  exam_allotted_at: string | null;
  exam_passed_at: string | null;
  exam_attempts_used: number;
  agreement_status: string;
  agreement_signing_url: string | null;
  agreement_sent_at: string | null;
  agreement_opened_at: string | null;
  agreement_signed_at: string | null;
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
  training_login_id: string | null;
  training_status: string | null;
  exam_status: string | null;
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
  if (finalType === "partner") {
    return <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><h2 className="text-[12px] font-semibold text-violet-900">Business Associate onboarding</h2><p className="mt-1 text-[9.5px] text-violet-800">Training, examination and IIB registration do not apply.</p></section>;
  }

  const registrationCompleted = documents.length > 0;
  const trainingAssigned = Boolean(assignment?.training_title && assignment.training_url);
  const trainingCompleted = assignment?.training_status === "completed";
  const examAllotted = Boolean(assignment?.exam_title && assignment.exam_url);
  const examPassed = assignment?.exam_status === "passed";
  const examFailed = assignment?.exam_status === "failed";
  const agreementSent = Boolean(assignment?.agreement_signing_url && ["sent", "opened", "signed"].includes(assignment?.agreement_status ?? ""));
  const agreementSigned = assignment?.agreement_status === "signed";
  const isIcall = profile.partner_type === "posp" || Boolean(assignment?.icall_login_id || assignment?.training_title?.startsWith("iCall POSP"));
  const currentStep = isIcall
    ? !registrationCompleted ? 1 : !examPassed ? 2 : !agreementSigned ? 3 : 4
    : !registrationCompleted ? 1 : !trainingCompleted ? 2 : !examPassed ? 3 : !agreementSigned ? 4 : 5;

  return <div id="qualification-process" className="space-y-4 scroll-mt-24">
    <ProcessHeader currentStep={currentStep} combined={isIcall} />

    <ProcessSection id="registration-requirement" number="1" title="Registration form" subtitle="Verified details and documents." state={registrationCompleted ? "completed" : "current"} statusText={registrationCompleted ? "Registration completed" : "Action required"}>
      {registrationCompleted ? <OutcomeDetails title="Registration outcome" facts={[{ label: "Result", value: "Completed" }, { label: "Documents", value: String(documents.length) }, { label: "PAN check", value: iibVerified ? "Cleared" : "Review required" }, { label: "Completed on", value: formatDateTime(profile.document_received_at) }]}><div className="border-t border-[#E5EAF0] pt-4"><CompactRegistrationForm profile={profile} iibVerified={iibVerified} documents={documents} /></div></OutcomeDetails> : <CompactRegistrationForm profile={profile} iibVerified={iibVerified} documents={documents} />}
    </ProcessSection>

    {registrationCompleted ? <ProcessSection id="training-requirement" number="2" title={isIcall ? "Training & Examination" : "Training"} subtitle={isIcall ? "Register, track training progress and fetch the final exam result from iCall." : "Assign and track training."} state={isIcall ? (examPassed ? "completed" : "current") : (trainingCompleted ? "completed" : "current")} statusText={isIcall ? (examPassed ? "Training and exam completed" : examFailed ? "Exam failed" : profile.training_login_id ? "Live status" : "Registration required") : (trainingCompleted ? "Training completed" : "Action required")}>
      {isIcall && !trainingAssigned ? <IcallUatPanel applicationId={applicationId} partnerType={profile.partner_type} loginId={profile.training_login_id} trainingStatus={profile.training_status} examStatus={profile.exam_status} /> : trainingAssigned && isIcall && assignment ? <IcallTrainingDashboard applicationId={applicationId} assignment={assignment} /> : trainingCompleted ? <OutcomeDetails title="Training outcome" facts={[{ label: "Result", value: "Completed" }, { label: "Training", value: assignment?.training_title ?? "-" }, { label: "Assigned on", value: formatDateTime(assignment?.training_assigned_at) }, { label: "Started on", value: formatDateTime(assignment?.training_started_at) }, { label: "Deadline", value: formatDateTime(assignment?.training_deadline) }, { label: "Completed on", value: formatDateTime(assignment?.training_completed_at) }]} /> : trainingAssigned ? <div className="space-y-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryFact label="Training" value={assignment?.training_title ?? "-"} />
          <SummaryFact label="Deadline" value={formatDateTime(assignment?.training_deadline)} />
          <SummaryFact label="Status" value={assignment?.training_status ?? "assigned"} />
        </div>
        {assignment?.training_instructions ? <SummaryFact label="Instructions" value={assignment.training_instructions} /> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <a href={assignment?.training_url ?? "#"} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#071D49] px-4 text-[10px] font-semibold text-white">Open training</a>
          <form action={updateIntermediaryTrainingStatus} className="grid min-w-0 flex-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <input type="hidden" name="application_id" value={applicationId} />
            <select name="training_status" defaultValue={assignment?.training_status ?? "assigned"} className="h-10 min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10px] sm:w-auto"><option value="assigned">Assigned</option><option value="opened">Opened</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="expired">Expired</option></select>
            <FormSubmitButton label="Save status" pendingLabel="Saving" className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-semibold text-[#334155]" />
          </form>
        </div>
      </div> : <form action={assignIntermediaryTraining} className="grid gap-3 lg:grid-cols-2"><input type="hidden" name="application_id" value={applicationId} /><Field label="Training title" name="training_title" defaultValue="POSP / MISP Training" required /><Field label="Training URL" name="training_url" type="url" placeholder="https://" required /><Field label="Deadline" name="training_deadline" type="date" /><div className="lg:col-span-2"><label className={labelClass}>Instructions</label><textarea name="training_instructions" className="min-h-24 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-[10.5px]" /></div><div className="lg:col-span-2"><FormSubmitButton label="Assign training" pendingLabel="Assigning" className="rounded-xl bg-[#071D49] px-5 py-2.5 text-[10px] font-semibold text-white" /></div></form>}
    </ProcessSection> : null}

    {trainingCompleted && !isIcall ? <ProcessSection id="examination-requirement" number="3" title="Examination" subtitle="Allot and record the result." state={examPassed ? "completed" : "current"} statusText={examPassed ? "Examination passed" : examFailed ? "Examination failed" : "Action required"}>
      {examPassed ? <OutcomeDetails title="Examination outcome" facts={examFacts(assignment)} /> : <div className="space-y-4">
        {examFailed ? <OutcomeDetails title="Latest examination result" facts={examFacts(assignment)} /> : null}
        {examAllotted ? <>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryFact label="Examination" value={assignment?.exam_title ?? "-"} />
            <SummaryFact label="Passing marks" value={assignment?.passing_percentage != null ? `${assignment.passing_percentage}%` : "-"} />
            <SummaryFact label="Attempts" value={`${assignment?.exam_attempts_used ?? 0}/${assignment?.maximum_attempts ?? "-"}`} />
            <SummaryFact label="Deadline" value={formatDateTime(assignment?.exam_available_until)} />
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <a href={assignment?.exam_url ?? "#"} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#4F46E5] px-4 text-[10px] font-semibold text-white">Open examination</a>
            <form action={updateIntermediaryExamResult} className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(130px,180px)_minmax(110px,150px)_auto] sm:items-center">
              <input type="hidden" name="application_id" value={applicationId} />
              <select name="exam_result" defaultValue="failed" className="h-10 min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10px]"><option value="passed">Passed</option><option value="failed">Failed</option></select>
              <input name="exam_score" type="number" min="0" max="100" step="0.01" placeholder="Marks" className="h-10 min-w-0 w-full rounded-xl border border-[#CBD5E1] px-3 text-[10px]" />
              <FormSubmitButton label="Record result" pendingLabel="Saving" className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-semibold text-[#334155]" />
            </form>
          </div>
        </> : <form action={allotIntermediaryExam} className="grid gap-3 lg:grid-cols-2"><input type="hidden" name="application_id" value={applicationId} /><Field label="Examination name" name="exam_title" defaultValue="POSP / MISP Examination" required /><Field label="Examination URL" name="exam_url" type="url" placeholder="https://" required /><Field label="Passing percentage" name="passing_percentage" type="number" min="1" max="100" defaultValue="60" required /><Field label="Maximum attempts" name="maximum_attempts" type="number" min="1" defaultValue="3" required /><Field label="Duration (minutes)" name="exam_duration_minutes" type="number" min="1" defaultValue="30" /><Field label="Available from" name="exam_available_from" type="datetime-local" /><Field label="Deadline" name="exam_available_until" type="datetime-local" /><div className="self-end"><FormSubmitButton label="Allot examination" pendingLabel="Allotting" className="rounded-xl bg-[#4F46E5] px-5 py-2.5 text-[10px] font-semibold text-white" /></div></form>}
      </div>}
    </ProcessSection> : null}

    {examPassed ? <ProcessSection id="agreement-requirement" number={isIcall ? "3" : "4"} title="Agreement" subtitle="Send and record signing." state={agreementSigned ? "completed" : "current"} statusText={agreementSigned ? "Agreement signed" : "Action required"}>
      {agreementSigned ? <OutcomeDetails title="Agreement outcome" facts={[{ label: "Result", value: "Signed" }, { label: "Sent on", value: formatDateTime(assignment?.agreement_sent_at) }, { label: "Opened on", value: formatDateTime(assignment?.agreement_opened_at) }, { label: "Signed on", value: formatDateTime(assignment?.agreement_signed_at) }]} /> : agreementSent ? <div className="space-y-4">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3"><SummaryFact label="Status" value={assignment?.agreement_status ?? "sent"} /><SummaryFact label="Sent on" value={formatDateTime(assignment?.agreement_sent_at)} /><SummaryFact label="Opened on" value={formatDateTime(assignment?.agreement_opened_at)} /></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"><a href={assignment?.agreement_signing_url ?? "#"} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0F766E] px-4 text-[10px] font-semibold text-white">Open agreement</a><form action={updateIntermediaryAgreementStatus} className="grid min-w-0 flex-1 gap-2 sm:flex sm:flex-wrap sm:items-center"><input type="hidden" name="application_id" value={applicationId} /><select name="agreement_status" defaultValue={assignment?.agreement_status ?? "sent"} className="h-10 min-w-0 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10px] sm:w-auto"><option value="sent">Sent</option><option value="opened">Opened</option><option value="signed">Signed</option><option value="declined">Declined</option><option value="expired">Expired</option><option value="failed">Failed</option></select><FormSubmitButton label="Save status" pendingLabel="Saving" className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-semibold text-[#334155]" /></form></div>
      </div> : <form action={sendIntermediaryAgreement} className="grid gap-3 sm:grid-cols-[1fr_auto]"><input type="hidden" name="application_id" value={applicationId} /><Field label="Signing URL" name="agreement_signing_url" type="url" placeholder="https://" required /><FormSubmitButton label="Send agreement" pendingLabel="Sending" className="self-end rounded-xl bg-[#0F766E] px-5 py-2.5 text-[10px] font-semibold text-white" /></form>}
    </ProcessSection> : null}
  </div>;
}

function ProcessHeader({ currentStep, combined }: { currentStep: number; combined: boolean }) {
  const labels = combined ? ["Registration", "Training & Examination", "Agreement"] : ["Registration", "Training", "Examination", "Agreement"];
  return <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm"><div className="bg-gradient-to-r from-[#071D49] to-[#163B70] px-5 py-4 text-white"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-white/60">Stage 3</p><h2 className="mt-1 text-[15px] font-semibold">Qualification and agreement</h2><p className="mt-1 text-[9.5px] text-white/70">Complete the current step to continue.</p></div><div className={`grid gap-px bg-[#E2E8F0] ${combined ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>{labels.map((label, index) => { const number = index + 1; const completed = currentStep > number; const current = currentStep === number; return <div key={label} className={`px-4 py-3 ${current ? "bg-[#EEF4FF]" : "bg-white"}`}><div className="flex items-center gap-2"><span className={`grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold ${completed ? "bg-emerald-600 text-white" : current ? "bg-[#071D49] text-white" : "bg-slate-100 text-slate-400"}`}>{completed ? "✓" : number}</span><div><p className={`text-[9.5px] font-semibold ${current ? "text-[#071D49]" : completed ? "text-emerald-800" : "text-slate-400"}`}>{label}</p><p className="text-[8px] text-[#64748B]">{completed ? "Completed" : current ? "Current" : "Upcoming"}</p></div></div></div>; })}</div></section>;
}

function ProcessSection({ id, number, title, subtitle, state, statusText, children }: { id: string; number: string; title: string; subtitle: string; state: "current" | "completed"; statusText: string; children: React.ReactNode }) {
  return <section id={id} className={`scroll-mt-24 overflow-hidden rounded-2xl border bg-white shadow-sm ${state === "completed" ? "border-[#D8E2EC]" : "border-[#BFD0E2]"}`}><div className={`flex items-center justify-between gap-4 border-b px-5 py-4 ${state === "completed" ? "border-[#E5EAF0] bg-white" : "border-[#DCE5EF] bg-[#F8FAFC]"}`}><div className="flex min-w-0 items-center gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold ${state === "completed" ? "bg-emerald-600 text-white" : "bg-[#071D49] text-white"}`}>{state === "completed" ? "✓" : number}</span><div className="min-w-0"><h3 className="text-[12px] font-semibold text-[#0F172A]">{title}</h3><p className="mt-0.5 text-[9px] text-[#64748B]">{subtitle}</p></div></div><span className={`shrink-0 text-[9px] font-semibold ${state === "completed" ? "text-emerald-700" : "text-blue-700"}`}>{statusText}</span></div><div className="p-4 sm:p-5">{children}</div></section>;
}

function OutcomeDetails({ title, facts, children }: { title: string; facts: Array<{ label: string; value: string }>; children?: React.ReactNode }) {
  return <details className="group"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-1"><div><p className="text-[10.5px] font-semibold text-[#0F172A]">{title}</p><p className="mt-0.5 text-[8.5px] text-[#64748B]">View details</p></div><span className="text-[13px] text-[#64748B] transition-transform group-open:rotate-180">⌄</span></summary><div className="mt-4 border-t border-[#E5EAF0] pt-2"><div className="divide-y divide-[#EDF1F5]">{facts.map((item) => <Info key={item.label} label={item.label} value={item.value} />)}</div>{children ? <div className="mt-4">{children}</div> : null}</div></details>;
}

function examFacts(assignment: Assignment | null) {
  return [{ label: "Result", value: assignment?.exam_status === "passed" ? "Passed" : "Failed" }, { label: "Marks obtained", value: assignment?.exam_score != null ? String(assignment.exam_score) : "-" }, { label: "Passing marks", value: assignment?.passing_percentage != null ? `${assignment.passing_percentage}%` : "-" }, { label: "Allotted on", value: formatDateTime(assignment?.exam_allotted_at) }, { label: "Available from", value: formatDateTime(assignment?.exam_available_from) }, { label: "Deadline", value: formatDateTime(assignment?.exam_available_until) }, { label: "Completed on", value: formatDateTime(assignment?.exam_completed_at) }, { label: "Attempts used", value: String(assignment?.exam_attempts_used ?? 0) }];
}

function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return <div><label className={labelClass}>{label}{props.required ? " *" : ""}</label><input name={name} className={inputClass} {...props} /></div>;
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-[#E6EBF2] bg-[#F8FAFC] px-3 py-3"><p className="text-[8.5px] font-semibold uppercase tracking-[.05em] text-[#7A8798]">{label}</p><p className="mt-1.5 min-w-0 whitespace-normal break-words text-[10.5px] font-medium leading-5 text-[#0F172A] [overflow-wrap:anywhere]">{value.replaceAll("_", " ")}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center"><p className="text-[8.5px] font-semibold uppercase tracking-[.05em] text-[#7A8798]">{label}</p><p className="min-w-0 whitespace-normal break-words text-[10px] font-medium capitalize text-[#0F172A] [overflow-wrap:anywhere]">{value.replaceAll("_", " ")}</p></div>;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}