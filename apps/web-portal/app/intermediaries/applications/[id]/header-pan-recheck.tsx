import { FormSubmitButton } from "@/components/form-submit-button";
import { manuallyRecheckIibPan } from "./manual-pan-recheck-action";

type Job = {
  status: string;
  result_code: string | null;
  result_message: string | null;
  last_error: string | null;
};

export function HeaderPanRecheck({ applicationId, pan, job }: { applicationId: string; pan: string | null; job: Job | null }) {
  const validPan = Boolean(pan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan));
  const active = job?.status === "pending" || job?.status === "queued" || job?.status === "checking";
  const status = statusText(job);

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-[184px] rounded-xl border border-white/45 bg-white/8 px-3 py-2 text-white shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} />
          <div className="min-w-0">
            <p className="text-[8px] font-semibold uppercase tracking-[.06em] text-white/60">IIB PAN</p>
            <p className="truncate text-[10px] font-semibold">{maskPan(pan)}</p>
            <p className="mt-0.5 truncate text-[8.5px] font-medium text-white/70">{status.label}</p>
          </div>
        </div>
      </div>
      <form action={manuallyRecheckIibPan}>
        <input type="hidden" name="application_id" value={applicationId} />
        <FormSubmitButton
          label={active ? "Queued" : "Recheck"}
          pendingLabel="Queueing…"
          disabled={!validPan || active}
          className="h-10 rounded-xl border border-white/35 bg-white/10 px-3 text-[9.5px] font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </form>
    </div>
  );
}

function statusText(job: Job | null) {
  if (!job) return { label: "Not checked", dot: "bg-slate-400" };
  if (job.status === "pending" || job.status === "queued") return { label: "Waiting in queue", dot: "bg-amber-300" };
  if (job.status === "checking") return { label: "Checking now", dot: "bg-sky-300 animate-pulse" };
  if (job.status === "not_found") return { label: "No IIB record found", dot: "bg-emerald-300" };
  if (job.status === "matched") return { label: "Matching IIB record", dot: "bg-rose-300" };
  if (job.status === "invalid") return { label: "Invalid PAN", dot: "bg-orange-300" };
  if (job.status === "failed") return { label: job.last_error || "Check failed", dot: "bg-red-300" };
  return { label: job.result_message || job.result_code || job.status.replaceAll("_", " "), dot: "bg-slate-300" };
}

function maskPan(value: string | null) {
  return value && value.length === 10 ? `${value.slice(0, 2)}****${value.slice(-3)}` : "Not available";
}
