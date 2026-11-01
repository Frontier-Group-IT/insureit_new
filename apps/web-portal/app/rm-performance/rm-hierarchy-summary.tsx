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
const normalized = (name: string) => name.trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
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


type Metrics = Pick<RmPerformanceRow, "todayPolicies" | "todayNetPremium" | "mtdPolicies" | "mtdNetPremium">;
function sumMetrics(rows: RmPerformanceRow[]): Metrics {
  return rows.reduce<Metrics>((total, row) => ({
    todayPolicies: total.todayPolicies + row.todayPolicies,
    todayNetPremium: total.todayNetPremium + row.todayNetPremium,
    mtdPolicies: total.mtdPolicies + row.mtdPolicies,
    mtdNetPremium: total.mtdNetPremium + row.mtdNetPremium,
  }), { todayPolicies: 0, todayNetPremium: 0, mtdPolicies: 0, mtdNetPremium: 0 });
}

function PerformanceHeading({ name, description, metrics, periodLabel, open, onToggle, icon }: {
  name: string; description?: string; metrics: Metrics; periodLabel: string; open: boolean; onToggle: () => void; icon: "head" | "direct" | "reports";
}) {
  return <button type="button" onClick={onToggle} aria-expanded={open}
    className={`w-full px-4 py-3 text-left transition-colors ${open ? icon === "head" ? "bg-[#D5E6FF]" : "bg-[#E8F2FF]" : "bg-white hover:bg-[#F7FAFE]"}`}>
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_20px] items-center gap-2 md:gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {icon === "direct" ? <BriefcaseBusiness className="h-4 w-4 shrink-0 text-[#245AA1]"/> : <UsersRound className="h-4 w-4 shrink-0 text-[#245AA1]"/>}
          <strong className="min-w-0 break-words text-[11px] text-[#173B70] md:text-[13px]">{name}</strong>
        </div>
        {description ? <p className="mt-1 text-[9px] text-[#617A9C]">{description}</p> : null}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase text-[#607797]">Today</p>
        <p className="text-[10px] font-semibold text-[#17345B] md:text-[12px]">{metrics.todayPolicies} policies</p>
        <p className="break-words text-[10px] font-bold text-[#17345B] md:text-[12px]">{money(metrics.todayNetPremium)}</p>
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase text-[#607797]">{periodLabel}</p>
        <p className="text-[10px] font-semibold text-[#17345B] md:text-[12px]">{metrics.mtdPolicies} policies</p>
        <p className="break-words text-[10px] font-bold text-[#17345B] md:text-[12px]">{money(metrics.mtdNetPremium)}</p>
      </div>
      <ChevronDown className={`h-4 w-4 text-[#245AA1] transition-transform ${open ? "rotate-180" : ""}`}/>
    </div>
  </button>;
}

function HeadGroup({ head, reports, periodLabel, periodShortLabel, open, onToggle }: {
  head: RmPerformanceRow; reports: RmPerformanceRow[]; periodLabel: string; periodShortLabel: string; open: boolean; onToggle: () => void;
}) {
  const [activeSection, setActiveSection] = useState<"direct" | "reports" | null>(null);
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const reportingMetrics = sumMetrics(reports);
  const teamMetrics = sumMetrics([head, ...reports]);
  return <section className={`overflow-hidden rounded-xl bg-white transition-colors ${open ? "border-2 border-[#3979CC]" : "border border-[#D9E4F2]"}`}>
    <PerformanceHeading name={head.name} description={`RM HEAD · ${head.contributionPercent.toFixed(1)}% contribution · ${reports.length} reporting RMs`}
      metrics={teamMetrics} periodLabel={periodLabel} icon="head" open={open} onToggle={() => { setActiveSection(null); setOpenReportId(null); onToggle(); }}/>
    {open ? <div className="space-y-2 border-t border-[#8BB6E8] bg-[#F8FBFF] p-2 md:p-3">
      <div className={`overflow-hidden rounded-lg ${activeSection === "direct" ? "border-2 border-[#8BB6E8]" : "border border-[#D9E4F2]"}`}>
        <PerformanceHeading name="Direct Partners" description="Own business" metrics={head}
          periodLabel={periodLabel} icon="direct" open={activeSection === "direct"}
          onToggle={() => setActiveSection(activeSection === "direct" ? null : "direct")}/>
        {activeSection === "direct" ? <div className="border-t border-[#8BB6E8] bg-[#F1F7FF] p-3">
          <SourceColumns sources={head.sources} periodLabel={periodLabel}/>
        </div> : null}
      </div>
      {reports.length > 0 ? <div className={`overflow-hidden rounded-lg ${activeSection === "reports" ? "border-2 border-[#8BB6E8]" : "border border-[#D9E4F2]"}`}>
        <PerformanceHeading name={`Reporting RMs (${reports.length})`} description="Reporting team total"
          metrics={reportingMetrics} periodLabel={periodLabel} icon="reports"
          open={activeSection === "reports"}
          onToggle={() => { setOpenReportId(null); setActiveSection(activeSection === "reports" ? null : "reports"); }}/>
        {activeSection === "reports" ? <div className="space-y-2 border-t border-[#D9E4F2] bg-white p-3">
          {reports.map((row) => {
            const id = row.employeeId ?? row.name;
            return <RmSummaryCard key={id} row={row} periodLabel={periodLabel} periodShortLabel={periodShortLabel}
              expanded={openReportId === id} onToggle={() => setOpenReportId(openReportId === id ? null : id)}/>;
          })}
          {!reports.length ? <p className="text-xs text-[#72829A]">No reporting RMs in this period.</p> : null}
        </div> : null}
      </div> : null}
    </div> : null}
  </section>;
}

export function RmHierarchySummary({ rows, periodLabel, periodShortLabel, selectedRmId }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  // A selected RM retains the existing single-RM view and scope.
  if (selectedRmId) return <div className="space-y-2">{rows.map((row) => <RmSummaryCard key={row.employeeId ?? row.name} row={row} periodLabel={periodLabel} periodShortLabel={periodShortLabel}/>)}</div>;

  const jatin = rows.find((row) => normalized(row.name) === JATIN);
  const gagan = rows.find((row) => normalized(row.name) === GAGAN);
  const jayesh = rows.find((row) => normalized(row.name) === JAYESH);
  const jatinReports = jatin ? rows.filter((row) => JATIN_REPORTS.has(normalized(row.name))) : [];
  const protectedIds = new Set([JATIN, GAGAN, JAYESH, ...JATIN_REPORTS]);
  const remaining = rows.filter((row) => !protectedIds.has(normalized(row.name)));
  const grouped = new Set([...(jatin ? [JATIN] : []), ...(gagan ? [GAGAN] : []), ...(jatin ? JATIN_REPORTS : []), ...(gagan ? remaining.map((row) => normalized(row.name)) : [])]);
  const toggle = (id: string) => setOpenId((current) => current === id ? null : id);

  return <div className="space-y-2">
    {jatin ? <HeadGroup head={jatin} reports={jatinReports} periodLabel={periodLabel} periodShortLabel={periodShortLabel}
      open={openId === JATIN} onToggle={() => toggle(JATIN)}/> : null}
    {gagan ? <HeadGroup head={gagan} reports={remaining} periodLabel={periodLabel} periodShortLabel={periodShortLabel}
      open={openId === GAGAN} onToggle={() => toggle(GAGAN)}/> : null}
    {jayesh ? <HeadGroup head={jayesh} reports={[]} periodLabel={periodLabel} periodShortLabel={periodShortLabel}
      open={openId === JAYESH} onToggle={() => toggle(JAYESH)}/> : null}
    {rows.filter((row) => normalized(row.name) !== JAYESH && !grouped.has(normalized(row.name))).map((row) => {
      const id = row.employeeId ?? row.name;
      return <RmSummaryCard key={id} row={row} periodLabel={periodLabel} periodShortLabel={periodShortLabel}
        expanded={openId === id} onToggle={() => toggle(id)}/>;
    })}
  </div>;
}
