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

type PanJob = {
  status: "pending" | "queued" | "checking" | "matched" | "not_found" | "invalid" | "failed" | "manual_review";
  result_message: string | null;
  attempt_count: number;
  last_error: string | null;
  checked_by_device: string | null;
};

type RouteState = {
  requested_account_type: "posp" | "misp" | null;
  final_account_type: "posp" | "misp" | "partner" | null;
  partner_decision: "not_applicable" | "pending" | "convert_to_partner" | "do_not_proceed";
};

export async function PospMispWorkflowPanel({ applicationId, profile }: { applicationId: string; profile: PospMispWorkflowProfile }) {
  const admin = createSupabaseAdminClient();
  const [{ data: job }, { data: route }, { count: documentCount }] = await Promise.all([
    admin.from("pan_verification_jobs").select("status,result_message,attempt_count,last_error,checked_by_device").eq("application_id", applicationId).maybeSingle<PanJob>(),
    admin.from("posp_misp_onboarding_profiles").select("requested_account_type,final_account_type,partner_decision").eq("application_id", applicationId).maybeSingle<RouteState>(),
    admin.from("customer_onboarding_documents").select("id", { count: "exact", head: true }).eq("application_id", applicationId)
  ]);

  const stage = profile.workflow_stage;
  const partnerDecision = route?.partner_decision ?? "not_applicable";
  const partnerRoute = job?.status === "matched" && partnerDecision === "convert_to_partner";
  const canContinue = job?.status === "not_found" || partnerRoute;
  const finalType = route?.final_account_type ?? route?.requested_account_type ?? profile.partner_type;

  return <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
    <header className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#64748B]">Onboarding progress</p><h2 className="mt-1 text-sm font-semibold text-[#0F172A]">{stageTitle(stage)}</h2></div>
        <span className="rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-1 text-[9px] font-semibold text-[#4338CA]">{accountLabel(finalType)}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Step number="1" label="Primary & IIB" active={stage === "pre_iib"} done={stage !== "pre_iib"} />
        <Step number="2" label="Documents" active={stage === "iib_processing"} done={stage === "training" || stage === "completed"} />
        <Step number="3" label="Review" active={stage === "training" || stage === "completed"} done={stage === "completed"} />
      </div>
    </header>

    <PanCard applicationId={applicationId} pan={profile.pan_number} job={job} stage={stage} />

    {job?.status === "matched" && partnerDecision === "pending" ? <section className="border-b border-[#F5D7A1] bg-[#FFF9ED] px-4 py-3">
      <p className="text-[10.5px] font-semibold text-[#8A4B08]">Existing IIB registration found</p>
      <p className="mt-1 text-[9.5px] leading-4 text-[#9A5B13]">This applicant cannot be registered again as POSP/MISP. Continue as a separate Partner account, or close the application.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <DecisionForm applicationId={applicationId} decision="convert_to_partner" label="Create as Partner" />
        <DecisionForm applicationId={applicationId} decision="do_not_proceed" label="Do Not Proceed" danger />
      </div>
    </section> : null}

    {partnerRoute ? <div className="border-b border-[#D8C7FF] bg-[#F7F3FF] px-4 py-3"><p className="text-[10.5px] font-semibold text-[#5B21B6]">Partner route selected</p><p className="mt-1 text-[9.5px] leading-4 text-[#6D28D9]">The existing IIB result remains visible. The applicant will continue only as a Partner.</p></div> : null}

    {stage === "pre_iib" ? <section className="px-4 py-3">
      <p className="text-[9.5px] leading-4 text-[#64748B]">IIB status is filled automatically by the N.M. extension. Continue after clearance or Partner selection.</p>
      <form action={movePospMispToIib} className="mt-3"><input type="hidden" name="application_id" value={applicationId} /><FormSubmitButton label={canContinue ? "Continue to Documents" : "Waiting for IIB Decision"} pendingLabel="Opening documents" disabled={!canContinue} className={primaryButton} /></form>
    </section> : null}

    {stage === "iib_processing" ? <section className="px-4 py-3">
      <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#FBFDFF] px-3 py-2.5"><div><p className="text-[10.5px] font-semibold text-[#0F172A]">Supporting documents</p><p className="mt-0.5 text-[9px] text-[#64748B]">Upload files in the document section below. {documentCount ?? 0} attached.</p></div><span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[9px] font-semibold text-[#4338CA]">Step 2</span></div>
      <form action={completePospMispDocumentStage} className="mt-3"><input type="hidden" name="application_id" value={applicationId} /><FormSubmitButton label="Documents Complete" pendingLabel="Saving" disabled={!documentCount} className={primaryButton} /></form>
    </section> : null}

    {stage === "training" ? <section className="px-4 py-3">
      <div className="rounded-xl border border-[#CDE8D8] bg-[#F2FBF6] px-3 py-3"><p className="text-[10.5px] font-semibold text-[#067647]">Ready for final review</p><p className="mt-1 text-[9.5px] leading-4 text-[#23815A]">Primary information, IIB verification and documents are complete.</p><div className="mt-2 flex items-center justify-between rounded-lg bg-white/80 px-3 py-2"><span className="text-[9px] text-[#667085]">Final account type</span><strong className="text-[10px] text-[#0F172A]">{accountLabel(finalType)}</strong></div></div>
      <form action={markPospMispReadyForOnboarding} className="mt-3"><input type="hidden" name="application_id" value={applicationId} /><FormSubmitButton label="Mark Ready for Onboarding" pendingLabel="Completing" className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-[11px] font-semibold text-white" /></form>
    </section> : null}

    {stage === "completed" ? <div className="px-4 py-4"><p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[10.5px] font-semibold text-emerald-800">Ready to create the {accountLabel(finalType)} account.</p></div> : null}
  </section>;
}

const primaryButton = "inline-flex w-full items-center justify-center rounded-lg bg-[#4F46E5] px-4 py-2.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#A5B4FC]";

function PanCard({ applicationId, pan, job, stage }: { applicationId: string; pan: string | null; job: PanJob | null; stage: PospMispWorkflowProfile["workflow_stage"] }) {
  const status = job?.status ?? "not_queued";
  const tone = status === "not_found" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "matched" ? "border-amber-200 bg-amber-50 text-amber-800" : status === "invalid" || status === "manual_review" ? "border-red-200 bg-red-50 text-red-800" : status === "failed" ? "border-orange-200 bg-orange-50 text-orange-800" : "border-blue-200 bg-blue-50 text-blue-800";
  const canQueue = stage === "pre_iib" && (!job || ["failed", "invalid", "manual_review"].includes(job.status));
  const action = job ? retryPospMispPanVerification : queuePospMispPanVerification;
  return <section className="border-b border-[#E2E8F0] px-4 py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#64748B]">Automatic IIB status</p><p className="mt-1 text-[11px] font-semibold text-[#0F172A]">{maskPan(pan)}</p></div><span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${tone}`}>{statusLabel(status)}</span></div><p className="mt-2 text-[10px] leading-4 text-[#475569]">{statusMessage(status, job)}</p>{job?.checked_by_device ? <p className="mt-1 text-[9px] text-[#64748B]">Checked by {job.checked_by_device} · Attempt {job.attempt_count}</p> : null}{canQueue ? <form action={action} className="mt-3"><input type="hidden" name="application_id" value={applicationId} /><FormSubmitButton label={job ? "Retry IIB Check" : "Queue IIB Check"} pendingLabel="Queuing" className="inline-flex w-full items-center justify-center rounded-lg bg-[#0F2A55] px-3 py-2 text-[10.5px] font-semibold text-white" /></form> : null}{["pending", "queued", "checking"].includes(status) ? <p className="mt-2 text-[9px] font-medium text-blue-700">The N.M. browser extension will update this automatically.</p> : null}</section>;
}

function DecisionForm({ applicationId, decision, label, danger = false }: { applicationId: string; decision: string; label: string; danger?: boolean }) {
  return <form action={decidePospMispPartnerRoute}><input type="hidden" name="application_id" value={applicationId} /><input type="hidden" name="partner_decision" value={decision} /><FormSubmitButton label={label} pendingLabel="Saving" className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-[10.5px] font-semibold ${danger ? "border border-[#F2B8B5] bg-white text-[#B42318]" : "bg-[#0F2A55] text-white"}`} /></form>;
}

