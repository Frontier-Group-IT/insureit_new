"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const ReportPendingContext = createContext<(pending: boolean) => void>(() => {});

export function PartnerReportsLoadingProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);
  return (
    <ReportPendingContext.Provider value={setPending}>
      {children}
      {pending ? <ReportSkeleton ariaLabel="Updating report records" /> : null}
    </ReportPendingContext.Provider>
  );
}

export function usePartnerReportsPending() {
  return useContext(ReportPendingContext);
}

export function ReportSkeleton({ ariaLabel = "Loading report" }: { ariaLabel?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={ariaLabel}
      className="absolute inset-x-0 top-[62px] bottom-0 z-40 min-h-[560px] rounded-xl bg-[#F6F8FC]/95 p-3 backdrop-blur-[2px]">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) =>
          <div key={index} className="h-[110px] animate-pulse rounded-xl border border-[#E0E8F2] bg-white p-4">
            <div className="h-3 w-24 rounded bg-[#E2E8F0]" />
            <div className="mt-4 h-7 w-20 rounded bg-[#CBD5E1]" />
            <div className="mt-3 h-2 w-28 max-w-full rounded bg-[#E2E8F0]" />
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) =>
          <div key={index} className="h-[300px] animate-pulse rounded-xl border border-[#E0E8F2] bg-white p-5">
            <div className="h-4 w-36 rounded bg-[#CBD5E1]" />
            <div className="mt-7 h-[205px] rounded-lg bg-[#F0F4F9]" />
          </div>
        )}
      </div>
      <div className="mt-4 h-36 animate-pulse rounded-xl border border-[#E0E8F2] bg-white p-5">
        <div className="h-4 w-40 rounded bg-[#CBD5E1]" />
        <div className="mt-4 h-3 w-full rounded bg-[#E2E8F0]" />
        <div className="mt-3 h-3 w-4/5 rounded bg-[#E2E8F0]" />
      </div>
      <span className="sr-only">{ariaLabel}</span>
    </div>
  );
}
