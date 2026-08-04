"use client";

import { useEffect } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import type { IibPanVerificationJob } from "@/lib/iib-pan-verification-status";
import { manuallyRecheckIibPan } from "./manual-pan-recheck-action";

const RECHECK_SUCCESS_TEXT = "PAN recheck added to the IIB queue.";

export function HeaderPanRecheck({ applicationId, pan, job }: { applicationId: string; pan: string | null; job: IibPanVerificationJob | null }) {
  const validPan = Boolean(pan && /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan));
  const active = job?.status === "pending" || job?.status === "queued" || job?.status === "checking";

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("success") !== "pan_verification_requeued") return;

    const timer = window.setTimeout(() => {
      const notice = Array.from(document.querySelectorAll("div")).find((element) => element.textContent?.trim() === RECHECK_SUCCESS_TEXT);
      if (notice instanceof HTMLElement) {
        notice.style.transition = "opacity 200ms ease";
        notice.style.opacity = "0";
        window.setTimeout(() => notice.remove(), 200);
      }

      url.searchParams.delete("success");
      url.searchParams.delete("refresh");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, []);

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
