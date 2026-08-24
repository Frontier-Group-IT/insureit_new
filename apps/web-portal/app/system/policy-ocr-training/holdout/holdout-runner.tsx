"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { processNextBlindHoldoutCaptureBatch } from "./actions";

const BATCH_SIZE = 2;

export function HoldoutRunner({ runId, pending }: { runId: string; pending: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function runAllPending() {
    if (running || pending <= 0) return;
    setRunning(true);
    setCompleted(0);
    setError(null);
    try {
      for (let offset = 0; offset < pending; offset += BATCH_SIZE) {
        const formData = new FormData();
        formData.set("runId", runId);
        await processNextBlindHoldoutCaptureBatch(formData);
        setCompleted(Math.min(offset + BATCH_SIZE, pending));
        router.refresh();
      }
    } catch {
      setError("Blind capture stopped. Refresh the page and resume only the remaining holdouts.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={runAllPending}
        disabled={running || pending <= 0}
        className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {running ? `Capturing ${completed}/${pending}` : `Capture ${pending} sealed holdout predictions`}
      </button>
      <p className="max-w-md text-right text-xs text-slate-500">
        Captures final parser predictions only. PDF truth and reference candidates remain unread until every prediction is frozen.
      </p>
      {error ? <p className="max-w-md text-right text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
