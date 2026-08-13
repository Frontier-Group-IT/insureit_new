"use client";

import { useEffect } from "react";

export default function ReportsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[reports] route error", error.message);
  }, [error]);

  return (
    <div className="mx-auto max-w-[1560px] pb-8">
      <div role="alert" className="portal-card border border-red-200 bg-red-50 px-5 py-5">
        <p className="text-[13px] font-bold text-red-800">Reporting service unavailable.</p>
        <button type="button" onClick={reset} className="mt-3 inline-flex h-9 items-center rounded-lg border border-red-200 bg-white px-3 text-[10px] font-bold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
          Retry
        </button>
      </div>
    </div>
  );
}
