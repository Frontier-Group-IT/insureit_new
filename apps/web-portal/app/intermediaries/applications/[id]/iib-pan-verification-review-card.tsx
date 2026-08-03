import Link from "next/link";
import { FormSubmitButton } from "@/components/form-submit-button";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { PanVerificationAutoRefresh } from "@/app/customers/applications/pan-verification-auto-refresh";
import { queuePospMispPanVerification, retryPospMispPanVerification } from "@/app/customers/applications/posp-misp-workflow-actions";

type PanJobStatus = "pending" | "queued" | "checking" | "matched" | "not_found" | "invalid" | "failed" | "manual_review";
type PanJob = {
  status: PanJobStatus;
  result_message: string | null;
  last_error: string | null;
  checked_by_device: string | null;
  requested_at: string | null;
  started_at: string | null;
  completed_at: string | null;
};
type Profile = {
  partner_type: "posp" | "misp";
  pan_number: string | null;
  dp_pan_number: string | null;
  workflow_stage: string;
};

export async function IibPanVerificationReviewCard({ applicationId }: { applicationId: string }) {
  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: job }] = await Promise.all([
    admin.from("posp_misp_onboarding_profiles").select("partner_type,pan_number,dp_pan_number,workflow_stage").eq("application_id", applicationId).maybeSingle<Profile>(),
    admin.from("pan_verification_jobs").select("status,result_message,last_error,checked_by_device,requested_at,started_at,completed_at").eq("application_id", applicationId).maybeSingle<PanJob>(),
  ]);

  if (!profile) return null;

  const pan = profile.partner_type === "misp" ? profile.dp_pan_number : profile.pan_number;
  const status = job?.status ?? "pending";
  const activelyRefreshing = status === "pending" || status === "queued" || status === "checking";
  const canQueue = profile.workflow_stage === "pre_iib" && !job;
  const canRetry = profile.workflow_stage === "pre_iib" && (status === "failed" || status === "invalid");
  const meta = job?.completed_at ?? job?.started_at ?? job?.requested_at;
  const presentation = statusPresentation(status, Boolean(job));

  return (
    <aside className="fixed bottom-5 right-5 z-40 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-[#D8E2F0] bg-white/95 p-3 shadow-[0_18px_55px_rgba(15,23,42,.18)] backdrop-blur">
      <PanVerificationAutoRefresh enabled={activelyRefreshing && Boolean(job)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[8.5px] font-semibold uppercase tracking-[.12em] text-[#64748B]">IIB PAN verification</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold tracking-[.04em] text-[#0F172A]">{maskPan(pan)}</p>
            <span className={`rounded-full px-2.5 py-1 text-[8.5px] font-semibold ${presentation.badge}`}>{presentation.label}</span>
          </div>
        </div>
        <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${presentation.dot}`} aria-hidden="true" />
      </div>

      <p className="mt-2 text-[9.5px] leading-4 text-[#475569]">{job?.result_message ?? job?.last_error ?? presentation.message}</p>

      {(job?.checked_by_device || meta) ? (
        <p className="mt-1.5 text-[8.5px] text-[#94A3B8]">
          {job?.checked_by_device ? `Checker: ${job.checked_by_device}` : ""}
          {job?.checked_by_device && meta ? " · " : ""}
          {meta ? formatDateTime(meta) : ""}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canQueue ? (
          <form action={queuePospMispPanVerification}>
            <input type="hidden" name="application_id" value={applicationId} />
            <FormSubmitButton label="Check PAN" pendingLabel="Queuing…" className="inline-flex h-8 items-center rounded-lg bg-[#071D49] px-3 text-[9px] font-semibold text-white hover:bg-[#0B2A63]" />
          </form>
        ) : null}
        {canRetry ? (
          <form action={retryPospMispPanVerification}>
            <input type="hidden" name="application_id" value={applicationId} />
            <FormSubmitButton label="Retry check" pendingLabel="Re-queuing…" className="inline-flex h-8 items-center rounded-lg bg-[#071D49] px-3 text-[9px] font-semibold text-white hover:bg-[#0B2A63]" />
          </form>
        ) : null}
        <Link href={`/intermediaries/applications/${applicationId}/workflow?stage=primary`} className="inline-flex h-8 items-center rounded-lg border border-[#D8E2F0] bg-white px-3 text-[9px] font-semibold text-[#334155] hover:bg-[#F8FAFC]">
          Review PAN
        </Link>
      </div>
    </aside>
  );
}

function statusPresentation(status: PanJobStatus, hasJob: boolean) {
  if (!hasJob) return { label: "Not queued", badge: "bg-slate-100 text-slate-700", dot: "bg-slate-400", message: "Queue this PAN for the authorised IIB checker extension." };
  const map: Record<PanJobStatus, { label: string; badge: string; dot: string; message: string }> = {
    pending: { label: "Waiting", badge: "bg-slate-100 text-slate-700", dot: "bg-slate-400", message: "Waiting for the authorised extension to collect this PAN." },
    queued: { label: "Queued", badge: "bg-blue-50 text-blue-700", dot: "bg-blue-500", message: "Queued for checking in the IIB POS portal." },
    checking: { label: "Checking", badge: "bg-blue-50 text-blue-700", dot: "animate-pulse bg-blue-500", message: "The extension is currently checking this PAN." },
    matched: { label: "Existing record", badge: "bg-amber-50 text-amber-700", dot: "bg-amber-500", message: "A matching IIB record was found. Review the account route before proceeding." },
    not_found: { label: "IIB cleared", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", message: "No existing IIB POS record was found for this PAN." },
    invalid: { label: "Invalid PAN", badge: "bg-red-50 text-red-700", dot: "bg-red-500", message: "Correct the PAN and retry the verification." },
    failed: { label: "Check failed", badge: "bg-red-50 text-red-700", dot: "bg-red-500", message: "The last extension check failed and can be retried." },
    manual_review: { label: "Manual review", badge: "bg-violet-50 text-violet-700", dot: "bg-violet-500", message: "This PAN requires manual review." },
  };
  return map[status];
}

function maskPan(value: string | null) {
  const normalized = value?.replace(/\s/g, "").toUpperCase() ?? "";
  return normalized.length === 10 ? `${normalized.slice(0, 2)}****${normalized.slice(-3)}` : "PAN unavailable";
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(parsed);
}
