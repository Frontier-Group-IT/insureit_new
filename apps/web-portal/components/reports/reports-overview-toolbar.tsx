"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, ChevronDown, Download } from "lucide-react";

export type OverviewPeriod = "mtd" | "last_month" | "last_6_months" | "custom";
export type OverviewBusiness = "all" | "motor" | "non_motor" | "life" | "health";
export type OverviewTrendPeriod = "mtd" | "last_month" | "last_6_months" | "1_year";
export type OverviewMix = "insurer" | "rm" | "source";

type Props = {
  activePeriod: OverviewPeriod;
  activeBusiness: OverviewBusiness;
  activeTrend: OverviewTrendPeriod;
  activeMix: OverviewMix;
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

const BUSINESS_OPTIONS: Array<{ value: OverviewBusiness; label: string }> = [
  { value: "all", label: "All Business" },
  { value: "motor", label: "Motor" },
  { value: "non_motor", label: "Non Motor" },
  { value: "life", label: "Life" },
  { value: "health", label: "Health" },
];

export function ReportsOverviewToolbar({ activePeriod, activeBusiness, activeTrend, activeMix, fromDate, toDate, today, exportHref }: Props) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const businessRef = useRef<HTMLDivElement>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
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
      if ((periodOpen || customOpen) && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setPeriodOpen(false);
        setCustomOpen(false);
        setDateError("");
      }
      if (businessOpen && businessRef.current && !businessRef.current.contains(event.target as Node)) {
        setBusinessOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPeriodOpen(false);
        setBusinessOpen(false);
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
  }, [periodOpen, businessOpen, customOpen]);

  function baseParams() {
    const params = new URLSearchParams();
    if (activeBusiness !== "all") params.set("business", activeBusiness);
    if (activeTrend !== "last_6_months") params.set("trend", activeTrend);
    if (activeMix !== "insurer") params.set("mix", activeMix);
    return params;
  }

  function applyPeriod(period: OverviewPeriod) {
    setPeriodOpen(false);
    if (period === "custom") {
      setCustomFrom(fromDate);
      setCustomTo(toDate);
      setDateError("");
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    const params = baseParams();
    params.set("period", period);
    router.push(`/reports?${params.toString()}`);
  }

  function applyBusiness(business: OverviewBusiness) {
    setBusinessOpen(false);
    setCustomOpen(false);
    const params = new URLSearchParams();
    params.set("period", activePeriod);
    if (activePeriod === "custom") {
      params.set("from", fromDate);
      params.set("to", toDate);
    }
    if (business !== "all") params.set("business", business);
    if (activeTrend !== "last_6_months") params.set("trend", activeTrend);
    if (activeMix !== "insurer") params.set("mix", activeMix);
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
    const params = baseParams();
    params.set("period", "custom");
    params.set("from", customFrom);
    params.set("to", customTo);
    setCustomOpen(false);
    setDateError("");
    router.push(`/reports?${params.toString()}`);
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
            onClick={() => {
              if (customOpen) {
                setCustomOpen(false);
                setDateError("");
                setPeriodOpen(true);
                return;
              }
              setPeriodOpen((open) => !open);
            }}
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

          {customOpen ? (
            <div
              role="dialog"
              aria-labelledby="report-custom-period-title"
              className="absolute right-0 top-[calc(100%+6px)] z-50 w-[390px] max-w-[calc(100vw-32px)] rounded-xl border border-[#d8e0eb] bg-white p-4 shadow-[0_16px_40px_rgba(25,45,78,0.18)]"
            >
              <h2 id="report-custom-period-title" className="text-[13px] font-bold text-[#152b4d]">
                Select the period for report
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
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
                    className="h-9 w-full rounded-lg border border-[#d4deea] bg-white px-2.5 text-[11px] font-semibold text-[#243b5a]"
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
                    className="h-9 w-full rounded-lg border border-[#d4deea] bg-white px-2.5 text-[11px] font-semibold text-[#243b5a]"
                  />
                </label>
              </div>
              {dateError ? <p className="mt-2.5 text-[10px] font-semibold text-[#b42318]">{dateError}</p> : null}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={applyCustomPeriod}
                  className="h-8 min-w-[70px] rounded-lg bg-[#155fa0] px-4 text-[10px] font-bold text-white transition hover:bg-[#104f87]"
                >
                  OK
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div ref={businessRef} className="relative">
          <button
            type="button"
            className="ov-control"
            aria-haspopup="menu"
            aria-expanded={businessOpen}
            onClick={() => setBusinessOpen((open) => !open)}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>{BUSINESS_OPTIONS.find((item) => item.value === activeBusiness)?.label ?? "All Business"}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          {businessOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[160px] overflow-hidden rounded-lg border border-[#d8e0eb] bg-white p-1.5 shadow-[0_14px_35px_rgba(25,45,78,0.16)]"
            >
              {BUSINESS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  onClick={() => applyBusiness(option.value)}
                  className={`flex w-full items-center rounded-md px-3 py-2 text-left text-[11px] font-semibold transition hover:bg-[#f1f5fb] ${
                    option.value === activeBusiness ? "bg-[#eef4fb] text-[#174b82]" : "text-[#344862]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Link prefetch={false} href={exportHref} className="ov-control ov-control--primary">
          <Download className="h-3.5 w-3.5" />
          <span>Export</span>
        </Link>
      </div>

    </>
  );
}
