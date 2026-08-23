"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { processNextProductionOcrBenchmarkBatch } from "./actions";

const BATCH_SIZE = 2;

export function BenchmarkRunner({ runId, pending }: { runId: string; pending: number }) {
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
        await processNextProductionOcrBenchmarkBatch(formData);
        setCompleted(Math.min(offset + BATCH_SIZE, pending));
        router.refresh();
      }
    } catch {
      setError("Baseline processing stopped. Refresh the page and resume the remaining policies.");
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
        className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {running ? `Processing baseline ${completed}/${pending}` : `Run all ${pending} pending baselines`}
      </button>
      <p className="max-w-sm text-right text-xs text-slate-500">
        Runs sequentially in safe two-policy server batches. You can leave this page open and watch progress refresh automatically.
      </p>
      {error ? <p className="max-w-sm text-right text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}
