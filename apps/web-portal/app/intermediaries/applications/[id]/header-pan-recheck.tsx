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

  return (
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
  );
}

function RefreshIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 ${active ? "animate-spin" : ""}`} aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2.35 5.65" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}
