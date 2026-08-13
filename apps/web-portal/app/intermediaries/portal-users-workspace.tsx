"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PortalUserRow } from "./portal-users/page";

type StatusFilter = "all" | "active" | "inactive";

const PORTAL_USERS_PAGE_SIZE = 10;

export function IntermediaryPortalUsersWorkspace({ rows, initialQuery, initialStatus, loadError }: { rows: PortalUserRow[]; initialQuery: string; initialStatus: StatusFilter; loadError: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [currentPage, setCurrentPage] = useState(1);
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
  const activeCount = searchedRows.filter((row) => isActive(row)).length;
  const inactiveCount = searchedRows.filter((row) => !isActive(row)).length;
  const visibleRows = searchedRows.filter((row) => {
    if (statusFilter === "all") return true;
    return statusFilter === "active" ? isActive(row) : !isActive(row);
  });
  const totalRecords = visibleRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PORTAL_USERS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safePage - 1) * PORTAL_USERS_PAGE_SIZE;
  const pageRows = visibleRows.slice(pageStartIndex, pageStartIndex + PORTAL_USERS_PAGE_SIZE);
  const showingStart = totalRecords === 0 ? 0 : pageStartIndex + 1;
  const showingEnd = totalRecords === 0 ? 0 : Math.min(pageStartIndex + PORTAL_USERS_PAGE_SIZE, totalRecords);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    const nextUrl = `/intermediaries/portal-users${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [query, statusFilter]);

  function selectStatus(next: StatusFilter) {
    setStatusFilter(next);
    setCurrentPage(1);
  }

  return <div className="mx-auto max-w-[1480px] pb-8">
    <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-[#F8FAFC] px-4 py-3 lg:flex-row lg:items-center">
        <div className="shrink-0"><h2 className="text-[12px] font-semibold text-[#0F172A]">Partner Portal Users</h2><p className="mt-0.5 text-[9px] text-[#64748B]">Review partner login invitations and current portal access.</p></div>
        <form onSubmit={(event) => event.preventDefault()} className="w-full lg:max-w-[460px]">
          <input value={query} onChange={(event) => { setQuery(event.target.value); setCurrentPage(1); }} aria-label="Search intermediary user accounts" placeholder="Search partner name, email or ID" className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-[11.5px] outline-none transition focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#DBEAFE]" />
        </form>
        <div className="flex-1" />
        <nav className="flex w-fit shrink-0 items-center rounded-xl border border-[#DCE5EF] bg-white p-1" aria-label="Filter intermediary user accounts">
          {([
            ["all", "All", searchedRows.length],
            ["active", "Active", activeCount],
            ["inactive", "Needs attention", inactiveCount],
          ] as const).map(([value, label, count]) => {
            const selected = statusFilter === value;
            return <button key={value} type="button" onClick={() => selectStatus(value)} aria-current={selected ? "page" : undefined} className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition ${selected ? "bg-[#E7E7E7] text-[#17203A]" : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"}`}>{label} <span className="ml-1 opacity-80">{count}</span></button>;
          })}
        </nav>
      </div>
      {loadError ? <div className="px-4 py-12 text-center"><p className="text-[11px] font-semibold text-red-700">Partner portal users are temporarily unavailable.</p><p className="mt-1 text-[9.5px] text-[#64748B]">Please refresh the page or try again shortly.</p></div> : pageRows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[10.5px]">
            <thead className="border-b text-[8.5px] uppercase text-[#64748B]"><tr><th className="px-4 py-3">Partner</th><th className="px-3 py-3">Account</th><th className="px-3 py-3">Portal status</th><th className="px-3 py-3">Invitation sent</th><th className="px-3 py-3">Application</th></tr></thead>
            <tbody className="divide-y">{pageRows.map((row) => {
              const { intermediary, account } = row;
              return <tr key={intermediary.id} className="hover:bg-[#FAFCFF]"><td className="px-4 py-3"><p className="font-semibold text-[#0F2A55]">{intermediary.display_name}</p><p className="mt-0.5 text-[8.5px] text-[#64748B]">{intermediary.intermediary_code ?? "Partner ID pending"}</p></td><td className="px-3 py-3"><p className="text-[#334155]">{account?.email ?? intermediary.email ?? "Email not recorded"}</p></td><td className="px-3 py-3"><Status value={resolvedStatus(row)} /></td><td className="px-3 py-3 text-[#475569]">{formatDateTime(account?.invited_at)}</td><td className="px-3 py-3">{intermediary.application_id ? <Link href={`/intermediaries/applications/${intermediary.application_id}`} className="font-semibold text-[#4F46E5] hover:underline">Open account</Link> : <span className="text-[#94A3B8]">Unavailable</span>}</td></tr>;
            })}</tbody>
          </table>
        </div>
      ) : <div className="px-4 py-16 text-center"><p className="text-[11px] font-semibold text-[#334155]">No partner portal users match the current filters.</p><p className="mt-1 text-[9.5px] text-[#64748B]">Change the search or status filter to view other accounts.</p></div>}
      {!loadError ? (
        <div className="flex flex-col gap-3 border-t border-[#E7ECF3] bg-white px-4 py-3.5 text-[10px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {showingStart}–{showingEnd} of {totalRecords}</span>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={safePage <= 1}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-[#DCE5EF] bg-white px-3 font-medium text-[#526178] transition-colors enabled:hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#B6C0CF]"
            >
              Previous
            </button>
            <span className="min-w-[42px] text-center font-medium text-[#526178]">{safePage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-[#DCE5EF] bg-white px-3 font-medium text-[#526178] transition-colors enabled:hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#B6C0CF]"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </section>
  </div>;
}

function resolvedStatus({ intermediary, account }: PortalUserRow) {
  return account ? intermediary.portal_access_status || account.status : "not_created";
}

function isActive(row: PortalUserRow) {
  return resolvedStatus(row) === "active";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not sent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date);
}

function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const label = normalized === "not_created" ? "Not created" : normalized === "invited" ? "Invitation sent" : normalized.replaceAll("_", " ");
  const style = normalized === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : normalized === "invited"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : normalized === "disabled" || normalized === "suspended"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[8.5px] font-semibold capitalize ${style}`}>{label}</span>;
}
