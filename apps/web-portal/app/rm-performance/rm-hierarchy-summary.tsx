"use client";

import { ChevronDown, BriefcaseBusiness, UsersRound } from "lucide-react";
import { useState } from "react";
import { RmSummaryCard } from "./rm-summary-card";
import type { RmPerformanceRow } from "@/lib/rm-performance";

type Props = {
  rows: RmPerformanceRow[];
  periodLabel: string;
  periodShortLabel: string;
  selectedRmId: string | null;
};
const normalized = (name: string) => name.trim().toLocaleLowerCase("en-IN").replace(/\\s+/g, " ");
const money = (value: number) => "₹" + Math.round(value).toLocaleString("en-IN");

// Initial organizational grouping is intentionally display-only: the canonical,
// historical reporting relationships still need a verified personnel mapping.
const JATIN = "jatin kumar buwaniwala";
const JAYESH = "jayesh purohit";
const GAGAN = "gagan singh";
const JATIN_REPORTS = new Set(["parsottam", "pramod kumar nayak"]);

function SourceColumns({ sources, periodLabel }: { sources: RmPerformanceRow["sources"]; periodLabel: string }) {
  const [all, setAll] = useState(false);
  const visible = all ? sources : sources.slice(0, 3);
  return <div className="space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#65758C]">Direct partner / source breakdown</p>
      <span className="text-[10px] text-[#647286]">{sources.length} sources</span>
    </div>
    <div className="grid overflow-hidden rounded-xl border border-[#DBE4F0] bg-white sm:grid-cols-2 xl:grid-cols-3">
      {visible.map((source) => <div key={source.key} className="min-w-0 border-b border-r border-[#E7EDF5] px-3 py-3">
        <p className="min-h-7 text-[11px] font-bold text-[#213D60]">{source.label}</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <div><p className="text-[9px] font-bold uppercase text-[#71819A]">Today</p><p className="text-[11px] font-semibold">{money(source.todayNetPremium)}</p><p className="text-[10px] text-[#71819A]">{source.todayPolicies} policies</p></div>
          <div><p className="text-[9px] font-bold uppercase text-[#71819A]">{periodLabel}</p><p className="text-[11px] font-semibold">{money(source.mtdNetPremium)}</p><p className="text-[10px] text-[#71819A]">{source.mtdPolicies} policies</p></div>
        </div>
      </div>)}
      {!sources.length ? <p className="p-3 text-xs text-[#71819A]">No attributed sources for this period.</p> : null}
    </div>
    {sources.length > 3 ? <button type="button" onClick={() => setAll((v) => !v)} className="text-[11px] font-bold text-[#245CB0]">{all ? "Show fewer" : `View all ${sources.length} sources`}</button> : null}
  </div>;
}

function TeamMetrics({ own, reports, periodLabel }: { own: RmPerformanceRow; reports: RmPerformanceRow[]; periodLabel: string }) {
  const all = [own, ...reports];
  const policies = all.reduce((sum, row) => sum + row.mtdPolicies, 0);
  const net = all.reduce((sum, row) => sum + row.mtdNetPremium, 0);
  const todayPolicies = all.reduce((sum, row) => sum + row.todayPolicies, 0);
  const todayNet = all.reduce((sum, row) => sum + row.todayNetPremium, 0);
  return <div className="rounded-lg border border-[#DCE5F0] bg-[#F5F8FD] px-3 py-2">
    <div className="mb-2 flex items-center justify-between"><strong className="text-xs text-[#18365C]">RM Head Team Total</strong><span className="text-[10px] text-[#61738E]">Own + reporting RMs</span></div>
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div><p className="text-[10px] font-semibold text-[#62758F]">TODAY</p><strong>{money(todayNet)}</strong><p>{todayPolicies} policies</p></div>
      <div><p className="text-[10px] font-semibold uppercase text-[#62758F]">{periodLabel}</p><strong>{money(net)}</strong><p>{policies} policies</p></div>
    </div>
  </div>;
}

