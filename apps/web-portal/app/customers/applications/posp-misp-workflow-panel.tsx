import { FormSubmitButton } from "@/components/form-submit-button";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  completePospMispDocumentStage,
  decidePospMispPartnerRoute,
  markPospMispReadyForOnboarding,
  movePospMispToIib,
  queuePospMispPanVerification,
  retryPospMispPanVerification
} from "./posp-misp-workflow-actions";

export type PospMispWorkflowProfile = {
  workflow_stage: "pre_iib" | "iib_processing" | "training" | "completed";
  partner_type: "posp" | "misp";
  requested_account_type: "posp" | "misp" | null;
  final_account_type: "posp" | "misp" | "partner" | null;
  partner_decision: "not_applicable" | "pending" | "convert_to_partner" | "do_not_proceed";
  partner_decision_at: string | null;
  partner_decision_remark: string | null;
  pan_number: string | null;
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

type PanVerificationJob = {
  status: "pending" | "queued" | "checking" | "matched" | "not_found" | "invalid" | "failed" | "manual_review";
  result_message: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  attempt_count: number;
  last_error: string | null;
  checked_by_device: string | null;
};

export async function PospMispWorkflowPanel({ applicationId, profile, documentCount = 0 }: { applicationId: string; profile: PospMispWorkflowProfile; documentCount?: number }) {
  const stage = profile.workflow_stage;
  const admin = createSupabaseAdminClient();
  const { data: panJob } = await admin
    .from("pan_verification_jobs")
    .select("status, result_message, requested_at, started_at, completed_at, attempt_count, last_error, checked_by_device")
    .eq("application_id", applicationId)
    .maybeSingle<PanVerificationJob>();

  const normalRoute = panJob?.status === "not_found";
  const partnerRoute = panJob?.status === "matched" && profile.partner_decision === "convert_to_partner" && profile.final_account_type === "partner";
  const canContinue = normalRoute || partnerRoute;
  const finalType = profile.final_account_type ?? profile.requested_account_type ?? profile.partner_type;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
      <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#64748B]">Onboarding progress</p>
            <h2 className="mt-1 text-sm font-semibold text-[#0F172A]">{stageTitle(stage)}</h2>
          </div>
          <span className="rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-1 text-[9px] font-semibold text-[#4338CA]">{accountLabel(finalType)}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <StepPill number="1" label="Primary & IIB" active={stage === "pre_iib"} done={stage !== "pre_iib"} />
          <StepPill number="2" label="Documents" active={stage === "iib_processing"} done={stage === "training" || stage === "completed"} />
          <StepPill number="3" label="Review" active={stage === "training" || stage === "completed"} done={stage === "completed"} />
        </div>
      </div>

      <PanVerificationCard applicationId={applicationId} panNumber={profile.pan_number} job={panJob} stage={stage} />

      {panJob?.status === "matched" && profile.partner_decision === "pending" ? (
        <div className="border-b border-[#F5D7A1] bg-[#FFF9ED] px-4 py-3">
          <p className="text-[10.5px] font-semibold text-[#8A4B08]">This PAN is already registered in IIB</p>
          <p className="mt-1 text-[9.5px] leading-4 text-[#9A5B13]">The applicant cannot be created again as a POSP or MISP. You can continue with a separate Partner account instead.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <form action={decidePospMispPartnerRoute}>
              <input type="hidden" name="application_id" value={applicationId} />
              <input type="hidden" name="partner_decision" value="convert_to_partner" />
              <FormSubmitButton label="Create as Partner" pendingLabel="Saving" className="inline-flex w-full items-center justify-center rounded-lg bg-[#0F2A55] px-3 py-2 text-[10.5px] font-semibold text-white" />
            </form>
            <form action={decidePospMispPartnerRoute}>
              <input type="hidden" name="application_id" value={applicationId} />
              <input type="hidden" name="partner_decision" value="do_not_proceed" />
              <FormSubmitButton label="Do Not Proceed" pendingLabel="Closing" className="inline-flex w-full items-center justify-center rounded-lg border border-[#F2B8B5] bg-white px-3 py-2 text-[10.5px] font-semibold text-[#B42318]" />
            </form>
          </div>
        </div>
      ) : null}

      {partnerRoute ? (
        <div className="border-b border-[#D8C7FF] bg-[#F7F3FF] px-4 py-3">
          <p className="text-[10.5px] font-semibold text-[#5B21B6]">Partner route selected</p>
          <p className="mt-1 text-[9.5px] leading-4 text-[#6D28D9]">The existing IIB record remains visible. This applicant will continue only as a Partner, not as a new POSP or MISP.</p>
        </div>
      ) : null}

      {stage === "pre_iib" ? (
        <div className="px-4 py-3">
          <p className="text-[9.5px] leading-4 text-[#64748B]">The IIB result is filled automatically by the N.M. browser extension. Continue when the applicant is cleared or the Partner route is selected.</p>
          <form action={movePospMispToIib} className="mt-3">
            <input type="hidden" name="application_id" value={applicationId} />
            <FormSubmitButton label={canContinue ? "Continue to Documents" : "Waiting for IIB Decision"} pendingLabel="Opening documents" disabled={!canContinue} className="inline-flex w-full items-center justify-center rounded-lg bg-[#4F46E5] px-4 py-2.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#A5B4FC]" />
          </form>
        </div>
      ) : null}

      {stage === "iib_processing" ? (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#FBFDFF] px-3 py-2.5">
            <div><p className="text-[10.5px] font-semibold text-[#0F172A]">Upload supporting documents</p><p className="mt-0.5 text-[9px] text-[#64748B]">Use the document section on this page. {documentCount} file{documentCount === 1 ? "" : "s"} currently attached.</p></div>
            <span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[9px] font-semibold text-[#4338CA]">Step 2</span>
          </div>
          <form action={completePospMispDocumentStage} className="mt-3">
            <input type="hidden" name="application_id" value={applicationId} />
            <FormSubmitButton label="Documents Complete" pendingLabel="Saving" disabled={documentCount < 1} className="inline-flex w-full items-center justify-center rounded-lg bg-[#4F46E5] px-4 py-2.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#A5B4FC]" />
          </form>
        </div>
      ) : null}

      {stage === "training" ? (
        <div className="px-4 py-3">
          <div className="rounded-xl border border-[#CDE8D8] bg-[#F2FBF6] px-3 py-3">
            <p className="text-[10.5px] font-semibold text-[#067647]">Ready for final review</p>
            <p className="mt-1 text-[9.5px] leading-4 text-[#23815A]">Primary information, IIB verification and documents are complete. Confirm the final account route before approval.</p>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-white/80 px-3 py-2"><span className="text-[9px] text-[#667085]">Final account type</span><strong className="text-[10px] text-[#0F172A]">{accountLabel(finalType)}</strong></div>
          </div>
          <form action={markPospMispReadyForOnboarding} className="mt-3">
            <input type="hidden" name="application_id" value={applicationId} />
            <FormSubmitButton label="Mark Ready for Onboarding" pendingLabel="Completing" className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-[11px] font-semibold text-white" />
          </form>
        </div>
      ) : null}

      {stage === "completed" ? <div className="px-4 py-4"><p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[10.5px] font-semibold text-emerald-800">Ready to create the {accountLabel(finalType)} account.</p></div> : null}
    </section>
  );
}

function PanVerificationCard({ applicationId, panNumber, job, stage }: { applicationId: string; panNumber: string | null; job: PanVerificationJob | null; stage: PospMispWorkflowProfile["workflow_stage"] }) {
  const status = job?.status ?? "not_queued";
  const tone = status === "not_found" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "matched" ? "border-amber-200 bg-amber-50 text-amber-800" : status === "invalid" || status === "manual_review" ? "border-red-200 bg-red-50 text-red-800" : status === "failed" ? "border-orange-200 bg-orange-50 text-orange-800" : "border-blue-200 bg-blue-50 text-blue-800";
  const canQueue = stage === "pre_iib" && (!job || ["failed", "invalid", "manual_review"].includes(job.status));
  const action = job ? retryPospMispPanVerification : queuePospMispPanVerification;

  return <div className="border-b border-[#E2E8F0] px-4 py-3">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#64748B]">Automatic IIB status</p><p className="mt-1 text-[11px] font-semibold text-[#0F172A]">{maskPan(panNumber)}</p></div><span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${tone}`}>{panStatusLabel(status)}</span></div>
    <p className="mt-2 text-[10px] leading-4 text-[#475569]">{panStatusMessage(status, job)}</p>
    {job?.checked_by_device ? <p className="mt-1 text-[9px] text-[#64748B]">Checked by {job.checked_by_device} · Attempt {job.attempt_count}</p> : null}
    {canQueue ? <form action={action} className="mt-3"><input type="hidden" name="application_id" value={applicationId} /><FormSubmitButton label={job ? "Retry IIB Check" : "Queue IIB Check"} pendingLabel="Queuing" className="inline-flex w-full items-center justify-center rounded-lg bg-[#0F2A55] px-3 py-2 text-[10.5px] font-semibold text-white" /></form> : null}
    {["pending", "queued", "checking"].includes(status) ? <p className="mt-2 text-[9px] font-medium text-blue-700">The N.M. browser extension will update this status automatically.</p> : null}
  </div>;
}

function StepPill({ number, label, active, done }: { number: string; label: string; active: boolean; done: boolean }) {
  const tone = done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : active ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-400";
  return <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${tone}`}><span className="flex h-4 w-4 items-center justify-center rounded-full bg-current/10 text-[8px] font-bold">{done ? "✓" : number}</span><span className="truncate text-[8.5px] font-semibold">{label}</span></div>;
}

function stageTitle(stage: PospMispWorkflowProfile["workflow_stage"]) {
  if (stage === "pre_iib") return "Primary information & IIB check";
  if (stage === "iib_processing") return "Document upload";
  if (stage === "training") return "Final review";
  return "Ready for onboarding";
}

function accountLabel(value: string | null) {
  if (value === "partner") return "Partner";
  return value?.toUpperCase() || "Pending route";
}

function maskPan(value: string | null) {
  const pan = value?.trim().toUpperCase() ?? "";
  return pan.length === 10 ? `${pan.slice(0, 2)}***${pan.slice(5, 8)}${pan.slice(-1)}` : "PAN unavailable";
}

function panStatusLabel(status: string) {
  const labels: Record<string, string> = { not_queued: "Not queued", pending: "Pending", queued: "Queued", checking: "Checking", matched: "Existing IIB record", not_found: "IIB cleared", invalid: "Invalid PAN", failed: "Check failed", manual_review: "Manual review" };
  return labels[status] ?? status.replaceAll("_", " ");
}

function panStatusMessage(status: string, job: PanVerificationJob | null) {
  if (status === "not_found") return job?.result_message ?? "No Data Found In POS System. Continue with the requested POSP or MISP route.";
  if (status === "matched") return job?.result_message ?? "Matching Record Found In DataBase. This applicant cannot be registered again as POSP/MISP, but may continue as a Partner.";
  if (status === "checking") return "The N.M. browser extension is checking this PAN in IIB POS.";
  if (status === "pending" || status === "queued") return "This PAN is waiting for the authorised N.M. browser extension.";
  if (status === "failed") return job?.last_error ?? "The previous IIB check failed. Retry when the extension is available.";
  if (status === "invalid") return "Correct the PAN in primary information before retrying.";
  if (status === "manual_review") return "This PAN requires an authorised review.";
  return "Queue this PAN for automatic IIB verification.";
}
