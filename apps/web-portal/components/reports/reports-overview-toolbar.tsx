"use client";

import Link from "next/link";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";
import { useReportsNavigationPending } from "@/components/reports/reports-navigation-pending";
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

export function ReportsOverviewToolbar({ activePeriod, activeBusiness, activeTrend, activeMix, fromDate, toDate, exportHref }: Props) {
  const router = useRouter();
  const { beginReportNavigation } = useReportsNavigationPending();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const businessRef = useRef<HTMLDivElement>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const activeLabel = useMemo(() => {
    if (activePeriod !== "custom") return PERIOD_OPTIONS.find((item) => item.value === activePeriod)?.label ?? "MTD";
    return "Custom";
  }, [activePeriod]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (periodOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setPeriodOpen(false);
      if (businessOpen && businessRef.current && !businessRef.current.contains(event.target as Node)) setBusinessOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPeriodOpen(false);
        setBusinessOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [periodOpen, businessOpen]);

  function baseParams() {
    const params = new URLSearchParams();
    if (activeBusiness !== "all") params.set("business", activeBusiness);
    if (activeTrend !== "last_6_months") params.set("trend", activeTrend);
    if (activeMix !== "insurer") params.set("mix", activeMix);
    return params;
  }

  function pushReport(href: string) {
    if (!beginReportNavigation(href)) return;
    router.push(href);
  }

  function applyPeriod(period: OverviewPeriod) {
    setPeriodOpen(false);
    const params = baseParams();
    params.set("period", period);
    if (period === "custom") {
      setCustomOpen(true);
      params.set("from", fromDate);
      params.set("to", toDate);
    } else {
      setCustomOpen(false);
    }
    pushReport(`/reports?${params.toString()}`);
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
    pushReport(`/reports?${params.toString()}`);
  }

  return (
    <div className="ov-toolbar">
      <div ref={dropdownRef} className="relative">
        <button type="button" className="ov-control" aria-haspopup="menu" aria-expanded={periodOpen} onClick={() => setPeriodOpen((open) => !open)}>
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{activeLabel}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        {periodOpen ? (
          <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[155px] overflow-hidden rounded-lg border border-[#d8e0eb] bg-white p-1.5 shadow-[0_14px_35px_rgba(25,45,78,0.16)]">
            {PERIOD_OPTIONS.map((option) => (
              <button key={option.value} type="button" role="menuitem" onClick={() => applyPeriod(option.value)} className={`flex w-full items-center rounded-md px-3 py-2 text-left text-[11px] font-semibold transition hover:bg-[#f1f5fb] ${option.value === activePeriod ? "bg-[#f7f8fa] text-[#344862]" : "text-[#344862]"}`}>
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {activePeriod === "custom" || customOpen ? (
        <ReportDateRangePicker
          from={fromDate}
          to={toDate}
          open={customOpen}
          onOpenChange={setCustomOpen}
          buttonClassName="ov-control min-w-[190px] justify-between text-left"
          onRangeComplete={(customFrom, customTo) => {
            const params = baseParams();
            params.set("period", "custom");
            params.set("from", customFrom);
            params.set("to", customTo);
            setCustomOpen(false);
            pushReport(`/reports?${params.toString()}`);
          }}
        />
      ) : null}

      <div ref={businessRef} className="relative">
        <button type="button" className="ov-control" aria-haspopup="menu" aria-expanded={businessOpen} onClick={() => setBusinessOpen((open) => !open)}>
          <Building2 className="h-3.5 w-3.5" />
          <span>{BUSINESS_OPTIONS.find((item) => item.value === activeBusiness)?.label ?? "All Business"}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        {businessOpen ? (
          <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[160px] overflow-hidden rounded-lg border border-[#d8e0eb] bg-white p-1.5 shadow-[0_14px_35px_rgba(25,45,78,0.16)]">
            {BUSINESS_OPTIONS.map((option) => (
              <button key={option.value} type="button" role="menuitem" onClick={() => applyBusiness(option.value)} className={`flex w-full items-center rounded-md px-3 py-2 text-left text-[11px] font-semibold transition hover:bg-[#f1f5fb] ${option.value === activeBusiness ? "bg-[#f7f8fa] text-[#344862]" : "text-[#344862]"}`}>
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
  );
}
