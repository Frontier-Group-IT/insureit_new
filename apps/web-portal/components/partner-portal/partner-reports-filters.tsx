"use client";

import { CalendarDays, ChevronDown, Download, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";

type FilterOption = { value: string; label: string };
type Props = {
  period: string;
  business: string;
  from: string;
  to: string;
  exportHref: string;
  insurerOptions?: string[];
  rmOptions?: string[];
  intermediaryOptions?: string[];
  insurer?: string;
  rm?: string;
  intermediary?: string;
  showAdvanced?: boolean;
};

const periods: FilterOption[] = [
  { value: "mtd", label: "MTD" },
  { value: "last-month", label: "Last Month" },
  { value: "last-6-months", label: "Last 6 Months" },
  { value: "custom", label: "Custom" },
];
const businesses: FilterOption[] = [
  { value: "all", label: "All Business" },
  { value: "motor", label: "Motor" },
  { value: "non motor", label: "Non Motor" },
  { value: "life", label: "Life" },
  { value: "health", label: "Health" },
];
const controlClass = "h-9 rounded-lg border border-[#d4deeb] bg-white px-3 text-[11px] font-semibold text-[#30445f] outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:opacity-60";

export function PartnerReportsFilters({
  period, business, from, to, exportHref, insurerOptions = [], rmOptions = [],
  intermediaryOptions = [], insurer = "", rm = "", intermediary = "", showAdvanced = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [draftPeriod, setDraftPeriod] = useState(period);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const advancedRef = useRef<HTMLDivElement>(null);
  const queryString = searchParams.toString();
  const existingParams = useMemo(() => new URLSearchParams(queryString), [queryString]);

  useEffect(() => { if (!calendarOpen) setDraftPeriod(period); }, [period, calendarOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!advancedRef.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(existingParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? pathname + "?" + qs : pathname, { scroll: false }));
  }

  function changePeriod(value: string) {
    if (value === "custom") {
      setDraftPeriod("custom");
      setCalendarOpen(true);
      setFiltersOpen(false);
      return;
    }
    setCalendarOpen(false);
    setDraftPeriod(value);
    navigate({ period: value, from: null, to: null });
  }

  function onCalendarOpenChange(open: boolean) {
    setCalendarOpen(open);
    if (!open) setDraftPeriod(period);
  }

  function changeAdvanced(field: "insurer" | "rm" | "intermediary", value: string) {
    navigate({ [field]: value || null });
  }

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-1.5 lg:flex-nowrap" aria-busy={isPending}>
      <div className="relative shrink-0">
        <select
          aria-label="Report period"
          value={draftPeriod}
          onChange={(event) => changePeriod(event.target.value)}
          className={controlClass + " w-[138px] appearance-none pr-9"}
        >
          {periods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {draftPeriod === "custom" ? (
          <button type="button" aria-label="Open custom date calendar" aria-haspopup="dialog"
            aria-expanded={calendarOpen} className="absolute right-7 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[#60738b] hover:bg-slate-100"
            onClick={() => setCalendarOpen(true)}>
            <CalendarDays size={14} />
          </button>
        ) : null}
        <ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b]" />
        {draftPeriod === "custom" ? (
          <ReportDateRangePicker
            from={from} to={to} hideTrigger align="left"
            open={calendarOpen} onOpenChange={onCalendarOpenChange}
            onRangeComplete={(nextFrom, nextTo) => {
              setCalendarOpen(false);
              setDraftPeriod("custom");
              navigate({ period: "custom", from: nextFrom, to: nextTo });
            }}
          />
        ) : null}
      </div>

      <select aria-label="Business type" value={business} onChange={(event) => navigate({ business: event.target.value })}
        className={controlClass + " w-[146px] shrink-0"}>
        {businesses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>

      {showAdvanced ? (
        <div className="relative shrink-0" ref={advancedRef}>
          <button type="button" aria-expanded={filtersOpen} aria-controls="partner-reports-advanced-filters"
            onClick={() => { setFiltersOpen((open) => !open); setCalendarOpen(false); }}
            className={controlClass + " inline-flex items-center gap-2"}>
            <SlidersHorizontal size={14} /> Filters
          </button>
          {filtersOpen ? (
            <div id="partner-reports-advanced-filters" className="absolute right-0 top-[calc(100%+6px)] z-50 w-[280px] space-y-2 rounded-xl border border-[#dbe3ee] bg-white p-3 shadow-xl">
              <label className="block text-[10px] font-semibold text-[#526780]">Insurer
                <select aria-label="Filter insurer" value={insurer} onChange={(event) => changeAdvanced("insurer", event.target.value)} className={controlClass + " mt-1 w-full"}>
                  <option value="">All insurers</option>
                  {insurerOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className="block text-[10px] font-semibold text-[#526780]">RM
                <select aria-label="Filter RM" value={rm} onChange={(event) => changeAdvanced("rm", event.target.value)} className={controlClass + " mt-1 w-full"}>
                  <option value="">All RMs</option>
                  {rmOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className="block text-[10px] font-semibold text-[#526780]">Intermediary
                <select aria-label="Filter intermediary" value={intermediary} onChange={(event) => changeAdvanced("intermediary", event.target.value)} className={controlClass + " mt-1 w-full"}>
                  <option value="">All intermediaries</option>
                  {intermediaryOptions.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <a href={exportHref} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#1166ad] px-4 text-[11px] font-bold text-white hover:bg-[#0e5795]">
        <Download size={15} /> Export
      </a>
    </div>
  );
}
