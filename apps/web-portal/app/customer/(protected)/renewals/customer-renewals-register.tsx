"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, Clock3, FileText, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Truck, X } from "lucide-react";

export type RenewalRegisterItem = {
  id: string; title: string; key: string; vehicleId: string; vehicleNo: string;
  reference: string; expiry: string; daysUntil: number; status: string;
};
export type RenewalCategory = { key: string; title: string; count: number };

const urgency = (item: RenewalRegisterItem) => item.daysUntil < 0 ? "expired" : item.daysUntil <= 30 ? "urgent" : "upcoming";
const urgencyLabel = (item: RenewalRegisterItem) => item.daysUntil < 0 ? "Expired" : item.daysUntil <= 30 ? "Due soon" : "Upcoming";
const urgencyStyle = (item: RenewalRegisterItem) => item.daysUntil < 0
  ? "bg-rose-50 text-rose-700 ring-rose-200"
  : item.daysUntil <= 30 ? "bg-amber-50 text-amber-800 ring-amber-200"
  : "bg-blue-50 text-blue-700 ring-blue-200";

export function CustomerRenewalsRegister({ accountId, items, categories }: {
  accountId: string; items: RenewalRegisterItem[]; categories: RenewalCategory[];
}) {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedUrgency, setSelectedUrgency] = useState("all");
  const counts = useMemo(() => ({
    overdue: items.filter(item => item.daysUntil < 0).length,
    dueSoon: items.filter(item => item.daysUntil >= 0 && item.daysUntil <= 30).length,
    upcoming: items.filter(item => item.daysUntil > 30).length,
  }), [items]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter(item =>
      (selectedType === "all" || item.key === selectedType) &&
      (selectedUrgency === "all" || urgency(item) === selectedUrgency) &&
      (!term || [item.title, item.vehicleNo, item.reference, item.status, item.expiry].some(value => value.toLowerCase().includes(term)))
    ).sort((a, b) => a.daysUntil - b.daysUntil);
  }, [items, query, selectedType, selectedUrgency]);
  const clearFilters = () => { setQuery(""); setSelectedType("all"); setSelectedUrgency("all"); };
  const filtered = query !== "" || selectedType !== "all" || selectedUrgency !== "all";
  const vehicleHref = (item: RenewalRegisterItem) => ({ pathname: `/customer/vehicles/${item.vehicleId}`, query: { account: accountId } });

  return <section className="space-y-4 pb-8">
    <header className="overflow-hidden rounded-2xl border border-[#DCE5F1] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9EEF6] bg-gradient-to-r from-[#F4F8FF] to-white px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#17345B] text-white shadow-sm"><RefreshCw className="h-5 w-5" /></span>
          <div><h1 className="text-lg font-bold tracking-tight text-[#142746]">Renewal Centre</h1><p className="mt-0.5 text-xs text-[#6A7B93]">Keep your vehicle documents and policies up to date</p></div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE5F1] bg-white px-3 py-1.5 text-xs font-semibold text-[#526680]"><ShieldCheck className="h-3.5 w-3.5" /> {items.length} renewal items</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 sm:gap-3 sm:p-4">
        {[
          { id: "all", label: "All renewals", count: items.length, icon: FileText, tone: "text-[#17345B] bg-[#EAF1FB]" },
          { id: "expired", label: "Overdue", count: counts.overdue, icon: AlertCircle, tone: "text-rose-700 bg-rose-50" },
          { id: "urgent", label: "Due in 30 days", count: counts.dueSoon, icon: Clock3, tone: "text-amber-700 bg-amber-50" },
          { id: "upcoming", label: "Upcoming", count: counts.upcoming, icon: CheckCircle2, tone: "text-blue-700 bg-blue-50" },
        ].map(stat => <button key={stat.id} type="button" onClick={() => setSelectedUrgency(stat.id)} aria-pressed={selectedUrgency === stat.id}
          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition hover:border-[#A9BDD8] hover:shadow-sm ${selectedUrgency === stat.id ? "border-[#2E64AC] bg-[#F4F8FF] ring-1 ring-[#2E64AC]" : "border-[#E4EAF2] bg-white"}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.tone}`}><stat.icon className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0"><span className="block text-[10px] font-semibold text-[#718199]">{stat.label}</span><span className="mt-0.5 block text-xl font-bold leading-none text-[#142746]">{stat.count}</span></span>
        </button>)}
      </div>
    </header>

    <div className="rounded-2xl border border-[#DCE5F1] bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#E9EEF6] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-sm font-bold text-[#142746]"><SlidersHorizontal className="h-4 w-4 text-[#4475B5]" /> Renewal register</div>
        <div className="relative w-full sm:ml-auto sm:w-[340px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8393A8]" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search vehicle, policy or reference" aria-label="Search renewals"
            className="h-10 w-full rounded-lg border border-[#D8E1EC] bg-[#FAFCFF] pl-9 pr-3 text-xs text-[#142746] outline-none focus:border-[#4E95E9] focus:ring-2 focus:ring-[#4E95E9]/20" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5" role="group" aria-label="Filter renewal category">
        {[{ key: "all", title: "All types", count: items.length }, ...categories].map(category =>
          <button key={category.key} type="button" aria-pressed={selectedType === category.key} onClick={() => setSelectedType(category.key)}
            className={`rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${selectedType === category.key ? "border-[#17345B] bg-[#17345B] text-white" : "border-[#DFE7F0] bg-[#F8FAFD] text-[#526680] hover:border-[#A9BDD8]"}`}>
            {category.title} <span className={`ml-1 ${selectedType === category.key ? "text-white/80" : "text-[#8493A7]"}`}>{category.count}</span>
          </button>)}
        {filtered && <button type="button" onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#3268A9] hover:underline"><X className="h-3.5 w-3.5" /> Clear filters</button>}
      </div>
      <div className="flex items-center justify-between border-t border-[#EDF1F6] px-4 py-2.5 text-[11px] text-[#718199] sm:px-5"><span>Showing <strong className="text-[#142746]">{visible.length}</strong> of {items.length} items</span><span>Most urgent first</span></div>

      {visible.length === 0 ? <div className="flex flex-col items-center gap-2 border-t border-[#EDF1F6] px-6 py-12 text-center"><CheckCircle2 className="h-9 w-9 text-[#7C9FC7]" /><p className="text-sm font-semibold text-[#142746]">No matching renewals</p><p className="text-xs text-[#718199]">Try another category or search term.</p>{filtered && <button type="button" onClick={clearFilters} className="mt-2 text-xs font-semibold text-[#3268A9] underline">Show all renewals</button>}</div> : <>
        <div className="hidden overflow-x-auto border-t border-[#EDF1F6] md:block">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="bg-[#F6F8FC] text-[10px] font-bold uppercase tracking-wide text-[#7788A0]"><tr>
              {["Renewal / reference", "Vehicle", "Expiry date", "Time remaining", "Status", ""].map(label => <th key={label} scope="col" className="px-5 py-3">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#EDF1F6]">{visible.map(item => <tr key={item.id} className="transition hover:bg-[#F8FBFF]">
              <td className="px-5 py-3.5"><div className="font-semibold text-[#182E4B]">{item.title}</div><div className="mt-1 max-w-[230px] truncate text-[11px] text-[#8290A4]" title={item.reference}>{item.reference || "No reference recorded"}</div></td>
              <td className="px-5 py-3.5"><Link href={vehicleHref(item)} className="inline-flex items-center gap-2 font-bold text-[#215AA1] hover:underline"><Truck className="h-4 w-4 text-[#7395C3]" />{item.vehicleNo}</Link></td>
              <td className="whitespace-nowrap px-5 py-3.5 text-[#435773]"><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-[#8A9CB2]" />{item.expiry}</span></td>
              <td className={`whitespace-nowrap px-5 py-3.5 font-semibold ${item.daysUntil < 0 ? "text-rose-700" : "text-[#344D70]"}`}>{item.daysUntil < 0 ? `${Math.abs(item.daysUntil)} days overdue` : item.daysUntil === 0 ? "Today" : `${item.daysUntil} days left`}</td>
              <td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${urgencyStyle(item)}`}>{urgencyLabel(item)}</span></td>
              <td className="px-5 py-3.5 text-right"><Link href={vehicleHref(item)} className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-[#215AA1] hover:underline">View vehicle <ArrowRight className="h-3.5 w-3.5" /></Link></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="divide-y divide-[#EDF1F6] border-t border-[#EDF1F6] md:hidden">{visible.map(item => <div key={item.id} className="space-y-3 px-4 py-4">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-bold text-[#182E4B]">{item.title}</p><p className="mt-1 break-all text-[11px] text-[#8290A4]">{item.reference || "No reference recorded"}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ring-1 ring-inset ${urgencyStyle(item)}`}>{urgencyLabel(item)}</span></div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><Link href={vehicleHref(item)} className="inline-flex items-center gap-1.5 font-bold text-[#215AA1]"><Truck className="h-4 w-4" />{item.vehicleNo}</Link><span className="inline-flex items-center gap-1 text-[#61738D]"><CalendarClock className="h-3.5 w-3.5" />{item.expiry}</span></div>
          <div className="flex items-center justify-between gap-2"><span className={`text-xs font-semibold ${item.daysUntil < 0 ? "text-rose-700" : "text-[#344D70]"}`}>{item.daysUntil < 0 ? `${Math.abs(item.daysUntil)} days overdue` : item.daysUntil === 0 ? "Due today" : `${item.daysUntil} days left`}</span><Link href={vehicleHref(item)} className="inline-flex items-center gap-1 text-xs font-bold text-[#215AA1]">View vehicle <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        </div>)}</div>
      </>}
    </div>
  </section>;
}
