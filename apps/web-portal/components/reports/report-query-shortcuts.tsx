"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type ReportShortcut = { value: string; label: string };

export function ReportQueryShortcuts({
  label,
  param,
  activeValue,
  options,
}: {
  label: string;
  param: "period" | "horizon";
  activeValue: string;
  options: readonly ReportShortcut[];
}) {
  const pathname = usePathname();
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
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="mr-1 text-[8.5px] font-black uppercase tracking-[0.08em] text-[#7b8799]">{label}</span>
        {displayedOptions.map((option) => (
          <Link
            key={option.value}
            href={buildHref(pathname, currentQuery, param, option.value)}
            className={`rounded-lg border px-3 py-2 text-[10px] font-bold transition ${activeValue === option.value ? "border-[#223a78] bg-[#223a78] text-white" : "border-[#dfe5ee] bg-white text-[#506077] hover:border-[#bfc9db] hover:text-[#23365f]"}`}
          >
            {option.label}
          </Link>
        ))}
      </div>
      {activeFilterCount > 0 ? (
        <span className="shrink-0 rounded-full border border-[#dfe5ee] bg-[#f8fafc] px-2.5 py-1 text-[8.5px] font-bold text-[#607087]">
          {activeFilterCount} active {activeFilterCount === 1 ? "filter" : "filters"}
        </span>
      ) : null}
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
