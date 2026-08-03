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
  const presentation = statusPresentation(status, Boolean(job));
  const message = job?.result_message ?? job?.last_error ?? presentation.message;

  return (
    <div className="mr-1 flex min-w-[148px] max-w-[220px] items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white shadow-sm backdrop-blur-sm">
      <PanVerificationAutoRefresh enabled={activelyRefreshing && Boolean(job)} />
      <span className={`h-2 w-2 shrink-0 rounded-full ${presentation.dot}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-[7.5px] font-semibold uppercase tracking-[.08em] text-white/60">IIB PAN verification</p>
        <p className="mt-0.5 text-[10px] font-semibold tracking-[.04em] text-white">{maskPan(pan)}</p>
        <p className={`mt-0.5 text-[8.5px] font-semibold ${presentation.text}`}>{presentation.label}</p>
        <p className="mt-0.5 truncate text-[7.5px] font-medium text-white/65" title={message}>{message}</p>
      </div>
      {canQueue ? (
        <form action={queuePospMispPanVerification} className="shrink-0">
          <input type="hidden" name="application_id" value={applicationId} />
          <FormSubmitButton label="Check" pendingLabel="…" className="inline-flex h-7 items-center rounded-lg bg-white px-2.5 text-[8px] font-semibold text-[#071D49] hover:bg-blue-50" />
        </form>
      ) : null}
      {canRetry ? (
        <form action={retryPospMispPanVerification} className="shrink-0">
          <input type="hidden" name="application_id" value={applicationId} />
          <FormSubmitButton label="Retry" pendingLabel="…" className="inline-flex h-7 items-center rounded-lg bg-white px-2.5 text-[8px] font-semibold text-[#071D49] hover:bg-blue-50" />
        </form>
      ) : status === "invalid" || status === "failed" ? (
        <Link href={`/intermediaries/applications/${applicationId}/workflow?stage=primary`} className="inline-flex h-7 shrink-0 items-center rounded-lg border border-white/25 bg-white/10 px-2.5 text-[8px] font-semibold text-white hover:bg-white/20">
          Review
        </Link>
      ) : null}
    </div>
  );
}

function statusPresentation(status: PanJobStatus, hasJob: boolean) {
  if (!hasJob) return { label: "Not queued", text: "text-slate-200", dot: "bg-slate-300", message: "Waiting to be checked" };
  const map: Record<PanJobStatus, { label: string; text: string; dot: string; message: string }> = {
    pending: { label: "Waiting", text: "text-slate-200", dot: "bg-slate-300", message: "Waiting for the checker extension" },
    queued: { label: "Queued", text: "text-blue-200", dot: "bg-blue-300", message: "Queued for IIB POS checking" },
    checking: { label: "Checking", text: "text-blue-200", dot: "animate-pulse bg-blue-300", message: "Checking in the IIB POS portal" },
    matched: { label: "Existing record", text: "text-amber-200", dot: "bg-amber-300", message: "Matching Record Found In DataBase" },
    not_found: { label: "IIB cleared", text: "text-emerald-200", dot: "bg-emerald-300", message: "No Data Found In POS System" },
    invalid: { label: "Invalid PAN", text: "text-red-200", dot: "bg-red-300", message: "Correct the PAN and retry" },
    failed: { label: "Check failed", text: "text-red-200", dot: "bg-red-300", message: "The last check failed" },
    manual_review: { label: "Manual review", text: "text-violet-200", dot: "bg-violet-300", message: "Manual review is required" },
  };
  return map[status];
}

function maskPan(value: string | null) {
  const normalized = value?.replace(/\s/g, "").toUpperCase() ?? "";
  return normalized.length === 10 ? `${normalized.slice(0, 2)}****${normalized.slice(-3)}` : "PAN unavailable";
}
