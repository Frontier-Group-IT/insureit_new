"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

type Source = { key: string; label: string; todayPolicies: number; todayNetPremium: number; mtdPolicies: number; mtdNetPremium: number };
type RmRow = { employeeId: string | null; name: string; contributionPercent: number; todayPolicies: number; todayNetPremium: number; mtdPolicies: number; mtdNetPremium: number; sources: Source[] };

export function RmSummaryCard({ row }: { row: RmRow }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="overflow-hidden rounded-xl border border-[#DCE3EB] bg-white">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className={"w-full px-4 py-3 text-left transition-colors " + (open ? "border-b border-[#D8E1EC] bg-[#F4F7FB]" : "bg-white hover:bg-[#FAFBFD]")}>
        <div className="grid gap-3 xl:grid-cols-[minmax(190px,1.05fr)_minmax(260px,.9fr)_minmax(260px,.9fr)_30px] xl:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-[14px] font-black text-[#172A46]">{row.name}</p>
              <span className="rounded-full border border-[#C8D6E8] bg-white px-2.5 py-0.5 text-[9px] font-black text-[#315B9A]">{row.contributionPercent.toFixed(1)}%</span>
            </div>
            <p className="mt-1 text-[10px] font-medium text-[#687589]">MTD contribution</p>
          </div>
          <MetricGroup label="TODAY" tone="daily" policies={row.todayPolicies} net={row.todayNetPremium} />
          <MetricGroup label="MONTH TO DATE" tone="mtd" policies={row.mtdPolicies} net={row.mtdNetPremium} />
          <div className="flex justify-end"><span className={"grid h-8 w-8 place-items-center rounded-full border transition " + (open ? "rotate-180 border-[#B9C7D8] bg-[#17365D] text-white" : "border-[#D7E0EB] bg-white text-[#52647D]")}><ChevronDown className="h-4 w-4" /></span></div>
        </div>
      </button>
      {open ? (
        <div className="bg-[#FBFCFE] px-4 py-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[.12em] text-[#566477]">Source Breakdown</p>
            <span className="text-[10px] font-semibold text-[#69778A]">{row.sources.length} source{row.sources.length === 1 ? "" : "s"}</span>
          </div>
          {row.sources.length ? (
            <div className="grid overflow-hidden rounded-xl border border-[#DCE5EF] bg-white sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {row.sources.map((source, index) => <SourceItem key={source.key} source={source} last={index === row.sources.length - 1} />)}
            </div>
          ) : <div className="border-t border-dashed border-[#D9E0E8] py-3 text-[11px] font-medium text-[#6D798B]">No source business recorded.</div>}
        </div>
      ) : null}
    </article>
  );
}

function MetricGroup({ label, tone, policies, net }: { label: string; tone: "daily" | "mtd"; policies: number; net: number }) {
  const daily = tone === "daily";
  return (
    <div className={"rounded-lg border px-3.5 py-2.5 " + (daily ? "border-[#DFE9F5] bg-[#F1F6FC]" : "border-[#DFECE6] bg-[#F1F8F5]")}>
      <p className={"text-[9px] font-black uppercase tracking-[.1em] " + (daily ? "text-[#3F6697]" : "text-[#346E62]")}>{label}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-3">
        <div><p className="text-[9px] font-bold uppercase tracking-[.05em] text-[#667386]">Policies</p><p className="mt-0.5 text-[13px] font-black text-[#263A55]">{number(policies)}</p></div>
        <div className="border-l border-black/[.08] pl-3"><p className="text-[9px] font-bold uppercase tracking-[.05em] text-[#667386]">Net Premium</p><p className="mt-0.5 truncate text-[13px] font-black text-[#263A55]">{money(net)}</p></div>
      </div>
    </div>
  );
}

function SourceItem({ source, last }: { source: Source; last: boolean }) {
  return (
    <div className={"min-w-0 px-3.5 py-3 " + (!last ? "border-b border-[#E7ECF2] sm:border-r xl:border-b-0" : "")}>
      <p className="truncate text-[11px] font-black text-[#2D405A]" title={source.label}>{source.label}</p>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <div><p className="text-[9px] font-black uppercase tracking-[.07em] text-[#657286]">Today</p><p className="mt-1 truncate text-[11px] font-bold text-[#334861]">{money(source.todayNetPremium)}</p><p className="mt-1 text-[9.5px] font-medium text-[#6F7C8E]">{number(source.todayPolicies)} policies</p></div>
        <div className="border-l border-[#E4E9EF] pl-2.5"><p className="text-[9px] font-black uppercase tracking-[.07em] text-[#657286]">MTD</p><p className="mt-1 truncate text-[11px] font-black text-[#17365D]">{money(source.mtdNetPremium)}</p><p className="mt-1 text-[9.5px] font-medium text-[#6F7C8E]">{number(source.mtdPolicies)} policies</p></div>
      </div>
    </div>
  );
}

function money(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function number(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
