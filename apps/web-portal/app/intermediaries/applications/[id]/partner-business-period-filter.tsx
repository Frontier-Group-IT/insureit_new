"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

type Period = "mtd" | "90d" | "ytd" | "all" | "custom";
type Props = { basePath: string; period: string; fromDate: string | null; toDate: string | null; mix: string };

const periods: Array<{ value: Period; label: string }> = [
  { value: "mtd", label: "MTD" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];
const weekdays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function parseIso(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T12:00:00");
  return Number.isNaN(date.getTime()) || date.getFullYear() !== Number(value.slice(0, 4))
    || date.getMonth() + 1 !== Number(value.slice(5, 7)) || date.getDate() !== Number(value.slice(8, 10)) ? null : date;
}
function iso(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function shortDate(value: string | null) {
  const date = parseIso(value);
  return date ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Select";
}

export function PartnerBusinessPeriodFilter({ basePath, period, fromDate, toDate, mix }: Props) {
  const router = useRouter();
  const initialMonth = parseIso(fromDate) ?? new Date();
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(() => new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1));
  const [start, setStart] = useState<string | null>(fromDate);
  const [end, setEnd] = useState<string | null>(toDate);
  const [selection, setSelection] = useState<Period>(periods.some((item) => item.value === period) ? period as Period : "mtd");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelection(periods.some((item) => item.value === period) ? period as Period : "mtd");
    setStart(fromDate);
    setEnd(toDate);
  }, [period, fromDate, toDate]);

  useEffect(() => {
    if (!visible) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setVisible(false); };
    const closeOnOutside = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setVisible(false); };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutside);
    };
  }, [visible]);

  const navigate = (next: Period, from?: string, to?: string) => {
    const params = new URLSearchParams({ tab: "business", period: next, mix });
    if (next === "custom" && from && to) {
      params.set("from", from);
      params.set("to", to);
    }
    setVisible(false);
    router.push(`${basePath}?${params.toString()}`);
  };
  function changePeriod(value: string) {
    const next = periods.some(item => item.value === value) ? value as Period : "mtd";
    setSelection(next);
    if (next === "custom") {
      setStart(fromDate);
      setEnd(toDate);
      setVisible(true);
      return;
    }
    navigate(next);
  }
  function pickDate(value: string) {
    if (!start || end || value < start) {
      setStart(value);
      setEnd(null);
      return;
    }
    setEnd(value);
    navigate("custom", start, value);
  }
  const year = month.getFullYear();
  const currentMonth = month.getMonth();
  const firstWeekday = new Date(year, currentMonth, 1).getDay();
  const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
  const today = iso(new Date());
  const label = month.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const dateCells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <select aria-label="Report period" value={selection} onChange={event => changePeriod(event.target.value)}
        className="h-9 min-w-[110px] rounded-lg border border-[#d7dfeb] bg-white px-2 text-[11px] font-semibold text-[#17365d]">
        {periods.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      {selection === "custom" ? (
        <button type="button" onClick={() => setVisible(value => !value)} aria-expanded={visible}
          aria-label="Select custom report date range"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d7dfeb] bg-white px-3 text-[10px] font-semibold text-[#344966]">
          <CalendarDays className="h-3.5 w-3.5" />
          {fromDate && toDate ? `${shortDate(fromDate)} – ${shortDate(toDate)}` : "Select date range"}
        </button>
      ) : null}
      {visible && selection === "custom" ? (
        <div role="dialog" aria-label="Custom report date range" className="absolute right-0 top-full z-[70] mt-2 w-[min(350px,calc(100vw-24px))] rounded-2xl border border-[#dde6f0] bg-white p-3.5 shadow-[0_18px_45px_rgba(15,23,42,.18)]">
          <div className="flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(year, currentMonth - 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#e2e8f2] text-[#294a76] hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
            <div className="text-center"><p className="text-[13px] font-bold text-[#263a59]">{label}</p><p className="text-[9px] text-[#8190a6]">Select start and end date</p></div>
            <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(year, currentMonth + 1, 1))}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#e2e8f2] text-[#294a76] hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
            {weekdays.map(day => <div key={day} className="py-2 text-[9px] font-bold text-[#7f8da2]">{day}</div>)}
            {dateCells.map((day, index) => {
              if (day === null) return <span key={`empty-${index}`} />;
              const value = iso(new Date(year, currentMonth, day));
              const selected = value === start || value === end;
              const withinRange = Boolean(start && end && value > start && value < end);
              return <button key={value} type="button" onClick={() => pickDate(value)}
                aria-label={new Date(year, currentMonth, day).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                aria-pressed={selected} className={`mx-auto grid h-9 w-9 place-items-center rounded-lg text-[11px] font-semibold transition-colors ${selected ? "bg-[#174a90] text-white" : withinRange ? "bg-blue-50 text-[#174a90]" : value === today ? "border border-[#89ace0] text-[#174a90]" : "text-[#536782] hover:bg-slate-100"}`}>
                {day}
              </button>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f5f7fb] px-3 py-3 text-[10px] text-[#78889c]">
            <span>From <strong className="text-[#263a59]">{shortDate(start)}</strong></span>
            <span>To <strong className="text-[#263a59]">{shortDate(end)}</strong></span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
