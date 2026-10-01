"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

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
  const [rangeStart, setRangeStart] = useState(period.from);
  const [rangeEnd, setRangeEnd] = useState(period.to);
  const [calendarMonth, setCalendarMonth] = useState(period.to.slice(0, 7));
  const calendarRef = useRef<HTMLDivElement>(null);

  const currentParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const days = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) setCalendarOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (period.key !== "custom" || calendarOpen) return;
    setRangeStart(period.from);
    setRangeEnd(period.to);
    setCalendarMonth(period.to.slice(0, 7));
  }, [period.key, period.from, period.to, calendarOpen]);

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
    if (value === "custom") {
      setCalendarOpen(true);
      setCalendarMonth((rangeEnd || period.to).slice(0, 7));
    } else {
      setCalendarOpen(false);
    }

    navigate((params) => {
      params.set("period", value);
      if (value !== "custom") {
        params.delete("from");
        params.delete("to");
      } else {
        params.set("from", rangeStart);
        params.set("to", rangeEnd || rangeStart);
      }
    });
  }

  function selectCalendarDate(date: string) {
    if (rangeStart && !rangeEnd) {
      const nextStart = date < rangeStart ? date : rangeStart;
      const nextEnd = date < rangeStart ? rangeStart : date;
      setRangeStart(nextStart);
      setRangeEnd(nextEnd);
      setCalendarOpen(false);
      navigate((params) => {
        params.set("period", "custom");
        params.set("from", nextStart);
        params.set("to", nextEnd);
      });
      return;
    }

    setRangeStart(date);
    setRangeEnd("");
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
        <div ref={calendarRef} className="relative">
          <button
            type="button"
            onClick={() => setCalendarOpen((open) => !open)}
            className={`${controlClass} inline-flex items-center justify-between gap-3 text-left`}
            aria-haspopup="dialog"
            aria-expanded={calendarOpen}
            disabled={isPending}
          >
            <span className="truncate">{rangeEnd ? formatRange(rangeStart, rangeEnd) : `${formatShortDate(rangeStart)} – Select end`}</span>
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#60738B]" />
          </button>

          {calendarOpen ? (
            <div role="dialog" aria-label="Select custom date range" className="absolute right-0 z-50 mt-2 w-[308px] rounded-2xl border border-[#D7E0EA] bg-white p-3 shadow-[0_18px_45px_rgba(25,46,75,.18)]">
              <div className="flex items-center justify-between px-1">
                <button type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))} className="grid h-8 w-8 place-items-center rounded-lg border border-[#E2E8F0] text-[#4B5F78] hover:bg-[#F7F9FC]" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
                <div className="text-center"><p className="text-[12px] font-black text-[#21344F]">{monthTitle(calendarMonth)}</p><p className="mt-0.5 text-[8.5px] font-semibold text-[#778396]">Select start and end date</p></div>
                <button type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-[#E2E8F0] text-[#4B5F78] hover:bg-[#F7F9FC]" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
              </div>

              <div className="mt-3 grid grid-cols-7 text-center text-[8.5px] font-black uppercase tracking-[.05em] text-[#7A8799]">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day} className="py-1">{day}</span>)}
              </div>

              <div className="grid grid-cols-7 gap-y-1 text-center">
                {days.map((date, index) => {
                  if (!date) return <span key={`blank-${index}`} className="h-9" />;
                  const selectedEdge = date === rangeStart || date === rangeEnd;
                  const inRange = Boolean(rangeEnd && date > rangeStart && date < rangeEnd);
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => selectCalendarDate(date)}
                      className={`mx-auto grid h-9 w-9 place-items-center rounded-lg text-[10.5px] font-bold transition ${selectedEdge ? "bg-[#17365D] text-white" : inRange ? "bg-[#EAF1FA] text-[#17365D]" : "text-[#334861] hover:bg-[#F0F4F8]"}`}
                      aria-label={formatLongDate(date)}
                    >
                      {Number(date.slice(-2))}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-[#F7F9FC] px-3 py-2 text-[9px]">
                <span className="font-semibold text-[#718095]">From <strong className="text-[#2D405A]">{formatShortDate(rangeStart)}</strong></span>
                <span className="font-semibold text-[#718095]">To <strong className="text-[#2D405A]">{rangeEnd ? formatShortDate(rangeEnd) : "Select"}</strong></span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function buildCalendarDays(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const values: Array<string | null> = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= totalDays; day += 1) values.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  while (values.length % 7 !== 0) values.push(null);
  return values;
}

function shiftMonth(monthKey: string, offset: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(monthKey: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthKey}-01T00:00:00Z`));
}

function formatRange(from: string, to: string) { return `${formatShortDate(from)} – ${formatShortDate(to)}`; }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function formatLongDate(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
