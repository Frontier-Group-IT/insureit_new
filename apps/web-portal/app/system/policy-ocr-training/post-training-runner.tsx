"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { processNextProductionOcrPostTrainingBatch } from "./actions";

const BATCH_SIZE = 2;

export function PostTrainingRunner({ runId, pending }: { runId: string; pending: number }) {
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
        await processNextProductionOcrPostTrainingBatch(formData);
        setCompleted(Math.min(offset + BATCH_SIZE, pending));
        router.refresh();
      }
    } catch {
      setError("Post-training replay stopped. Refresh the page and resume the remaining training policies.");
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
        className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {running ? `Replaying ${completed}/${pending}` : `Replay all ${pending} verified training PDFs`}
      </button>
      <p className="max-w-md text-right text-xs text-slate-500">
        Re-runs only the verified training cohort in two-policy batches. Frozen baseline values, approved labels and blind holdouts are not modified.
      </p>
      {error ? <p className="max-w-md text-right text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
