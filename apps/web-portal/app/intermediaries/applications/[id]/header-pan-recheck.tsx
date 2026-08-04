import { FormSubmitButton } from "@/components/form-submit-button";
import { resolveIibPanVerificationStatus, type IibPanVerificationJob } from "@/lib/iib-pan-verification-status";
import { manuallyRecheckIibPan } from "./manual-pan-recheck-action";

export function HeaderPanRecheck({ applicationId, pan, job }: { applicationId: string; pan: string | null; job: IibPanVerificationJob | null }) {
  const validPan = Boolean(pan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan));
  const active = job?.status === "pending" || job?.status === "queued" || job?.status === "checking";
  const status = validPan ? resolveIibPanVerificationStatus(job) : null;

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-[180px] rounded-xl border border-white/40 bg-white/10 px-3 py-2 text-white shadow-sm backdrop-blur-sm" title={status?.detail ?? status?.label ?? "PAN not available"}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${status ? dotClass(status.code) : "bg-slate-400"}`} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[8px] font-semibold uppercase tracking-[.06em] text-white/60">IIB PAN status</p>
            <p className="truncate text-[10px] font-semibold">{maskPan(pan)}</p>
            <p className="mt-0.5 truncate text-[8.5px] font-medium text-white/70">{status?.label ?? "PAN not available"}</p>
          </div>
        </div>
      </div>

      <form action={manuallyRecheckIibPan}>
        <input type="hidden" name="application_id" value={applicationId} />
        <FormSubmitButton
          label=""
          pendingLabel=""
          disabled={!validPan || active}
          icon={<RefreshIcon active={active} />}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/35 bg-white/10 p-0 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="sr-only">{active ? "PAN recheck is already queued" : "Recheck IIB PAN"}</span>
      </form>
    </div>
  );
}

function dotClass(code: ReturnType<typeof resolveIibPanVerificationStatus>["code"]) {
  if (code === "cleared") return "bg-emerald-300";
  if (code === "matched" || code === "failed") return "bg-rose-300";
  if (code === "queued") return "bg-amber-300";
  if (code === "checking") return "bg-sky-300 animate-pulse";
  if (code === "invalid") return "bg-orange-300";
  return "bg-slate-300";
}

function RefreshIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 ${active ? "animate-spin" : ""}`} aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2.35 5.65" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

function maskPan(value: string | null) {
  return value && value.length === 10 ? `${value.slice(0, 2)}****${value.slice(-3)}` : "Not available";
}
