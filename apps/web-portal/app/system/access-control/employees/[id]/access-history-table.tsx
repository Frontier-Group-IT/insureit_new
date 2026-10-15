"use client";

import { useMemo, useState } from "react";

export type AccessHistoryEvent = { id: string; type: "permission" | "lifecycle"; title: string; detail: string; created_at: string };

export function AccessHistoryTable({ events }: { events: AccessHistoryEvent[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "permission" | "lifecycle">("all");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter(event => (type === "all" || event.type === type) &&
      (!needle || [event.title, event.detail, event.type, formatDate(event.created_at)].some(value => value.toLowerCase().includes(needle))));
  }, [events, query, type]);

  return <section aria-label="Access history" className="overflow-hidden rounded-xl border border-[#DFE7F2] bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
      <div><h2 className="text-[15px] font-bold text-[#17203A]">Access history</h2>
        <p className="mt-1 text-[10px] text-[#64748B]">Permission changes and portal lifecycle events, newest first.</p></div>
      <span className="rounded-lg bg-[#EEF3FA] px-3 py-1.5 text-[10px] font-semibold text-[#17365D]">{events.length} events</span>
    </div>
    <div className="flex flex-wrap gap-2 border-b border-[#E2E8F0] p-3">
      <label className="min-w-[220px] flex-1"><span className="sr-only">Search access history</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search history, actions or reasons..." className="h-9 w-full rounded-lg border border-[#D6E1EF] bg-white px-3 text-[11px] text-[#17365D] outline-none focus:border-[#3879C5]"/>
      </label>
      <label><span className="sr-only">Filter event type</span><select value={type} onChange={event => setType(event.target.value as "all" | "permission" | "lifecycle")} className="h-9 rounded-lg border border-[#D6E1EF] bg-white px-3 text-[11px] text-[#17365D]">
        <option value="all">All Events</option><option value="permission">Permissions</option><option value="lifecycle">Lifecycle</option>
      </select></label>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[840px] text-left">
      <thead className="bg-[#F8FAFD] text-[10px] font-bold uppercase tracking-wide text-[#64748B]"><tr>
        <th scope="col" className="w-[13%] border-b border-[#E2E8F0] px-3 py-3">Type</th>
        <th scope="col" className="w-[30%] border-b border-[#E2E8F0] px-3 py-3">Activity</th>
        <th scope="col" className="border-b border-[#E2E8F0] px-3 py-3">Details / Reason</th>
        <th scope="col" className="w-[20%] border-b border-[#E2E8F0] px-3 py-3 text-right">Date & Time</th>
      </tr></thead>
      <tbody className="divide-y divide-[#E9EEF5]">
        {visible.length ? visible.map(event => <tr key={`${event.type}-${event.id}`} className="align-top transition hover:bg-[#F7FAFE]">
          <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-bold uppercase ${event.type === "permission" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"}`}>{event.type}</span></td>
          <td className="px-3 py-3 text-[11px] font-semibold text-[#24345A]">{event.title}</td>
          <td className="break-words px-3 py-3 text-[10px] leading-relaxed text-[#64748B]">{event.detail}</td>
          <td className="whitespace-nowrap px-3 py-3 text-right text-[10px] text-[#64748B]">{formatDate(event.created_at)}</td>
        </tr>) : <tr><td colSpan={4} className="px-4 py-8 text-center text-[11px] text-[#64748B]">{events.length ? "No matching history records." : "No access events recorded."}</td></tr>}
      </tbody>
    </table></div>
    <p className="border-t border-[#E9EEF5] px-4 py-2 text-[10px] text-[#71839C]">Showing {visible.length} of {events.length} loaded events</p>
  </section>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
