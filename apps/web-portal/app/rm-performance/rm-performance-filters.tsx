"use client";

import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";
import { CalendarDays, ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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
  const [calendarOpen, setCalendarOpen] = useState(false);
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
    setCalendarOpen(value === "custom");
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

      {/* Keep the period control in its original slot. The calendar is an absolute
          popover, so choosing Custom does not shift RM, PDF or email controls. */}
      <div className="relative shrink-0">
        <select
          aria-label="Filter by time period"
          value={period.key}
          onChange={(event) => onPeriodChange(event.target.value as RmPerformancePeriodKey)}
          className={`${controlClass} w-[220px] appearance-none ${period.key === "custom" ? "pr-[68px]" : "pr-9"}`}
          disabled={isPending}
        >
          <option value="mtd">MTD</option>
          <option value="last_month">Last Month</option>
          <option value="custom">Custom</option>
        </select>
        {period.key === "custom" ? (
          <button
            type="button"
            aria-label="Open custom date range calendar"
            aria-haspopup="dialog"
            aria-expanded={calendarOpen}
            title="Select custom dates"
            disabled={isPending}
            onClick={() => setCalendarOpen(true)}
            className="absolute right-8 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[#60738B] hover:bg-[#EEF3FA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#315B9A] disabled:opacity-50"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#60738B]" aria-hidden="true" />
        {period.key === "custom" ? (
          <ReportDateRangePicker
            from={period.from}
            to={period.to}
            open={calendarOpen}
            onOpenChange={setCalendarOpen}
            disabled={isPending}
            hideTrigger
            align="left"
            onRangeComplete={(from, to) => {
              setCalendarOpen(false);
              navigate((params) => {
                params.set("period", "custom");
                params.set("from", from);
                params.set("to", to);
              });
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