function Step({ number, label, active, done }: { number: string; label: string; active: boolean; done: boolean }) {
  const tone = done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : active ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-400";
  return <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${tone}`}><span className="text-[8px] font-bold">{done ? "✓" : number}</span><span className="truncate text-[8.5px] font-semibold">{label}</span></div>;
}

function stageTitle(stage: PospMispWorkflowProfile["workflow_stage"]) { return stage === "pre_iib" ? "Primary information & IIB check" : stage === "iib_processing" ? "Document upload" : stage === "training" ? "Final review" : "Ready for onboarding"; }
function accountLabel(value: string | null) { return value === "partner" ? "Partner" : value?.toUpperCase() || "Pending route"; }
function maskPan(value: string | null) { const pan = value?.trim().toUpperCase() ?? ""; return pan.length === 10 ? `${pan.slice(0, 2)}***${pan.slice(5, 8)}${pan.slice(-1)}` : "PAN unavailable"; }
function statusLabel(status: string) { return ({ not_queued: "Not queued", pending: "Pending", queued: "Queued", checking: "Checking", matched: "Existing IIB record", not_found: "IIB cleared", invalid: "Invalid PAN", failed: "Check failed", manual_review: "Manual review" } as Record<string,string>)[status] ?? status.replaceAll("_", " "); }
function statusMessage(status: string, job: PanJob | null) { if (status === "not_found") return job?.result_message ?? "No Data Found In POS System. Continue as POSP/MISP."; if (status === "matched") return job?.result_message ?? "Matching Record Found In DataBase. Continue only as a Partner if required."; if (status === "checking") return "The N.M. extension is checking this PAN in IIB POS."; if (status === "pending" || status === "queued") return "Waiting for the authorised N.M. extension."; if (status === "failed") return job?.last_error ?? "The previous IIB check failed."; if (status === "invalid") return "Correct the PAN before retrying."; return "Queue this PAN for automatic IIB verification."; }
