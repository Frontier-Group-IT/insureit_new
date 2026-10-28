"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { beginExternalOperationsWorkflow } from "@/app/claims/external-operations-actions";

type Props = {
  claimId: string;
  auto?: boolean;
  activeClaimId?: string | null;
  onClaimStart?: (claimId: string) => boolean;
  onClaimFailure?: (claimId: string) => void;
};

export function ExternalClaimOperationsEntry({ claimId, auto = false, activeClaimId, onClaimStart, onClaimFailure }: Props) {
  const router = useRouter();
  const started = useRef(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function enterWorkflow() {
    if (pending || (activeClaimId && activeClaimId !== claimId)) return;
    // The parent lock is set synchronously before the transition starts, so
    // simultaneous clicks on different rows cannot start multiple takeovers.
    if (onClaimStart && !onClaimStart(claimId)) return;
    setMessage("");
    startTransition(async () => {
      try {
        const result = await beginExternalOperationsWorkflow(claimId);
        if (!result.ok) {
          setMessage(result.message ?? "Unable to open this External Claim.");
          onClaimFailure?.(claimId);
          return;
        }
        router.replace(`/claims/${claimId}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to open this External Claim.");
        onClaimFailure?.(claimId);
      }
    });
  }

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    enterWorkflow();
    // This is intentionally a one-shot ownership handoff for direct External Claim links.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, claimId]);

  if (!auto) {
    return (
      <div className="inline-flex flex-col items-center gap-1">
        <button
          type="button"
          disabled={pending || Boolean(activeClaimId && activeClaimId !== claimId)}
          onClick={enterWorkflow}
          className="inline-flex h-7 items-center justify-center rounded-md bg-[#003A83] px-3 text-[10.5px] font-medium text-white disabled:cursor-wait disabled:opacity-60"
        >
          {pending || activeClaimId === claimId ? "Opening..." : "Proceed"}
        </button>
        {message ? <span className="max-w-[180px] text-[9px] font-medium text-red-600">{message}</span> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#D8E3F2] bg-white p-5 text-center shadow-sm">
      <p className="text-[13px] font-semibold text-[#071D49]">Opening External Claim workflow...</p>
      <p className="mt-1 text-[11px] text-[#5C6878]">Preparing the canonical 9-stage Operations journey.</p>
      {message ? (
        <div className="mt-3">
          <p role="alert" className="text-[11px] font-semibold text-red-700">{message}</p>
          <button type="button" onClick={enterWorkflow} disabled={pending} className="mt-2 rounded-lg bg-[#071D49] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-60">Retry</button>
        </div>
      ) : null}
    </div>
  );
}
