"use client";

import { CalendarDays } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  const displayedOptions = param === "period" && !options.some((option) => option.value === "custom")
    ? [...options, { value: "custom", label: "Custom" }]
    : options;
  const activeFilterCount = Array.from(searchParams.entries()).filter(([key, value]) => {
    if (!value) return false;
    if (key === "period" || key === "horizon") return false;
    if (key.toLowerCase().includes("page")) return false;
    return true;
  }).length;

  return (
    <div className="report-shortcuts flex min-w-0 flex-wrap items-center justify-end gap-2">
      <label className="report-shortcut-select">
        <span className="sr-only">{label}</span>
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <select
          className="report-header-select"
          value={activeValue}
          aria-label={label}
          onChange={(event) => router.push(buildHref(pathname, currentQuery, param, event.target.value))}
        >
          {displayedOptions.map((option) => (
            <option key={option.value} value={option.value}>{compactLabel(option.label)}</option>
          ))}
        </select>
      </label>
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

  for (const [key] of Array.from(next.entries())) {
    if (key.toLowerCase().includes("page")) next.delete(key);
  }

  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function defaultPeriod(pathname: string) {
  return pathname === "/reports/governance" ? "30d" : "90d";
}
