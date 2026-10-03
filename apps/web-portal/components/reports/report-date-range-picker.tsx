"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type RangePickerProps = {
  from: string;
  to: string;
  onRangeComplete: (from: string, to: string) => void;
  onRangeDraft?: (from: string, to: string) => void;
  maxDate?: string;
  minDate?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  popoverClassName?: string;
};

export function ReportDateRangePicker({
  from,
  to,
  onRangeComplete,
  onRangeDraft,
  maxDate,
  minDate,
  buttonClassName,
  align = "right",
  disabled = false,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  popoverClassName = "",
}: RangePickerProps) {
  const today = todayUtc();
  const effectiveMaxDate = maxDate && maxDate < today ? maxDate : today;
  const initialCalendarDate = clampToMaxDate(to || from || effectiveMaxDate, effectiveMaxDate);
  const [internalOpen, setInternalOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState(from);
  const [rangeEnd, setRangeEnd] = useState(to);
  const [calendarMonth, setCalendarMonth] = useState(initialCalendarDate.slice(0, 7));
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const open = controlledOpen ?? internalOpen;
  const days = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const nextMonthDisabled = shiftMonth(calendarMonth, 1) > effectiveMaxDate.slice(0, 7);

  useEffect(() => {
    if (open) return;
    setRangeStart(from);
    setRangeEnd(to);
    setCalendarMonth(clampToMaxDate(to || from || effectiveMaxDate, effectiveMaxDate).slice(0, 7));
  }, [from, to, effectiveMaxDate, open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function setOpen(next: boolean) {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  function selectDate(date: string) {
    if (isDisabledDate(date, minDate, effectiveMaxDate)) return;

    if (rangeStart && !rangeEnd) {
      const nextStart = date < rangeStart ? date : rangeStart;
      const nextEnd = date < rangeStart ? rangeStart : date;
      setRangeStart(nextStart);
      setRangeEnd(nextEnd);
      onRangeDraft?.(nextStart, nextEnd);
      onRangeComplete(nextStart, nextEnd);
      setOpen(false);
      return;
    }

    setRangeStart(date);
    setRangeEnd("");
    onRangeDraft?.(date, "");
  }

  const popover = open ? (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Select custom date range"
      className={`absolute ${align === "right" ? "right-0" : "left-0"} top-[calc(100%+6px)] z-50 w-[308px] rounded-2xl border border-[#D7E0EA] bg-white p-3 shadow-[0_18px_45px_rgba(25,46,75,.18)] ${popoverClassName}`}
    >
      <div className="flex items-center justify-between px-1">
        <button type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))} className="grid h-8 w-8 place-items-center rounded-lg border border-[#E2E8F0] text-[#4B5F78] hover:bg-[#F7F9FC]" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
        <div className="text-center"><p className="text-[12px] font-black text-[#21344F]">{monthTitle(calendarMonth)}</p><p className="mt-0.5 text-[8.5px] font-semibold text-[#778396]">Select start and end date</p></div>
        <button type="button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))} disabled={nextMonthDisabled} className="grid h-8 w-8 place-items-center rounded-lg border border-[#E2E8F0] text-[#4B5F78] hover:bg-[#F7F9FC] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-[8.5px] font-black uppercase tracking-[.05em] text-[#7A8799]">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day} className="py-1">{day}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {days.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} className="h-9" />;
          const selectedEdge = date === rangeStart || date === rangeEnd;
          const inRange = Boolean(rangeEnd && date > rangeStart && date < rangeEnd);
          const dateDisabled = isDisabledDate(date, minDate, effectiveMaxDate);
          return (
            <button
              key={date}
              type="button"
              onClick={() => selectDate(date)}
              disabled={dateDisabled}
              className={`mx-auto grid h-9 w-9 place-items-center rounded-lg text-[10.5px] font-bold transition ${dateDisabled ? "cursor-not-allowed text-[#C2CAD5]" : selectedEdge ? "bg-[#17365D] text-white" : inRange ? "bg-[#EAF1FA] text-[#17365D]" : "text-[#334861] hover:bg-[#F0F4F8]"}`}
              aria-label={formatLongDate(date)}
            >
              {Number(date.slice(-2))}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-[#F7F9FC] px-3 py-2 text-[9px]">
        <span className="font-semibold text-[#718095]">From <strong className="text-[#2D405A]">{rangeStart ? formatShortDate(rangeStart) : "Select"}</strong></span>
        <span className="font-semibold text-[#718095]">To <strong className="text-[#2D405A]">{rangeEnd ? formatShortDate(rangeEnd) : "Select"}</strong></span>
      </div>
    </div>
  ) : null;

  if (hideTrigger) return popover;

  return (
    <div ref={triggerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={buttonClassName ?? "inline-flex h-9 min-w-[190px] items-center justify-between gap-3 rounded-xl border border-[#CBD5E1] bg-white px-3 text-left text-[11px] font-semibold text-[#22314A] outline-none transition hover:border-[#AAB8C8] disabled:opacity-60"}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className="truncate">{rangeEnd ? formatRange(rangeStart, rangeEnd) : rangeStart ? `${formatShortDate(rangeStart)} – Select end` : "Select date range"}</span>
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#60738B]" />
      </button>
      {popover}
    </div>
  );
}

type NavigatorProps = {
  path: string;
  from: string;
  to: string;
  preserveParams?: Record<string, string | null | undefined>;
  maxDate?: string;
  minDate?: string;
  buttonClassName?: string;
  align?: "left" | "right";
};

export function ReportDateRangeNavigator({ path, from, to, preserveParams = {}, maxDate, minDate, buttonClassName, align = "right" }: NavigatorProps) {
  const router = useRouter();
  return (
    <ReportDateRangePicker
      from={from}
      to={to}
      maxDate={maxDate}
      minDate={minDate}
      buttonClassName={buttonClassName}
      align={align}
      onRangeComplete={(nextFrom, nextTo) => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(preserveParams)) if (value) params.set(key, value);
        params.set("period", "custom");
        params.set("from", nextFrom);
        params.set("to", nextTo);
        router.push(`${path}?${params.toString()}`);
      }}
    />
  );
}

function isDisabledDate(date: string, minDate?: string, maxDate?: string) {
  return Boolean((minDate && date < minDate) || (maxDate && date > maxDate));
}

function clampToMaxDate(date: string, maxDate: string) {
  return date > maxDate ? maxDate : date;
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
function todayUtc() { return new Date().toISOString().slice(0, 10); }
