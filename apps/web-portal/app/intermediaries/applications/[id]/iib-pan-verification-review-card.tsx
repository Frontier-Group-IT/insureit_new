import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { PanVerificationAutoRefresh } from "@/app/customers/applications/pan-verification-auto-refresh";
import { manuallyRecheckIibPan } from "./manual-pan-recheck-action";

type PanJobStatus = "pending" | "queued" | "checking" | "matched" | "not_found" | "invalid" | "failed" | "manual_review";
type PanJob = {
  application_id: string;
  pan_number: string;
  updated_at: string | null;
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
};

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const JOB_COLUMNS = "application_id,pan_number,updated_at,status,result_message,last_error,checked_by_device,requested_at,started_at,completed_at";
const TERMINAL_STATUSES = new Set<PanJobStatus>(["matched", "not_found", "invalid", "failed", "manual_review"]);

export async function IibPanVerificationReviewCard({ applicationId }: { applicationId: string }) {
  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: directJob }] = await Promise.all([
    admin
      .from("posp_misp_onboarding_profiles")
      .select("partner_type,pan_number,dp_pan_number")
      .eq("application_id", applicationId)
      .maybeSingle<Profile>(),
    admin
      .from("pan_verification_jobs")
      .select(JOB_COLUMNS)
      .eq("application_id", applicationId)
      .maybeSingle<PanJob>(),
  ]);

  if (!profile) return null;

  const pan = normalizePan(profile.partner_type === "misp" ? profile.dp_pan_number : profile.pan_number);
  const validPan = PAN_PATTERN.test(pan);
  let job = directJob;

  // Partner and linked POSP/MISP records can have different application IDs for
  // the same unique PAN. A completed IIB outcome is authoritative for that PAN.
  // This prevents a duplicate or stale child job from masking an already
  // returned result with an endless pending/checking state.
  if (validPan) {
    const { data: matchingJobs } = await admin
      .from("pan_verification_jobs")
      .select(JOB_COLUMNS)
      .eq("pan_number", pan)
      .order("updated_at", { ascending: false })
      .limit(20)
      .returns<PanJob[]>();
    job = resolveAuthoritativeJob(directJob, matchingJobs ?? []);
  }

  const status = job?.status ?? "pending";
  const activelyRefreshing = status === "pending" || status === "queued" || status === "checking";
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

      <form action={manuallyRecheckIibPan} className="flex h-full shrink-0 items-center border-l border-white/20 px-1.5">
        <input type="hidden" name="application_id" value={applicationId} />
        <button
          type="submit"
          disabled={!validPan || activelyRefreshing}
          title={!validPan ? "Enter a valid PAN before checking" : activelyRefreshing ? "IIB PAN check is already running" : job ? "Run IIB PAN check again" : "Run IIB PAN check"}
          aria-label={!validPan ? "Valid PAN required" : activelyRefreshing ? "IIB PAN check is running" : job ? "Run IIB PAN check again" : "Run IIB PAN check"}
          className="grid h-6 w-6 place-items-center rounded-lg text-white/75 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 ${activelyRefreshing ? "animate-spin" : ""}`} aria-hidden="true">
            <path d="M16.5 6.5V3.8l-1.9 1.9A6.5 6.5 0 1 0 16 12" />
            <path d="M12.8 3.8h3.7v3.7" />
          </svg>
        </button>
      </form>
    </div>
  );
}

function resolveAuthoritativeJob(directJob: PanJob | null, matchingJobs: PanJob[]) {
  const candidates = directJob
    ? [directJob, ...matchingJobs.filter((item) => item.application_id !== directJob.application_id)]
    : matchingJobs;
  return candidates.find((item) => TERMINAL_STATUSES.has(item.status)) ?? candidates[0] ?? null;
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

function normalizePan(value: string | null) {
  return value?.replace(/\s/g, "").toUpperCase() ?? "";
}

function maskPan(value: string) {
  return value.length === 10 ? `${value.slice(0, 2)}****${value.slice(-3)}` : "PAN unavailable";
}
