"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

type Source = { key: string; label: string; todayPolicies: number; todayNetPremium: number; mtdPolicies: number; mtdNetPremium: number };
type RmRow = { employeeId: string | null; name: string; contributionPercent: number; todayPolicies: number; todayNetPremium: number; mtdPolicies: number; mtdNetPremium: number; sources: Source[] };

export function RmSummaryCard({ row, periodLabel, periodShortLabel }: { row: RmRow; periodLabel: string; periodShortLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <article className={"overflow-hidden rounded-xl bg-white transition-colors " + (open ? "border-2 border-[#C5D1DF] shadow-[0_3px_12px_rgba(31,54,87,.06)]" : "border border-[#E5EAF0]")}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className={"w-full px-4 py-2 text-left transition-colors " + (open ? "border-b border-[#DDE4EC] bg-[#F9FAFC]" : "bg-white hover:bg-[#FAFBFD]")}>
        <div className="grid gap-2.5 xl:grid-cols-[minmax(190px,1.05fr)_minmax(260px,.9fr)_3px_minmax(260px,.9fr)_30px] xl:items-center">
          <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-[13px] font-black text-[#172A46]">{row.name}</p><span className="rounded-full border border-[#D5DFEA] bg-white px-2 py-0.5 text-[8.5px] font-black text-[#315B9A]">{row.contributionPercent.toFixed(1)}%</span></div><p className="mt-0.5 text-[9.5px] font-medium text-[#687589]">{periodShortLabel} contribution</p></div>
          <MetricGroup label="TODAY" policies={row.todayPolicies} net={row.todayNetPremium} />
          <div className="hidden h-12 w-[3px] rounded-full bg-[#AFC0D3] xl:block" aria-hidden="true" />
          <MetricGroup label={periodLabel} policies={row.mtdPolicies} net={row.mtdNetPremium} />
          <div className="flex justify-end"><span className={"grid h-7 w-7 place-items-center rounded-full border transition " + (open ? "rotate-180 border-[#17365D] bg-[#17365D] text-white" : "border-[#E0E6ED] bg-white text-[#52647D]")}><ChevronDown className="h-3.5 w-3.5" /></span></div>
        </div>
      </button>
      {open ? <div className="border-t border-[#E2E7ED] bg-[#FBFCFE] px-4 py-3"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[.12em] text-[#566477]">Source Breakdown</p><span className="text-[10px] font-semibold text-[#69778A]">{row.sources.length} source{row.sources.length === 1 ? "" : "s"}</span></div>{row.sources.length ? <div className="grid overflow-hidden rounded-xl border border-[#D7E0E9] bg-white sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{row.sources.map((source, index) => <SourceItem key={source.key} source={source} last={index === row.sources.length - 1} periodShortLabel={periodShortLabel} />)}</div> : <div className="border-t border-dashed border-[#E1E6EC] py-3 text-[11px] font-medium text-[#6D798B]">No source business recorded.</div>}</div> : null}
    </article>
  );
}

function MetricGroup({ label, policies, net }: { label: string; policies: number; net: number }) {
  return <div className="relative border-t border-[#E1E7EE] px-3 pb-1 pt-2"><span className="absolute -top-[7px] left-3 bg-white px-1.5 text-[8.5px] font-black uppercase tracking-[.1em] text-[#49617F]">{label}</span><div className="grid grid-cols-2 gap-3"><div><p className="text-[8px] font-bold uppercase tracking-[.05em] text-[#667386]">Policies</p><p className="text-[12px] font-black text-[#263A55]">{number(policies)}</p></div><div className="border-l border-[#E6EBF1] pl-3"><p className="text-[8px] font-bold uppercase tracking-[.05em] text-[#667386]">Net Premium</p><p className="truncate text-[12px] font-black text-[#263A55]">{money(net)}</p></div></div></div>;
}

function SourceItem({ source, last, periodShortLabel }: { source: Source; last: boolean; periodShortLabel: string }) {
  return <div className={"min-w-0 px-3.5 py-3 " + (!last ? "border-b border-[#EDF0F4] sm:border-r xl:border-b-0" : "")}><p className="truncate text-[11px] font-black text-[#2D405A]" title={source.label}>{source.label}</p><div className="mt-2.5 grid grid-cols-2 gap-2.5"><div><p className="text-[9px] font-black uppercase tracking-[.07em] text-[#657286]">Today</p><p className="mt-1 truncate text-[11px] font-bold text-[#334861]">{money(source.todayNetPremium)}</p><p className="mt-1 text-[9.5px] font-medium text-[#6F7C8E]">{number(source.todayPolicies)} policies</p></div><div className="border-l border-[#EDF0F4] pl-2.5"><p className="text-[9px] font-black uppercase tracking-[.07em] text-[#657286]">{periodShortLabel}</p><p className="mt-1 truncate text-[11px] font-black text-[#17365D]">{money(source.mtdNetPremium)}</p><p className="mt-1 text-[9.5px] font-medium text-[#6F7C8E]">{number(source.mtdPolicies)} policies</p></div></div></div>;
}

function money(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function number(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
