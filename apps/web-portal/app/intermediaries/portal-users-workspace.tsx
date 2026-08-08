"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PortalUserRow } from "./portal-users/page";

type StatusFilter = "all" | "active" | "inactive";

export function IntermediaryPortalUsersWorkspace({ rows, initialQuery, initialStatus, loadError }: { rows: PortalUserRow[]; initialQuery: string; initialStatus: StatusFilter; loadError: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const normalizedQuery = query.trim().toLowerCase();
  const searchedRows = useMemo(() => rows.filter(({ intermediary, account }) => {
    if (!normalizedQuery) return true;
    return [
      intermediary.display_name,
      intermediary.email,
      account?.email,
      intermediary.intermediary_type,
      intermediary.intermediary_code,
      intermediary.application_id,
    ].some((value) => value?.toLowerCase().includes(normalizedQuery));
  }), [normalizedQuery, rows]);
  const activeCount = searchedRows.filter((row) => Boolean(row.account) && resolvedStatus(row) === "active").length;
  const inactiveCount = searchedRows.filter((row) => !row.account).length;
  const visibleRows = searchedRows.filter((row) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "inactive") return !row.account;
    return Boolean(row.account) && resolvedStatus(row) === "active";
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    const nextUrl = `/intermediaries/portal-users${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [query, statusFilter]);

  return <div className="mx-auto max-w-[1480px] pb-8">
    <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-[#F8FAFC] px-4 py-3 lg:flex-row lg:items-center">
        <h2 className="shrink-0 text-[12px] font-semibold text-[#0F172A]">Intermediatory User Accounts</h2>
        <form onSubmit={(event) => event.preventDefault()} className="w-full lg:max-w-[460px]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search intermediary user accounts" placeholder="Search name, email, type or application" className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-[11.5px] outline-none transition focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#DBEAFE]" />
        </form>
        <div className="flex-1" />
        <nav className="flex w-fit shrink-0 items-center rounded-xl border border-[#DCE5EF] bg-white p-1" aria-label="Filter intermediary user accounts">
          {([
            ["all", "All", searchedRows.length],
            ["active", "Active", activeCount],
            ["inactive", "Inactive", inactiveCount],
          ] as const).map(([value, label, count]) => {
            const selected = statusFilter === value;
            return <button key={value} type="button" onClick={() => setStatusFilter(value)} aria-current={selected ? "page" : undefined} className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition ${selected ? "bg-[#4F46E5] text-white shadow-sm" : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"}`}>{label} <span className="ml-1 opacity-80">{count}</span></button>;
          })}
        </nav>
      </div>
      {loadError ? <div className="px-4 py-12 text-center text-[11px] text-red-700">Intermediary user accounts could not be loaded.</div> : visibleRows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[10.5px]">
            <thead className="border-b text-[8.5px] uppercase text-[#64748B]"><tr><th className="px-4 py-3">User</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Portal Status</th><th className="px-3 py-3">Invitation</th><th className="px-3 py-3">Application</th></tr></thead>
            <tbody className="divide-y">{visibleRows.map((row) => {
              const { intermediary, account } = row;
              return <tr key={intermediary.id} className="hover:bg-[#FAFCFF]"><td className="px-4 py-3"><p className="font-semibold text-[#0F2A55]">{intermediary.display_name}</p><p className="mt-0.5 text-[8.5px] text-[#64748B]">{account?.email ?? intermediary.email ?? "-"}</p></td><td className="px-3 py-3 capitalize">{intermediary.intermediary_type}</td><td className="px-3 py-3"><Status value={resolvedStatus(row)} /></td><td className="px-3 py-3">{account?.invited_at ? new Date(account.invited_at).toLocaleString("en-IN") : "-"}</td><td className="px-3 py-3">{intermediary.application_id ? <Link href={`/intermediaries/applications/${intermediary.application_id}`} className="font-semibold text-[#4F46E5] hover:underline">Open</Link> : "-"}</td></tr>;
            })}</tbody>
          </table>
        </div>
      ) : <div className="px-4 py-16 text-center text-[11px] text-[#64748B]">No intermediary user accounts match the current filters.</div>}
    </section>
  </div>;
}

function resolvedStatus({ intermediary, account }: PortalUserRow) {
  return account ? intermediary.portal_access_status || account.status : "not_created";
}

function Status({ value }: { value: string }) {
  const label = value === "not_created" ? "Not created" : value.replaceAll("_", " ");
  return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[8.5px] font-semibold capitalize text-slate-700">{label}</span>;
}
