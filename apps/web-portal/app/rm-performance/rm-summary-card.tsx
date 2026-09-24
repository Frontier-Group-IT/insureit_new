"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

type Source = {
  key: string;
  label: string;
  todayPolicies: number;
  todayNetPremium: number;
  mtdPolicies: number;
  mtdNetPremium: number;
};

type RmRow = {
  employeeId: string | null;
  name: string;
  contributionPercent: number;
  todayPolicies: number;
  todayNetPremium: number;
  mtdPolicies: number;
  mtdNetPremium: number;
  sources: Source[];
};

export function RmSummaryCard({ row }: { row: RmRow }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="overflow-hidden rounded-xl border border-[#DCE3EB] bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={
          "w-full px-4 py-3 text-left transition-colors " +
          (open
            ? "border-b border-[#D8E1EC] bg-[#F4F7FB]"
            : "bg-white hover:bg-[#FAFBFD]")
        }
      >
        <div className="grid gap-3 xl:grid-cols-[minmax(190px,1.05fr)_minmax(260px,.9fr)_minmax(260px,.9fr)_30px] xl:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-[12px] font-black text-[#1B2D48]">{row.name}</p>
              <span className="rounded-full border border-[#D5E0ED] bg-white px-2 py-0.5 text-[7.5px] font-black text-[#315B9A]">
                {row.contributionPercent.toFixed(1)}%
              </span>
            </div>
            <p className="mt-0.5 text-[7.5px] font-medium text-[#8A96A6]">MTD contribution</p>
          </div>

          <MetricGroup
            label="TODAY"
            tone="daily"
            policies={row.todayPolicies}
            net={row.todayNetPremium}
          />

          <MetricGroup
            label="MONTH TO DATE"
            tone="mtd"
            policies={row.mtdPolicies}
            net={row.mtdNetPremium}
          />

          <div className="flex justify-end">
            <span
              className={
                "grid h-7 w-7 place-items-center rounded-full border transition " +
                (open
                  ? "rotate-180 border-[#B9C7D8] bg-[#17365D] text-white"
                  : "border-[#D7E0EB] bg-white text-[#60738F]")
              }
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </button>

      {open ? (
        <div className="bg-[#FBFCFE] px-4 py-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[7.5px] font-black uppercase tracking-[.12em] text-[#748296]">
              Source Breakdown
            </p>
            <span className="text-[7.5px] font-semibold text-[#9AA4B2]">
              {row.sources.length} source{row.sources.length === 1 ? "" : "s"}
            </span>
          </div>

          {row.sources.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {row.sources.map((source) => (
                <SourceItem key={source.key} source={source} />
              ))}
            </div>
          ) : (
            <div className="border-t border-dashed border-[#D9E0E8] py-3 text-[8.5px] text-[#98A2B3]">
              No source business recorded.
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function MetricGroup({
  label,
  tone,
  policies,
  net,
}: {
  label: string;
  tone: "daily" | "mtd";
  policies: number;
  net: number;
}) {
  const daily = tone === "daily";
  return (
    <div
      className={
        "rounded-lg px-3 py-2 " +
        (daily ? "bg-[#F1F6FC]" : "bg-[#F1F8F5]")
      }
    >
      <p
        className={
          "text-[6.5px] font-black uppercase tracking-[.1em] " +
          (daily ? "text-[#4F76A6]" : "text-[#3F7D70]")
        }
      >
        {label}
      </p>
      <div className="mt-1 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[6.3px] font-bold uppercase tracking-[.06em] text-[#8E99A8]">Policies</p>
          <p className="mt-0.5 text-[10.5px] font-black text-[#263A55]">{number(policies)}</p>
        </div>
        <div className="border-l border-black/[.06] pl-3">
          <p className="text-[6.3px] font-bold uppercase tracking-[.06em] text-[#8E99A8]">Net Premium</p>
          <p className="mt-0.5 truncate text-[10.5px] font-black text-[#263A55]">{money(net)}</p>
        </div>
      </div>
    </div>
  );
}

function SourceItem({ source }: { source: Source }) {
  return (
    <div className="min-w-0 rounded-lg border-2 border-[#D3DDE9] bg-white px-3 py-2.5">
      <p className="truncate text-[8px] font-black text-[#354760]" title={source.label}>
        {source.label}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[6.2px] font-black uppercase tracking-[.07em] text-[#A0A9B5]">Today</p>
          <p className="mt-0.5 truncate text-[8.5px] font-bold text-[#44546B]">{money(source.todayNetPremium)}</p>
          <p className="mt-0.5 text-[6.8px] text-[#99A4B2]">{number(source.todayPolicies)} policies</p>
        </div>
        <div className="border-l border-[#EDF0F4] pl-2">
          <p className="text-[6.2px] font-black uppercase tracking-[.07em] text-[#A0A9B5]">MTD</p>
          <p className="mt-0.5 truncate text-[8.5px] font-black text-[#17365D]">{money(source.mtdNetPremium)}</p>
          <p className="mt-0.5 text-[6.8px] text-[#99A4B2]">{number(source.mtdPolicies)} policies</p>
        </div>
      </div>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function number(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}
