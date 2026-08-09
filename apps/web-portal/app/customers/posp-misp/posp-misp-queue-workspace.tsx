"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type QueueRow = { id:string; partner_type:"posp"|"misp"; source:string; status:string; applicant_phone:string|null; applicant_name:string|null; city:string|null; external_onboarding_id:string|null; document_count:number; age_days:number; updated_at:string; total_count:number; missing_required_count?:number };
type TypeFilter = "posp"|"misp"|null;
const PAGE_SIZE = 20;

export function PospMispQueueWorkspace({ rows, canReview, initialQuery, initialType }: { rows: QueueRow[]; canReview: boolean; initialQuery: string; initialType: TypeFilter }) {
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<TypeFilter>(initialType);
  const [page, setPage] = useState(1);
  const normalized = query.trim().toLowerCase();
  const searchedRows = useMemo(() => rows.filter((row) => {
    if (!normalized) return true;
    return [row.applicant_name, row.applicant_phone, row.city, row.external_onboarding_id, row.status, row.source, row.partner_type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalized);
  }), [normalized, rows]);
  const typeCounts = useMemo(() => ({
    all: searchedRows.length,
    posp: searchedRows.filter((row) => row.partner_type === "posp").length,
    misp: searchedRows.filter((row) => row.partner_type === "misp").length,
  }), [searchedRows]);
  const filteredRows = type ? searchedRows.filter((row) => row.partner_type === type) : searchedRows;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (type) params.set("type", type);
    const nextUrl = `/customers/posp-misp${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [query, type]);

  return <>
    <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="shrink-0"><h2 className="text-[12px] font-semibold text-[#0F172A]">Pending Applications</h2></div>
          <form onSubmit={(event) => event.preventDefault()} className="w-full sm:max-w-[460px]">
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} aria-label="Search intermediary applications" placeholder="Search name, mobile or onboarding ID" className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-[11.5px] outline-none transition focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#DBEAFE]"/>
          </form>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-white p-1 shadow-[0_6px_18px_rgba(15,23,42,0.05)] ring-1 ring-[#E2E8F0]">
          <TypeTab label="All" count={typeCounts.all} active={!type} onClick={() => { setType(null); setPage(1); }}/>
          <TypeTab label="POSP" count={typeCounts.posp} active={type==="posp"} onClick={() => { setType("posp"); setPage(1); }}/>
          <TypeTab label="MISP" count={typeCounts.misp} active={type==="misp"} onClick={() => { setType("misp"); setPage(1); }}/>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-[11px]"><thead className="border-b border-[#E2E8F0] bg-white text-[9px] uppercase tracking-[0.06em] text-[#64748B]"><tr><th className="px-4 py-3">Application file</th><th className="px-3 py-3">Requested type</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Location</th><th className="px-3 py-3">Documents</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Pending age</th><th className="px-3 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#EEF2F6]">{pageRows.map(row=><tr key={row.id} className={row.age_days>=7?"bg-red-50/40 hover:bg-red-50/70":"hover:bg-[#FAFCFF]"}><td className="px-4 py-3"><p className="font-semibold text-[#0F172A]">{row.applicant_name??"Name pending verification"}</p><p className="mt-0.5 text-[9.5px] text-[#64748B]">{row.external_onboarding_id??`Ref ${row.id.slice(0,8).toUpperCase()}`}</p></td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.partner_type==='misp'?"bg-[#FFF7D6] text-[#8A6500]":"bg-[#E8F0FF] text-[#174EA6]"}`}>{row.partner_type.toUpperCase()}</span></td><td className="px-3 py-3 tabular-nums">{row.applicant_phone??"-"}</td><td className="px-3 py-3">{row.city??"-"}</td><td className="px-3 py-3"><p className="font-semibold text-amber-700">{row.missing_required_count??0} required pending</p><p className="mt-0.5 text-[9px] text-[#64748B]">{row.document_count} uploaded</p></td><td className="px-3 py-3">{row.source==='manager_portal'?"Manager portal":"Excel import"}</td><td className="px-3 py-3"><AgeBadge days={row.age_days}/></td><td className="px-3 py-3"><StatusPill status={row.status}/></td><td className="px-4 py-3 text-right"><Link href={`/intermediaries/applications/${row.id}`} prefetch={false} className="inline-flex rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-1.5 text-[9.5px] font-semibold text-[#4338CA]">{canReview?"Review file":"Open file"}</Link></td></tr>)}</tbody></table>{!pageRows.length?<div className="px-4 py-16 text-center"><p className="text-[12px] font-semibold text-[#334155]">No pending applications found</p></div>:null}</div>
    </div>
    {totalPages>1?<div className="mt-4 flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-white px-3 py-2"><button type="button" disabled={safePage<=1} onClick={() => setPage((current) => Math.max(1,current-1))} className={`rounded-md border px-3 py-1.5 text-[10.5px] font-semibold ${safePage<=1?"text-[#94A3B8]":"text-[#334155]"}`}>Previous</button><span className="text-[10.5px] font-semibold text-[#475569]">Page {safePage} of {totalPages}</span><button type="button" disabled={safePage>=totalPages} onClick={() => setPage((current) => Math.min(totalPages,current+1))} className={`rounded-md border px-3 py-1.5 text-[10.5px] font-semibold ${safePage>=totalPages?"text-[#94A3B8]":"text-[#334155]"}`}>Next</button></div>:null}
  </>;
}

function TypeTab({label,count,active,onClick}:{label:string;count:number;active:boolean;onClick:()=>void}){
 return <button type="button" onClick={onClick} aria-current={active?"page":undefined} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${active?"bg-gradient-to-r from-[#6757F6] to-[#4F8DF7] text-white shadow-[0_6px_14px_rgba(99,87,246,0.22)]":"text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F2A55]"}`}><span>{label}</span><span className={active?"text-white/85":"text-[#64748B]"}>{count}</span></button>;
}
function StatusPill({status}:{status:string}){const attention=status==='changes_requested';const className=attention?"border-red-200 bg-red-50 text-red-700":status==='under_review'?"border-blue-200 bg-blue-50 text-blue-700":"border-amber-200 bg-amber-50 text-amber-700";return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold capitalize ${className}`}>{status.replaceAll('_',' ')}</span>}
function AgeBadge({days}:{days:number}){const className=days>=7?"bg-red-100 text-red-700":days>=3?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-600";return <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${className}`}>{days===0?"Today":`${days} days`}</span>}
