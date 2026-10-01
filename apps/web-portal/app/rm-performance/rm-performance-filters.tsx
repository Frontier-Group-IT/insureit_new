"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type RmPerformancePeriodKey = "mtd" | "this_month" | "custom";
type RmOption = { id: string; name: string };

type Props = {
  rms: RmOption[];
  selectedRmId: string | null;
  period: {
    key: RmPerformancePeriodKey;
    from: string;
    to: string;
  };
  hideRm?: boolean;
};

export function RmPerformanceFilters({ rms, selectedRmId, period, hideRm = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);

  const currentParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  function navigate(mutator: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(currentParams.toString());
    mutator(next);
    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function onRmChange(value: string) {
    navigate((params) => {
      if (value) params.set("rm", value);
      else params.delete("rm");
    });
  }

  function onPeriodChange(value: RmPerformancePeriodKey) {
    navigate((params) => {
      params.set("period", value);
      if (value !== "custom") {
        params.delete("from");
        params.delete("to");
      } else {
        params.set("from", from);
        params.set("to", to);
      }
    });
  }

  function updateCustomRange(nextFrom: string, nextTo: string) {
    setFrom(nextFrom);
    setTo(nextTo);
    if (!nextFrom || !nextTo || nextFrom > nextTo) return;
    navigate((params) => {
      params.set("period", "custom");
      params.set("from", nextFrom);
      params.set("to", nextTo);
    });
  }

  const controlClass = "h-9 min-w-[220px] rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold text-[#22314A] outline-none transition focus:border-[#8FA4BD] disabled:opacity-60";
  const dateClass = "h-9 min-w-[148px] rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold text-[#22314A] outline-none transition focus:border-[#8FA4BD] disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={isPending}>
      {!hideRm ? (
        <select
          aria-label="Filter by RM"
          value={selectedRmId ?? ""}
          onChange={(event) => onRmChange(event.target.value)}
          className={controlClass}
          disabled={isPending}
        >
          <option value="">All RMs</option>
          {rms.map((rm) => <option key={rm.id} value={rm.id}>{rm.name}</option>)}
        </select>
      ) : null}

      <select
        aria-label="Filter by time period"
        value={period.key}
        onChange={(event) => onPeriodChange(event.target.value as RmPerformancePeriodKey)}
        className={controlClass}
        disabled={isPending}
      >
        <option value="mtd">MTD</option>
        <option value="this_month">This Month</option>
        <option value="custom">Custom</option>
      </select>

      {period.key === "custom" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#DCE4EE] bg-[#F8FAFC] p-1.5">
          <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.08em] text-[#5E6B7D]">
            From
            <input
              type="date"
              aria-label="Custom period from date"
              value={from}
              max={to || undefined}
              onChange={(event) => updateCustomRange(event.target.value, to)}
              className={dateClass}
              disabled={isPending}
            />
          </label>
          <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.08em] text-[#5E6B7D]">
            To
            <input
              type="date"
              aria-label="Custom period to date"
              value={to}
              min={from || undefined}
              onChange={(event) => updateCustomRange(from, event.target.value)}
              className={dateClass}
              disabled={isPending}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
