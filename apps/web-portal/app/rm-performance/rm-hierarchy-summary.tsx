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

function PerformanceHeading({ name, description, metrics, periodLabel, open, onToggle, icon, highlighted=false }: {
  name: string; description?: string; metrics: Metrics; periodLabel: string; open: boolean; onToggle: () => void; icon: "head" | "direct" | "reports"; highlighted?:boolean;
}) {
  return <button type="button" onClick={onToggle} aria-expanded={open}
    className={`w-full px-4 py-3 text-left transition-colors ${open || highlighted ? "bg-[#D5E6FF]" : "bg-white hover:bg-[#F7FAFE]"}`}>
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


function HierarchyNode({ row, childrenByManager, periodLabel, periodShortLabel, depth=0, visited=new Set<string>(), open, onToggle }: {
  row: RmPerformanceRow;
  childrenByManager: Map<string,RmPerformanceRow[]>;
  periodLabel:string; periodShortLabel:string; depth?:number; visited?:Set<string>; open:boolean; onToggle:()=>void;
}) {
  const [openChildId,setOpenChildId] = useState<string|null>(null);
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
  return <section className={`overflow-hidden rounded-xl border bg-white transition-colors ${open ? depth === 0 ? "border-2 border-[#3979CC]" : "border-2 border-[#8BB6E8]" : "border-[#D9E4F2]"}`}>
    <PerformanceHeading name={row.name} description={`${row.designation??(depth?"Reporting RM":"RM Head")} · ${reports.length} direct reports`}
      metrics={totals} periodLabel={periodLabel} icon="head" open={open} onToggle={()=>{setSection(null);setOpenChildId(null);onToggle();}}/>
    {open?<div className="relative space-y-2 border-t border-[#A9C7EB] bg-[#F8FBFF] py-3 pl-5 pr-2 before:pointer-events-none before:absolute before:bottom-3 before:left-2 before:top-3 before:border-l-2 before:border-dashed before:border-[#82ADE0] md:pl-6 md:pr-3">
      <div className={`relative overflow-visible rounded-lg border ${section==="direct"?"border-[#8BB6E8]":"border-[#D9E4F2]"} before:pointer-events-none before:absolute before:-left-3 before:top-6 before:w-3 before:border-t-2 before:border-dashed before:border-[#82ADE0] md:before:-left-4 md:before:w-4`}>
        <div className="overflow-hidden rounded-lg"><PerformanceHeading name="Direct Partners" description="Own attributed business" metrics={row}
          periodLabel={periodLabel} icon="direct" highlighted={open} open={section==="direct"} onToggle={()=>setSection(section==="direct"?null:"direct")}/>
        {section==="direct"?<div className="border-t border-[#A9C7EB] bg-[#F1F7FF] p-3"><SourceColumns sources={row.sources} periodLabel={periodLabel}/></div>:null}</div>
      </div>
      {reports.length?<div className={`relative rounded-lg border ${section==="reports"?"border-[#8BB6E8]":"border-[#D9E4F2]"} before:pointer-events-none before:absolute before:-left-3 before:top-6 before:w-3 before:border-t-2 before:border-dashed before:border-[#82ADE0] md:before:-left-4 md:before:w-4`}>
        <PerformanceHeading name={`Reporting RMs (${reports.length})`} description="Reporting team total" metrics={reporting}
          periodLabel={periodLabel} icon="reports" highlighted={open} open={section==="reports"} onToggle={()=>setSection(section==="reports"?null:"reports")}/>
        {section==="reports"?<div className="relative space-y-2 border-t border-[#A9C7EB] bg-[#F1F7FF] py-3 pl-5 pr-2 before:pointer-events-none before:absolute before:bottom-3 before:left-2 before:top-3 before:border-l-2 before:border-dashed before:border-[#A7C7EB] md:pl-6 md:pr-3">
          {reports.map(child=><div key={child.employeeId??child.name} className="relative before:pointer-events-none before:absolute before:-left-3 before:top-6 before:w-3 before:border-t-2 before:border-dashed before:border-[#A7C7EB] md:before:-left-4 md:before:w-4"><HierarchyNode row={child} childrenByManager={childrenByManager}
            periodLabel={periodLabel} periodShortLabel={periodShortLabel} depth={depth+1} visited={nextVisited}
            open={openChildId===(child.employeeId??child.name)} onToggle={()=>setOpenChildId(current=>current===(child.employeeId??child.name)?null:(child.employeeId??child.name))}/></div>)}
        </div>:null}
      </div>:null}
    </div>:null}
  </section>;
}

export function RmHierarchySummary({ rows, periodLabel, periodShortLabel, selectedRmId }: Props) {
  const [openRootId,setOpenRootId]=useState<string|null>(null);
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
      periodLabel={periodLabel} periodShortLabel={periodShortLabel}
      open={openRootId===(row.employeeId??row.name)} onToggle={()=>setOpenRootId(current=>current===(row.employeeId??row.name)?null:(row.employeeId??row.name))}/>)}
  </div>;
}
