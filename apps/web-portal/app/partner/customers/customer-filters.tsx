"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { CustomerStatusFilter, CustomerTypeFilter } from "./customer-filter-types";

const CUSTOMER_TYPE_OPTIONS: { value: CustomerTypeFilter; label: string }[] = [
  { value: "all", label: "All customer types" },
  { value: "individual_proprietor", label: "Individual / Proprietor" },
  { value: "dealership", label: "Dealership" },
  { value: "corporate", label: "Corporate" },
  { value: "group", label: "Group" },
  { value: "posp", label: "POSP" },
  { value: "misp", label: "MISP" },
];

function useCustomerFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = (key: "status" | "customerType", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    if (value === "all") params.delete(key);
    else params.set(key, value);

    const nextSearch = params.toString();
    startTransition(() => {
      router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, { scroll: false });
    });
  };

  return { isPending, updateFilter };
}

export function CustomerTypeSelect({ value }: { value: CustomerTypeFilter }) {
  const { isPending, updateFilter } = useCustomerFilterNavigation();

  return (
    <div className="relative w-full sm:w-[225px] sm:shrink-0">
      <select
        aria-label="Customer type"
        value={value}
        disabled={isPending}
        onChange={(event) => updateFilter("customerType", event.target.value)}
        className="h-10 w-full appearance-none rounded-xl border border-[#D5DEEA] bg-white px-4 pr-9 text-[11px] font-semibold text-[#41516A] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10 disabled:cursor-wait disabled:opacity-70"
      >
        {CUSTOMER_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#425672]">⌄</span>
    </div>
  );
}

export function CustomerStatusTabs({
  value,
  total,
  active,
  inactive,
}: {
  value: CustomerStatusFilter;
  total: number;
  active: number;
  inactive: number;
}) {
  const { isPending, updateFilter } = useCustomerFilterNavigation();
  const tabs: { value: CustomerStatusFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: total },
    { value: "active", label: "Active", count: active },
    { value: "inactive", label: "Inactive", count: inactive },
  ];

  return (
    <div className="inline-flex h-10 shrink-0 items-center self-start rounded-xl border border-[#D5DEEA] bg-[#F7F9FC] p-1 text-[10px] font-bold text-[#667892] sm:self-auto xl:ml-3">
      {tabs.map((tab) => {
        const selected = value === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={selected}
            disabled={isPending}
            onClick={() => updateFilter("status", tab.value)}
            className={`inline-flex h-8 items-center rounded-lg px-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 disabled:cursor-wait ${
              selected
                ? "bg-[#173E6C] text-white shadow-sm"
                : "text-[#667892] hover:bg-white hover:text-[#173E6C]"
            }`}
          >
            {tab.label}&nbsp; {tab.count}
          </button>
        );
      })}
    </div>
  );
}
