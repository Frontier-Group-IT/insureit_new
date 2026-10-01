"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReportDateRangePicker } from "@/components/reports/report-date-range-picker";

export type ReportShortcut = { value: string; label: string };

export function ReportQueryShortcuts({
  label,
  param,
  activeValue,
  options,
  showActiveFilterCount = true,
  trailing,
}: {
  label: string;
  param: "period" | "horizon";
  activeValue: string;
  options: readonly ReportShortcut[];
  showActiveFilterCount?: boolean;
  trailing?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const [customOpen, setCustomOpen] = useState(false);
  const customFrom = searchParams.get("from") ?? "";
  const customTo = searchParams.get("to") ?? "";
  const customActive = param === "period" && activeValue === "custom";
  const displayedOptions = param === "period" && !options.some((option) => option.value === "custom")
    ? [...options, { value: "custom", label: "Custom" }]
    : options;
  const activeFilterCount = Array.from(searchParams.entries()).filter(([key, value]) => {
    if (!value) return false;
    if (key === "period" || key === "horizon") return false;
    if (key.toLowerCase().includes("page")) return false;
    return true;
  }).length;

  useEffect(() => {
    if (customActive && (!customFrom || !customTo)) setCustomOpen(true);
    if (!customActive) setCustomOpen(false);
  }, [customActive, customFrom, customTo]);

  function applyShortcut(value: string) {
    if (param === "period") setCustomOpen(value === "custom");
    router.push(buildHref(pathname, currentQuery, param, value));
  }

  function applyCustomRange(from: string, to: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("period", "custom");
    next.set("from", from);
    next.set("to", to);
    clearPages(next);
    setCustomOpen(false);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="report-shortcuts flex min-w-0 flex-wrap items-center justify-end gap-2">
      <style>{`
        form[action="/reports/business"]:has(input[type="date"][name="from"]):has(input[type="date"][name="to"]) { display: none !important; }
        form[action^="/reports/"] input[type="date"][name="from"],
        form[action^="/reports/"] input[type="date"][name="to"] { display: none !important; }
        form[action^="/reports/"] label:has(input[type="date"][name="from"]),
        form[action^="/reports/"] label:has(input[type="date"][name="to"]) { display: none !important; }
      `}</style>
      <label className="report-shortcut-select">
        <span className="sr-only">{label}</span>
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <select
          className="report-header-select"
          value={activeValue}
          aria-label={label}
          onChange={(event) => applyShortcut(event.target.value)}
        >
          {displayedOptions.map((option) => (
            <option key={option.value} value={option.value}>{compactLabel(option.label)}</option>
          ))}
        </select>
      </label>
      {customActive ? (
        <ReportDateRangePicker
          from={customFrom}
          to={customTo}
          open={customOpen}
          onOpenChange={setCustomOpen}
          onRangeComplete={applyCustomRange}
          buttonClassName="inline-flex h-9 min-w-[190px] items-center justify-between gap-3 rounded-xl border border-[#CBD5E1] bg-white px-3 text-left text-[11px] font-semibold text-[#22314A] outline-none transition hover:border-[#AAB8C8]"
        />
      ) : null}
      {showActiveFilterCount && activeFilterCount > 0 ? (
        <span className="rounded-full border border-[#dfe5ee] bg-[#f8fafc] px-2.5 py-1 text-[8.5px] font-bold text-[#607087]">
          {activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}
        </span>
      ) : null}
      {trailing}
    </div>
  );
}

export function ReportFilterSubmitGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPeriod = searchParams.get("period") ?? defaultPeriod(pathname);

  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form || !form.closest(".report-page-shell")) return;
      const periodInput = form.querySelector<HTMLInputElement>('input[type="hidden"][name="period"]');
      if (!periodInput) return;

      const fromInput = form.querySelector<HTMLInputElement>('input[name="from"]');
      const toInput = form.querySelector<HTMLInputElement>('input[name="to"]');
      const datesChanged = [fromInput, toInput].some((input) => input && input.value !== input.defaultValue);
      const useCustomDates = datesChanged || currentPeriod === "custom";
      periodInput.value = useCustomDates ? "custom" : currentPeriod;

      if (!useCustomDates) {
        if (fromInput) fromInput.disabled = true;
        if (toInput) toInput.disabled = true;
      }
    };

    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, [currentPeriod]);

  return null;
}

function compactLabel(label: string) {
  if (label === "Month to date") return "MTD";
  if (label === "Year to date") return "YTD";
  if (label === "Last 90 days") return "90D";
  return label;
}

function buildHref(pathname: string, currentQuery: string, param: "period" | "horizon", value: string) {
  const next = new URLSearchParams(currentQuery);
  next.set(param, value);

  if (param === "period") {
    next.delete("from");
    next.delete("to");
  }

  clearPages(next);

  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function clearPages(params: URLSearchParams) {
  for (const [key] of Array.from(params.entries())) {
    if (key.toLowerCase().includes("page")) params.delete(key);
  }
}

function defaultPeriod(pathname: string) {
  return pathname === "/reports/governance" ? "30d" : "90d";
}
