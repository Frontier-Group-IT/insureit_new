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

function SourceColumns({ sources, periodLabel }: { sources: RmPerformanceRow["sources"]; periodLabel: string }) {
  const [otherOpen, setOtherOpen] = useState(false);
  const ranked = [...sources].sort((a,b)=>b.mtdNetPremium-a.mtdNetPremium||b.mtdPolicies-a.mtdPolicies||a.label.localeCompare(b.label));
  const hasOverflow = ranked.length > 4;
  const visible = ranked.slice(0,hasOverflow?3:4);
  const extra = hasOverflow?ranked.slice(3):[];
  const total = extra.reduce((value,source)=>({
    todayPolicies:value.todayPolicies+source.todayPolicies,
    todayNetPremium:value.todayNetPremium+source.todayNetPremium,
    mtdPolicies:value.mtdPolicies+source.mtdPolicies,
    mtdNetPremium:value.mtdNetPremium+source.mtdNetPremium,
  }),{todayPolicies:0,todayNetPremium:0,mtdPolicies:0,mtdNetPremium:0});
  const cell = (source:RmPerformanceRow["sources"][number]) => <div key={source.key} className="min-w-0 border-b border-r border-[#E7EDF5] bg-white px-3 py-3">
    <p className="min-h-7 text-[11px] font-bold text-[#213D60]">{source.label}</p>
    <div className="mt-1 grid grid-cols-2 gap-2">
      <div><p className="text-[9px] font-bold uppercase text-[#71819A]">Today</p><p className="text-[11px] font-semibold">{money(source.todayNetPremium)}</p><p className="text-[10px] text-[#71819A]">{source.todayPolicies} policies</p></div>
      <div><p className="text-[9px] font-bold uppercase text-[#71819A]">{periodLabel}</p><p className="text-[11px] font-semibold">{money(source.mtdNetPremium)}</p><p className="text-[10px] text-[#71819A]">{source.mtdPolicies} policies</p></div>
    </div>
  </div>;
  return <div className="space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#65758C]">Direct partner / source breakdown</p>
      <span className="text-[10px] text-[#647286]">{sources.length} sources</span>
    </div>
    <div className="grid overflow-hidden rounded-xl border border-[#DBE4F0] bg-white sm:grid-cols-2 xl:grid-cols-4">
      {visible.map(cell)}
      {hasOverflow ? <button type="button" aria-expanded={otherOpen} onClick={()=>setOtherOpen(v=>!v)} className="min-w-0 border-b border-r border-[#8BB6E8] bg-[#E8F2FF] px-3 py-3 text-left">
        <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-bold text-[#173B70]">Other ({extra.length})</p><ChevronDown className={`h-4 w-4 text-[#245AA1] transition-transform ${otherOpen?"rotate-180":""}`}/></div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div><p className="text-[9px] font-bold uppercase text-[#71819A]">Today</p><p className="text-[11px] font-semibold">{money(total.todayNetPremium)}</p><p className="text-[10px] text-[#71819A]">{total.todayPolicies} policies</p></div>
          <div><p className="text-[9px] font-bold uppercase text-[#71819A]">{periodLabel}</p><p className="text-[11px] font-semibold">{money(total.mtdNetPremium)}</p><p className="text-[10px] text-[#71819A]">{total.mtdPolicies} policies</p></div>
        </div>
      </button> : null}
      {!sources.length ? <p className="p-3 text-xs text-[#71819A]">No attributed sources for this period.</p> : null}
    </div>
    {hasOverflow && otherOpen ? <div className="overflow-hidden rounded-xl border border-[#8BB6E8]">
      <p className="border-b border-[#D9E4F2] bg-[#E8F2FF] px-3 py-2 text-[10px] font-bold uppercase text-[#245AA1]">Other Sources ({extra.length})</p>
      <div className="grid bg-white sm:grid-cols-2 xl:grid-cols-4">{extra.map(cell)}</div>
    </div> : null}
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


function HierarchyNode({ row, childrenByManager, periodLabel, periodShortLabel, depth=0, visited=new Set<string>() }: {
  row: RmPerformanceRow;
  childrenByManager: Map<string,RmPerformanceRow[]>;
  periodLabel:string; periodShortLabel:string; depth?:number; visited?:Set<string>;
}) {
  const [open,setOpen] = useState(false);
  const [section,setSection] = useState<"direct"|"reports"|null>(null);
  const id = row.employeeId ?? row.name;
  const nextVisited = new Set(visited);
  if (nextVisited.has(id)) return null;
  nextVisited.add(id);
  const reports = (childrenByManager.get(id) ?? []).filter(child=>!nextVisited.has(child.employeeId ?? child.name));
  const team = (node:RmPerformanceRow, seen:Set<string>):RmPerformanceRow[] => {
    const key=node.employeeId??node.name;
    if(seen.has(key))return [];
    const next=new Set(seen);next.add(key);
    return [node,...(childrenByManager.get(key)??[]).flatMap(child=>team(child,next))];
  };
  const totals=sumMetrics(team(row,new Set()));
  const reporting=sumMetrics(reports.flatMap(child=>team(child,new Set())));
  return <section className={`overflow-hidden rounded-xl border ${open?"border-[#3979CC]":"border-[#D9E4F2]"} bg-white`}>
    <PerformanceHeading name={row.name} description={`${row.designation??(depth?"Reporting RM":"RM Head")} · ${reports.length} direct reports`}
      metrics={totals} periodLabel={periodLabel} icon="head" open={open} onToggle={()=>{setOpen(!open);setSection(null);}}/>
    {open?<div className="space-y-2 border-t border-[#D9E4F2] bg-[#F8FBFF] p-2 md:p-3">
      <div className="overflow-hidden rounded-lg border border-[#D9E4F2]">
        <PerformanceHeading name="Direct Partners" description="Own attributed business" metrics={row}
          periodLabel={periodLabel} icon="direct" open={section==="direct"} onToggle={()=>setSection(section==="direct"?null:"direct")}/>
        {section==="direct"?<div className="border-t border-[#D9E4F2] p-3"><SourceColumns sources={row.sources} periodLabel={periodLabel}/></div>:null}
      </div>
      {reports.length?<div className="overflow-hidden rounded-lg border border-[#D9E4F2]">
        <PerformanceHeading name={`Reporting RMs (${reports.length})`} description="Reporting team total" metrics={reporting}
          periodLabel={periodLabel} icon="reports" open={section==="reports"} onToggle={()=>setSection(section==="reports"?null:"reports")}/>
        {section==="reports"?<div className="space-y-2 border-t border-[#D9E4F2] p-2">
          {reports.map(child=><HierarchyNode key={child.employeeId??child.name} row={child} childrenByManager={childrenByManager}
            periodLabel={periodLabel} periodShortLabel={periodShortLabel} depth={depth+1} visited={nextVisited}/>)}
        </div>:null}
      </div>:null}
    </div>:null}
  </section>;
}

export function RmHierarchySummary({ rows, periodLabel, periodShortLabel, selectedRmId }: Props) {
  if (selectedRmId) return <div className="space-y-2">{rows.map(row=><RmSummaryCard key={row.employeeId??row.name} row={row}
    periodLabel={periodLabel} periodShortLabel={periodShortLabel}/>)}</div>;
  const childrenByManager = new Map<string,RmPerformanceRow[]>();
  const ids=new Set(rows.filter(row=>row.employeeId).map(row=>row.employeeId));
  for(const row of rows){
    if(!row.managerId || !ids.has(row.managerId) || row.managerId===row.employeeId)continue;
    childrenByManager.set(row.managerId,[...(childrenByManager.get(row.managerId)??[]),row]);
  }
  const roots=rows.filter(row=>!row.managerId || !ids.has(row.managerId) || row.managerId===row.employeeId);
  return <div className="space-y-2">
    {roots.map(row=><HierarchyNode key={row.employeeId??row.name} row={row} childrenByManager={childrenByManager}
      periodLabel={periodLabel} periodShortLabel={periodShortLabel}/>)}
  </div>;
}
