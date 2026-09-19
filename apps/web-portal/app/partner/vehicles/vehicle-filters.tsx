"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { useTransition } from "react";
import type { VehicleStatusFilter, VehicleTypeFilter } from "./vehicle-filter-types";
import { VEHICLE_TYPE_OPTIONS } from "./vehicle-filter-types";

type VehicleFilterCounts = {
  all: number;
  registered: number;
  rcPending: number;
  uninsured: number;
};

export function VehicleFilters({
  status,
  vehicleType,
  counts,
}: {
  status: VehicleStatusFilter;
  vehicleType: VehicleTypeFilter;
  counts: VehicleFilterCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function navigate(nextStatus: VehicleStatusFilter, nextVehicleType: VehicleTypeFilter) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    if (nextStatus === "all") params.delete("status");
    else params.set("status", nextStatus);

    if (nextVehicleType === "all") params.delete("vehicleType");
    else params.set("vehicleType", nextVehicleType);

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  const statusButtons: Array<{ value: VehicleStatusFilter; label: string; count: number }> = [
    { value: "all", label: "All", count: counts.all },
    { value: "registered", label: "Registered", count: counts.registered },
    { value: "rc_pending", label: "RC pending", count: counts.rcPending },
    { value: "uninsured", label: "Uninsured", count: counts.uninsured },
  ];

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap xl:justify-end">
      <label className="relative inline-flex h-11 min-w-[190px] items-center rounded-[13px] border border-[#CFDAE7] bg-white text-[11px] font-bold text-[#344761] focus-within:border-[#7FAADD] focus-within:ring-2 focus-within:ring-[#2E7ED0]/10">
        <SlidersHorizontal className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#6F8199]" />
        <select
          aria-label="Vehicle type"
          value={vehicleType}
          disabled={isPending}
          onChange={(event) => navigate(status, event.target.value as VehicleTypeFilter)}
          className="h-full w-full cursor-pointer appearance-auto rounded-[13px] bg-transparent pl-10 pr-3 text-[11px] font-bold text-[#344761] outline-none disabled:cursor-wait disabled:opacity-60"
        >
          {VEHICLE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-1 rounded-[14px] border border-[#CFDAE7] bg-[#F8FAFD] p-1" role="group" aria-label="Vehicle status filter">
        {statusButtons.map((item) => {
          const active = status === item.value;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              disabled={isPending}
              onClick={() => navigate(item.value, vehicleType)}
              className={`inline-flex h-9 items-center rounded-[10px] px-3.5 text-[10px] transition disabled:cursor-wait disabled:opacity-60 ${
                active
                  ? "bg-[#153E6D] font-extrabold text-white"
                  : "font-bold text-[#586A82] hover:bg-white hover:text-[#294766]"
              }`}
            >
              {item.label}
              <span className={`ml-1.5 ${active ? "opacity-90" : "text-[#91A0B3]"}`}>{item.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
