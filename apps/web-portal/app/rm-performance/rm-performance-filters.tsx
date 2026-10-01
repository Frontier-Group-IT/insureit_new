"use client";

import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";

type RmPerformancePeriodKey = "mtd" | "last_month" | "custom";
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
        params.set("from", period.from);
        params.set("to", period.to);
      }
    });
  }

  const controlClass = "h-9 min-w-[220px] rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold text-[#22314A] outline-none transition focus:border-[#8FA4BD] disabled:opacity-60";

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
        <option value="last_month">Last Month</option>
        <option value="custom">Custom</option>
      </select>

      {period.key === "custom" ? (
        <ReportDateRangePicker
          from={period.from}
          to={period.to}
          disabled={isPending}
          buttonClassName={`${controlClass} inline-flex items-center justify-between gap-3 text-left`}
          onRangeComplete={(from, to) => {
            navigate((params) => {
              params.set("period", "custom");
              params.set("from", from);
              params.set("to", to);
            });
          }}
        />
      ) : null}
    </div>
  );
}
