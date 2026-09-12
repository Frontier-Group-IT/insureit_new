"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { retryPolicyIntakeOcr } from "@/app/policy-intakes/retry-actions";

export function PolicyIntakeOcrRetryButton({
  id,
  compact = false,
  className = "",
}: {
  id: string;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!watching) return;
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= 15) {
        window.clearInterval(timer);
        setWatching(false);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [router, watching]);

  function retry(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setError("");
    startTransition(async () => {
      const result = await retryPolicyIntakeOcr(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setWatching(true);
      router.refresh();
    });
  }

  const busy = pending || watching;
  return <div className={className} onClick={(event) => event.stopPropagation()}>
    <button
      type="button"
      onClick={retry}
      disabled={busy}
      title="Retry detail fetch from the saved policy copy"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white font-bold text-amber-800 transition hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60 ${compact ? "h-7 px-2 text-[8.5px]" : "h-9 px-3 text-[9.5px]"}`}
    >
      <RotateCcw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Retrying…" : "Retry Fetch"}
    </button>
    {error ? <p className="mt-1 max-w-[220px] text-[8px] leading-3 text-rose-700">{error}</p> : null}
  </div>;
}
