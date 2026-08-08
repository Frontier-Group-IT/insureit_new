"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchFilterBar, StatusBadge } from "@/components/ui";
import { claimPath } from "@/lib/portal-routes";

export type HistoryRow = {
  id: string;
  to_status: string;
  from_status: string | null;
  notes: string | null;
  created_at: string;
  claims: { id: string; claim_no: string } | null;
  actor: { full_name: string } | null;
};

export function TimelineWorkspace({ rows, initialSearch, initialStatus, loadError }: { rows: HistoryRow[]; initialSearch: string; initialStatus: string; loadError: string | null }) {
  const [query, setQuery] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const normalized = query.trim().toLowerCase();
  const filterOptions = useMemo(() => Array.from(new Set(rows.map((item) => item.to_status))).sort().map((value) => ({ value, label: value })), [rows]);
  const visibleRows = useMemo(() => rows.filter((item) => {
    const haystack = [item.claims?.claim_no, item.from_status, item.to_status, item.actor?.full_name, item.notes].filter(Boolean).join(" ").toLowerCase();
    return (!status || item.to_status === status) && (!normalized || haystack.includes(normalized));
  }), [normalized, rows, status]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    const nextUrl = `/timeline${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [query, status]);

  return <>
    <SearchFilterBar searchPlaceholder="Search by claim no., status, actor, or notes" filterLabel="Result status" filterOptions={filterOptions} defaultSearch={query} defaultFilter={status || "all"} onSearchChange={setQuery} onFilterChange={(value) => setStatus(value === "all" ? "" : value)} />
    {loadError ? <ClientDataError message={loadError} /> : visibleRows.length ? <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white/72"><table className="w-full min-w-[900px] text-left text-[11.5px]"><thead className="border-b border-[#E7E8F3] bg-[#F7F8FF]/95 uppercase tracking-[0.08em] text-[#77809A]"><tr><th className="px-4 py-3 text-[9px]">Claim</th><th className="px-4 py-3 text-[9px]">From</th><th className="px-4 py-3 text-[9px]">To</th><th className="px-4 py-3 text-[9px]">Actor</th><th className="px-4 py-3 text-[9px]">Recorded</th><th className="px-4 py-3 text-[9px]">Notes</th></tr></thead><tbody className="divide-y divide-[#EEF0F6] bg-white/75">{visibleRows.map((item) => <tr key={item.id} className="hover:bg-[#F6F4FF]"><td className="px-4 py-3.5">{item.claims ? <Link className="font-semibold text-navy-700" href={claimPath(item.claims.id)}>{item.claims.claim_no}</Link> : "-"}</td><td className="px-4 py-3.5">{item.from_status ? <StatusBadge status={item.from_status} /> : "-"}</td><td className="px-4 py-3.5"><StatusBadge status={item.to_status} /></td><td className="px-4 py-3.5">{item.actor?.full_name ?? "-"}</td><td className="px-4 py-3.5">{formatPortalDateTime(item.created_at)}</td><td className="px-4 py-3.5">{item.notes ?? "-"}</td></tr>)}</tbody></table></div> : <Empty title="No matching status updates" description="No timeline entries match the selected search and status." />}
  </>;
}

function formatPortalDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
function ClientDataError({ message }: { message: string }) { return <div className="rounded-2xl border border-red-100 bg-red-50/75 px-4 py-4 text-red-700"><p className="text-[13px] font-semibold">Unable to load records</p><p className="mt-1 text-[12px]">{message}</p></div>; }
function Empty({ title, description }: { title: string; description: string }) { return <div className="rounded-2xl border border-dashed border-[#CFCBFF] bg-white p-8 text-center"><p className="text-[13px] font-semibold text-[#303550]">{title}</p><p className="mt-1 text-[10.5px] text-[#737B92]">{description}</p></div>; }
