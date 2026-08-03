import Link from "next/link";
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
  const canCheck = profile.workflow_stage === "pre_iib";
  const shouldRetry = status === "failed" || status === "invalid";
  const presentation = statusPresentation(status, Boolean(job));
  const message = job?.result_message ?? job?.last_error ?? presentation.message;

  return (
    <div className="group mr-1 flex h-9 min-w-[178px] max-w-[238px] items-center rounded-xl border border-white/30 bg-white/10 text-white shadow-sm transition hover:border-white/45 hover:bg-white/15">
      <PanVerificationAutoRefresh enabled={activelyRefreshing && Boolean(job)} />

      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <span className={`h-2 w-2 shrink-0 rounded-full ${presentation.dot}`} aria-hidden="true" />
        <div className="min-w-0 leading-none">
          <div className="flex items-center gap-1.5">
            <p className="text-[7px] font-semibold uppercase tracking-[.08em] text-white/55">IIB PAN</p>
            <p className="text-[8.5px] font-semibold tracking-[.04em] text-white">{maskPan(pan)}</p>
          </div>
          <p className={`mt-1 truncate text-[8px] font-semibold ${presentation.text}`} title={message}>{presentation.label}</p>
        </div>
      </div>

      {canCheck ? (
        <form action={shouldRetry ? retryPospMispPanVerification : queuePospMispPanVerification} className="flex h-full shrink-0 items-center border-l border-white/20 px-1.5">
          <input type="hidden" name="application_id" value={applicationId} />
          <button
            type="submit"
            title={job ? "Run IIB PAN check again" : "Run IIB PAN check"}
            aria-label={job ? "Run IIB PAN check again" : "Run IIB PAN check"}
            className="grid h-6 w-6 place-items-center rounded-lg text-white/75 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 ${status === "checking" ? "animate-spin" : ""}`} aria-hidden="true">
              <path d="M16.5 6.5V3.8l-1.9 1.9A6.5 6.5 0 1 0 16 12" />
              <path d="M12.8 3.8h3.7v3.7" />
            </svg>
          </button>
        </form>
      ) : status === "invalid" || status === "failed" ? (
        <Link
          href={`/intermediaries/applications/${applicationId}/workflow?stage=primary`}
          title="Review PAN details"
          aria-label="Review PAN details"
          className="grid h-full w-9 shrink-0 place-items-center border-l border-white/20 text-white/75 transition hover:bg-white/15 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
            <circle cx="9" cy="9" r="5.5" />
            <path d="m13 13 3.2 3.2" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}

function statusPresentation(status: PanJobStatus, hasJob: boolean) {
  if (!hasJob) return { label: "Not checked", text: "text-white/70", dot: "bg-white/45", message: "Waiting to be checked" };
  const map: Record<PanJobStatus, { label: string; text: string; dot: string; message: string }> = {
    pending: { label: "Waiting for checker", text: "text-white/75", dot: "bg-white/55", message: "Waiting for the checker extension" },
    queued: { label: "Queued", text: "text-blue-200", dot: "bg-blue-300", message: "Queued for IIB POS checking" },
    checking: { label: "Checking…", text: "text-blue-200", dot: "animate-pulse bg-blue-300", message: "Checking in the IIB POS portal" },
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
