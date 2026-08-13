"use client";

import Link from "next/link";
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
        {options.map((option) => (
          <Link
            key={option.value}
            href={buildHref(pathname, searchParams, param, option.value)}
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

function buildHref(pathname: string, current: URLSearchParams, param: "period" | "horizon", value: string) {
  const next = new URLSearchParams(current.toString());
  next.set(param, value);

  if (param === "period") {
    next.delete("from");
    next.delete("to");
  }

  for (const key of Array.from(next.keys())) {
    if (key.toLowerCase().includes("page")) next.delete(key);
  }

  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
