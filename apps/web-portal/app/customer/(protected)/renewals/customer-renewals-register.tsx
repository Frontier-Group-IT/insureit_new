"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, RefreshCw, Search } from "lucide-react";

export type RenewalRegisterItem = {
  id: string; title: string; key: string; vehicleId: string; vehicleNo: string;
  reference: string; expiry: string; daysUntil: number; status: string;
};
export type RenewalCategory = { key: string; title: string; count: number };

export function CustomerRenewalsRegister({ accountId, items, categories }: {
  accountId: string; items: RenewalRegisterItem[]; categories: RenewalCategory[];
}) {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter(item => (selectedType === "all" || item.key === selectedType) &&
      (!term || [item.title, item.vehicleNo, item.reference, item.status, item.expiry].some(value => value.toLowerCase().includes(term))));
  }, [items, query, selectedType]);
  return <div className="space-y-3">
    <header className="flex flex-wrap items-center gap-3 rounded-xl border border-[#D8E1EC] bg-white px-4 py-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#17345B] text-white"><RefreshCw className="h-5 w-5" /></span>
      <h1 className="text-[18px] font-bold text-[#142746]">Renewals</h1>
      <label className="flex min-w-[200px] flex-1 items-center gap-2 px-2 py-2.5 sm:max-w-[420px]">
        <Search className="h-4 w-4 shrink-0 text-[#73829A]" aria-hidden="true" />
        <span className="sr-only">Search renewals</span>
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vehicle, reference, renewal item..." className="w-full min-w-0 border-0 bg-transparent p-0 text-[12px] shadow-none outline-none ring-0 focus:outline-none focus:ring-0" />
      </label>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter renewal category">
        {[{ key: "all", title: "All", count: items.length }, ...categories].map(category =>
          <button key={category.key} type="button" aria-pressed={selectedType === category.key} onClick={() => setSelectedType(category.key)}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition ${selectedType === category.key ? "border-[#142746] bg-[#142746] text-white" : "border-[#D8E1EC] bg-white text-[#64748B] hover:bg-[#F1F5FA]"}`}>
            {category.title} · {category.count}
          </button>)}
      </div>
    </header>
    {visible.length === 0 ? <div className="rounded-xl border border-[#D8E1EC] bg-white p-8 text-center text-sm text-[#52657F]">No matching renewals</div> :
    <div className="overflow-x-auto rounded-xl border border-[#D8E1EC] bg-white">
      <table className="w-full min-w-[760px] text-left text-[11px]">
        <thead className="bg-[#F1F5FA] text-[10px] font-bold text-[#687991]"><tr>{["Renewal item","Vehicle","Reference","Expiry date","Days left","Status"].map(label => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#E7EDF5]">{visible.map(item => <tr key={item.id} className="hover:bg-[#F8FAFD]">
          <td className="px-3 py-3 font-semibold text-[#142746]">{item.title}</td>
          <td className="px-3 py-3 font-bold text-[#154D9B]"><Link href={{ pathname: `/customer/vehicles/${item.vehicleId}`, query: { account: accountId } }} className="hover:underline focus-visible:underline">{item.vehicleNo}</Link></td>
          <td className="max-w-[220px] truncate px-3 py-3" title={item.reference}>{item.reference || "—"}</td>
          <td className="whitespace-nowrap px-3 py-3"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{item.expiry}</span></td>
          <td className="px-3 py-3">{item.daysUntil < 0 ? `${Math.abs(item.daysUntil)} overdue` : `${item.daysUntil} days`}</td>
          <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${item.status === "expired" ? "border-red-200 bg-red-50 text-red-600" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{item.status === "expired" ? "Expired" : "Due soon"}</span></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </div>;
}