function HeadGroup({ head, reports, periodLabel, periodShortLabel }: { head: RmPerformanceRow; reports: RmPerformanceRow[]; periodLabel: string; periodShortLabel: string }) {
  const [open, setOpen] = useState(false);
  const [directOpen, setDirectOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  return <section className="overflow-hidden rounded-xl border border-[#D9E4F2] bg-white">
    <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 bg-[#F7FAFE] px-4 py-3 text-left">
      <div><div className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-[#244F86]"/><strong className="text-[13px] text-[#18365C]">{head.name}</strong><span className="text-[10px] font-bold text-[#71839E]">RM HEAD</span></div>
      <p className="mt-1 text-[10px] text-[#71839E]">{head.contributionPercent.toFixed(1)}% period contribution · {reports.length} reporting RMs</p></div>
      <ChevronDown className={`h-4 w-4 text-[#18365C] transition ${open ? "rotate-180" : ""}`}/>
    </button>
    <div className="px-2 pb-2"><RmSummaryCard row={head} periodLabel={periodLabel} periodShortLabel={periodShortLabel}/></div>
    {open ? <div className="space-y-2 border-t border-[#E6EDF5] p-3">
      <div className="rounded-lg border border-[#E1EAF5] p-3">
        <button type="button" className="flex w-full items-center justify-between" aria-expanded={directOpen} onClick={() => setDirectOpen((v) => !v)}>
          <span className="flex items-center gap-2 text-[12px] font-bold text-[#18365C]"><BriefcaseBusiness className="h-4 w-4"/>Direct Partners</span><ChevronDown className={`h-4 w-4 transition ${directOpen ? "rotate-180" : ""}`}/>
        </button>
        {directOpen ? <div className="mt-3"><SourceColumns sources={head.sources} periodLabel={periodLabel}/></div> : null}
      </div>
      <div className="rounded-lg border border-[#E1EAF5] p-3">
        <button type="button" className="flex w-full items-center justify-between" aria-expanded={reportsOpen} onClick={() => setReportsOpen((v) => !v)}>
          <span className="flex items-center gap-2 text-[12px] font-bold text-[#18365C]"><UsersRound className="h-4 w-4"/>Reporting RMs <span className="text-[10px] font-medium text-[#71839E]">{reports.length}</span></span><ChevronDown className={`h-4 w-4 transition ${reportsOpen ? "rotate-180" : ""}`}/>
        </button>
        {reportsOpen ? <div className="mt-3 space-y-2">{reports.map((row) => <div key={row.employeeId ?? row.name} className="rounded-xl border border-[#E8EEF6]"><RmSummaryCard row={row} periodLabel={periodLabel} periodShortLabel={periodShortLabel}/></div>)}{!reports.length ? <p className="text-xs text-[#72829A]">No reporting RMs in this period.</p> : null}</div> : null}
      </div>
      <TeamMetrics own={head} reports={reports} periodLabel={periodLabel}/>
    </div> : null}
  </section>;
}

export function RmHierarchySummary({ rows, periodLabel, periodShortLabel, selectedRmId }: Props) {
  // A selected RM retains the existing single-RM view and scope.
  if (selectedRmId) return <div className="space-y-2">{rows.map((row) => <RmSummaryCard key={row.employeeId ?? row.name} row={row} periodLabel={periodLabel} periodShortLabel={periodShortLabel}/>)}</div>;

  const jatin = rows.find((row) => normalized(row.name) === JATIN);
  const gagan = rows.find((row) => normalized(row.name) === GAGAN);
  const jayesh = rows.find((row) => normalized(row.name) === JAYESH);
  const jatinReports = jatin ? rows.filter((row) => JATIN_REPORTS.has(normalized(row.name))) : [];
  const protectedIds = new Set([JATIN, GAGAN, JAYESH, ...JATIN_REPORTS]);
  const remaining = rows.filter((row) => !protectedIds.has(normalized(row.name)));
  const grouped = new Set([...(jatin ? [JATIN] : []), ...(gagan ? [GAGAN] : []), ...(jatin ? JATIN_REPORTS : []), ...(gagan ? remaining.map((row) => normalized(row.name)) : [])]);

  return <div className="space-y-2">
    {jayesh ? <RmSummaryCard row={jayesh} periodLabel={periodLabel} periodShortLabel={periodShortLabel}/> : null}
    {jatin ? <HeadGroup head={jatin} reports={jatinReports} periodLabel={periodLabel} periodShortLabel={periodShortLabel}/> : null}
    {gagan ? <HeadGroup head={gagan} reports={remaining} periodLabel={periodLabel} periodShortLabel={periodShortLabel}/> : null}
    {rows.filter((row) => normalized(row.name) !== JAYESH && !grouped.has(normalized(row.name))).map((row) => <RmSummaryCard key={row.employeeId ?? row.name} row={row} periodLabel={periodLabel} periodShortLabel={periodShortLabel}/>)}
  </div>;
}
