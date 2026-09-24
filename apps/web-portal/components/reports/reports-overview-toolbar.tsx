"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, ChevronDown, Download } from "lucide-react";

export type OverviewPeriod = "mtd" | "last_month" | "last_6_months" | "custom";

type Props = {
  activePeriod: OverviewPeriod;
  fromDate: string;
  toDate: string;
  today: string;
  exportHref: string;
};

const PERIOD_OPTIONS: Array<{ value: OverviewPeriod; label: string }> = [
  { value: "mtd", label: "MTD" },
  { value: "last_month", label: "Last Month" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "custom", label: "Custom" },
];

export function ReportsOverviewToolbar({ activePeriod, fromDate, toDate, today, exportHref }: Props) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(fromDate);
  const [customTo, setCustomTo] = useState(toDate);
  const [dateError, setDateError] = useState("");

  const activeLabel = useMemo(() => {
    if (activePeriod !== "custom") return PERIOD_OPTIONS.find((item) => item.value === activePeriod)?.label ?? "MTD";
    return "Custom";
  }, [activePeriod]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (periodOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPeriodOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPeriodOpen(false);
        setCustomOpen(false);
        setDateError("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [periodOpen]);

  function applyPeriod(period: OverviewPeriod) {
    setPeriodOpen(false);
    if (period === "custom") {
      setCustomFrom(activePeriod === "custom" ? fromDate : fromDate);
      setCustomTo(activePeriod === "custom" ? toDate : toDate);
      setDateError("");
      setCustomOpen(true);
      return;
    }
    const params = new URLSearchParams();
    params.set("period", period);
    router.push(`/reports?${params.toString()}`);
  }

  function applyCustomPeriod() {
    if (!customFrom || !customTo) {
      setDateError("Select both From Date and To Date.");
      return;
    }
    if (customFrom > customTo) {
      setDateError("To Date cannot be earlier than From Date.");
      return;
    }
    if (customTo > today) {
      setDateError("To Date cannot be later than today.");
      return;
    }
    const params = new URLSearchParams();
    params.set("period", "custom");
    params.set("from", customFrom);
    params.set("to", customTo);
    setCustomOpen(false);
    setDateError("");
    router.push(`/reports?${params.toString()}`);
  }

  function closeCustom() {
    setCustomOpen(false);
    setDateError("");
  }

  return (
    <>
      <div className="ov-toolbar">
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            className="ov-control"
            aria-haspopup="menu"
            aria-expanded={periodOpen}
            onClick={() => setPeriodOpen((open) => !open)}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{activeLabel}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {periodOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[155px] overflow-hidden rounded-lg border border-[#d8e0eb] bg-white p-1.5 shadow-[0_14px_35px_rgba(25,45,78,0.16)]"
            >
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  onClick={() => applyPeriod(option.value)}
                  className={`flex w-full items-center rounded-md px-3 py-2 text-left text-[11px] font-semibold transition hover:bg-[#f1f5fb] ${
                    option.value === activePeriod ? "bg-[#eef4fb] text-[#174b82]" : "text-[#344862]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button type="button" className="ov-control">
          <Building2 className="h-3.5 w-3.5" />
          <span>All Business</span>
          <ChevronDown className="h-3 w-3" />
        </button>

        <Link prefetch={false} href={exportHref} className="ov-control ov-control--primary">
          <Download className="h-3.5 w-3.5" />
          <span>Export</span>
        </Link>
      </div>

      {customOpen ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-[#0d1b2a]/25 px-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-custom-period-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCustom();
          }}
        >
          <div className="w-full max-w-[430px] rounded-2xl border border-[#dce4ef] bg-white p-5 shadow-[0_24px_70px_rgba(20,39,70,0.24)]">
            <h2 id="report-custom-period-title" className="text-[16px] font-bold text-[#152b4d]">
              Select the period for report
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-[10px] font-bold text-[#50627a]">
                From Date
                <input
                  type="date"
                  value={customFrom}
                  max={today}
                  onChange={(event) => {
                    setCustomFrom(event.target.value);
                    setDateError("");
                  }}
                  className="h-10 w-full rounded-lg border border-[#d4deea] bg-white px-3 text-[12px] font-semibold text-[#243b5a]"
                />
              </label>
              <label className="grid gap-1.5 text-[10px] font-bold text-[#50627a]">
                To Date
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  max={today}
                  onChange={(event) => {
                    setCustomTo(event.target.value);
                    setDateError("");
                  }}
                  className="h-10 w-full rounded-lg border border-[#d4deea] bg-white px-3 text-[12px] font-semibold text-[#243b5a]"
                />
              </label>
            </div>
            {dateError ? <p className="mt-3 text-[10px] font-semibold text-[#b42318]">{dateError}</p> : null}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={applyCustomPeriod}
                className="h-9 min-w-[76px] rounded-lg bg-[#155fa0] px-4 text-[11px] font-bold text-white transition hover:bg-[#104f87]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
