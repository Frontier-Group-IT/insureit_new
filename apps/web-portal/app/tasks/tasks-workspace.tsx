"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchFilterBar, StatusBadge } from "@/components/ui";

export type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  claims: { claim_no: string } | null;
  assignee: { full_name: string } | null;
};

export function TasksWorkspace({ rows, initialSearch, initialStatus, loadError }: { rows: TaskRow[]; initialSearch: string; initialStatus: string; loadError: string | null }) {
  const [query, setQuery] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const normalized = query.trim().toLowerCase();
  const filterOptions = useMemo(() => Array.from(new Set(rows.map((task) => task.status))).sort().map((value) => ({ value, label: value.replaceAll("_", " ") })), [rows]);
  const visibleRows = useMemo(() => rows.filter((task) => {
    const haystack = [task.title, task.claims?.claim_no, task.assignee?.full_name, task.due_date, task.status].filter(Boolean).join(" ").toLowerCase();
    return (!status || task.status === status) && (!normalized || haystack.includes(normalized));
  }), [normalized, rows, status]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    const nextUrl = `/tasks${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [query, status]);

  return <>
    <SearchFilterBar searchPlaceholder="Search by task, claim no., assignee, or due date" filterLabel="Task status" filterOptions={filterOptions} defaultSearch={query} defaultFilter={status || "all"} onSearchChange={setQuery} onFilterChange={(value) => setStatus(value === "all" ? "" : value)} />
    {loadError ? <ClientDataError message={loadError} /> : visibleRows.length ? <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white/72"><table className="w-full min-w-[760px] text-left text-[11.5px]"><thead className="border-b border-[#E7E8F3] bg-[#F7F8FF]/95 uppercase tracking-[0.08em] text-[#77809A]"><tr><th className="px-4 py-3 text-[9px]">Task</th><th className="px-4 py-3 text-[9px]">Assignee</th><th className="px-4 py-3 text-[9px]">Due date</th><th className="px-4 py-3 text-[9px]">Status</th></tr></thead><tbody className="divide-y divide-[#EEF0F6] bg-white/75">{visibleRows.map((task) => <tr key={task.id} className="hover:bg-[#F6F4FF]"><td className="px-4 py-3.5"><p className="font-semibold text-navy-900">{task.title}</p><p className="text-xs text-slate-500">{task.claims?.claim_no ?? "No claim"}</p></td><td className="px-4 py-3.5">{task.assignee?.full_name ?? "Unassigned"}</td><td className="px-4 py-3.5">{task.due_date ?? "-"}</td><td className="px-4 py-3.5"><StatusBadge status={task.status} /></td></tr>)}</tbody></table></div> : <Empty title="No matching tasks" description="No tasks match the selected search and status." />}
  </>;
}

function ClientDataError({ message }: { message: string }) { return <div className="rounded-2xl border border-red-100 bg-red-50/75 px-4 py-4 text-red-700"><p className="text-[13px] font-semibold">Unable to load records</p><p className="mt-1 text-[12px]">{message}</p></div>; }
function Empty({ title, description }: { title: string; description: string }) { return <div className="rounded-2xl border border-dashed border-[#CFCBFF] bg-white p-8 text-center"><p className="text-[13px] font-semibold text-[#303550]">{title}</p><p className="mt-1 text-[10.5px] text-[#737B92]">{description}</p></div>; }
