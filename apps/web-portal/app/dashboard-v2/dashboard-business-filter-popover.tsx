"use client";

import Link from "next/link";
import { Check, Filter, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { DashboardBusinessData, DashboardFilterOption } from "./dashboard-business";

export function BusinessFilterPopover({ business }: { business: DashboardBusinessData }) {
  const filters = business.filters;
  const [selectedPeriod, setSelectedPeriod] = useState(filters.period);
  const activeCount = business.appliedFilterCount + (filters.period !== "mtd" ? 1 : 0);

  return (
    <details className="group relative">
      <summary
        className="relative flex h-9 w-9 cursor-pointer list-none items-center justify-center border border-[#CBD5E1] bg-white text-[#42516A] transition hover:border-[#879AB4] hover:bg-[#F8FAFC] [&::-webkit-details-marker]:hidden"
        title="Filter business performance"
        aria-label="Filter business performance"
      >
        <Filter className="h-4 w-4" strokeWidth={1.8} />
        {activeCount ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-[#203A63] px-1 text-[7px] font-black text-white">
            {activeCount}
          </span>
        ) : null}
      </summary>

      <div className="absolute right-0 z-30 mt-2 w-[min(720px,calc(100vw-3rem))] border border-[#D5DEE9] bg-white shadow-[0_22px_55px_rgba(15,35,65,.16)]">
        <form action="/dashboard" method="get">
          <div className="flex items-start justify-between gap-4 border-b border-[#E5EAF1] px-5 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#182A47]">Business filters</p>
              <p className="mt-1 whitespace-normal break-words text-[7.5px] font-semibold leading-relaxed text-[#8794A7]">
                Filters apply only to Business Performance and Commercial Operations.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[7px] font-black uppercase tracking-[.1em] text-[#94A0B1]">Current view</p>
              <p className="mt-1 max-w-[220px] whitespace-normal break-words text-[8.5px] font-semibold leading-relaxed text-[#34445F]">
                {business.periodLabel}
              </p>
            </div>
          </div>

          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <FilterSelect
              name="period"
              label="Period"
              value={filters.period}
              options={[
                { value: "mtd", label: "Month to date" },
                { value: "today", label: "Today" },
                { value: "yesterday", label: "Yesterday" },
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "fy", label: "This FY" },
                { value: "custom", label: "Custom date range" },
              ]}
              onChange={(value) => setSelectedPeriod(value as DashboardBusinessData["filters"]["period"])}
            />
            <FilterSelect
              name="rm"
              label="Relationship Manager"
              value={filters.rmEmployeeId ?? ""}
              options={business.options.rms}
              allLabel="All RMs"
            />
            <FilterSelect
              name="insurer"
              label="Insurer"
              value={filters.insurerId ?? ""}
              options={business.options.insurers}
              allLabel="All insurers"
            />
            <FilterSelect
              name="partner"
              label="Partner"
              value={filters.intermediaryCode ?? ""}
              options={business.options.partners}
              allLabel="All partners"
            />

            {selectedPeriod === "custom" ? (
              <>
                <DateField name="from" label="From date" value={filters.fromDate} />
                <DateField name="to" label="To date" value={filters.toDate} />
              </>
            ) : null}
          </div>

          <details className="border-t border-[#EDF1F5]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-[8px] font-bold text-[#596A82] [&::-webkit-details-marker]:hidden">
              <span>Additional filters</span>
              <span className="font-semibold text-[#97A2B2]">Partner type · Business line · Vehicle class</span>
            </summary>
            <div className="grid gap-4 border-t border-[#EDF1F5] bg-[#FBFCFE] px-5 py-4 sm:grid-cols-3">
              <FilterSelect
                name="partnerType"
                label="Partner type"
                value={filters.intermediaryType ?? ""}
                options={business.options.partnerTypes}
                allLabel="All partner types"
              />
              <FilterSelect
                name="business"
                label="Business line"
                value={filters.businessLine ?? ""}
                options={business.options.businessLines}
                allLabel="All business lines"
              />
              <FilterSelect
                name="vehicleClass"
                label="Vehicle class"
                value={filters.vehicleClass ?? ""}
                options={business.options.vehicleClasses}
                allLabel="All vehicle classes"
              />
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5EAF1] bg-[#FBFCFE] px-5 py-3">
            <Link prefetch={false}
              href="/dashboard"
              className="inline-flex h-8 items-center gap-1.5 px-1 text-[8px] font-bold text-[#718096] hover:text-[#203A63]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset business filters
            </Link>
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-1.5 bg-[#203A63] px-4 text-[8px] font-bold text-white transition hover:bg-[#173157]"
            >
              <Check className="h-3.5 w-3.5" />
              Apply filters
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: DashboardFilterOption[];
  allLabel?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[7px] font-black uppercase tracking-[.08em] text-[#8995A7]">{label}</span>
      <select name={name} defaultValue={value} onChange={(event) => onChange?.(event.target.value)} className="min-h-[38px] w-full border border-[#CBD5E1] bg-white px-2.5 py-2 text-[8.5px] font-semibold leading-relaxed text-[#2D3D58] outline-none focus:border-[#607DA9]">
        {allLabel ? <option value="">{allLabel}</option> : null}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function DateField({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[7px] font-black uppercase tracking-[.08em] text-[#8995A7]">{label}</span>
      <input type="date" name={name} defaultValue={value} className="min-h-[38px] w-full border border-[#CBD5E1] bg-white px-2.5 py-2 text-[8.5px] font-semibold text-[#2D3D58] outline-none focus:border-[#607DA9]" />
    </label>
  );
}


