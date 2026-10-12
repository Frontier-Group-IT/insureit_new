"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, FileText, Search, ShieldCheck } from "lucide-react";

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
    <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
      <div className="absolute inset-y-0 right-0 w-[67%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-cover bg-center opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#06162F] via-[#08254C]/95 via-45% to-transparent" />
      <div className="relative flex min-h-[165px] items-center px-5 py-5 sm:min-h-[205px] sm:px-8">
        <div className="max-w-[58%]">
          <h1 className="text-[clamp(24px,3vw,38px)] font-black leading-tight">Policy <span className="text-[#369BFF]">Renewals</span></h1>
        </div>
      </div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white p-3 shadow-[0_8px_30px_rgba(20,40,75,.04)] sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 xl:flex-nowrap">
        <h2 className="shrink-0 text-[17px] font-black text-[#10213D]">Policy Renewal Register</h2>
        <label className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-[#D8E1EC] bg-[#FBFCFE] px-3 py-2.5 transition-colors focus-within:border-[#4E95E9] sm:w-[190px] sm:shrink-0">
          <Search className="h-4 w-4 shrink-0 text-[#73829A]" aria-hidden="true" />
          <span className="sr-only">Search renewals</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search renewals..." className="w-full min-w-0 border-0 bg-transparent p-0 text-[11px] outline-none" />
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter renewal category">
          {[{ key: "all", title: "All", count: items.length }, ...categories].map(category =>
            <button key={category.key} type="button" aria-pressed={selectedType === category.key} onClick={() => { setSelectedType(category.key); }}
              className={`rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition ${selectedType === category.key ? "border-[#0E3268] bg-[#0E3268] text-white" : "border-[#D8E1EC] bg-white text-[#64748B] hover:bg-[#F1F5FA]"}`}>
              {category.title} · {category.count}
            </button>)}
        </div>
      </div>
      {visible.length === 0 ? <div className="rounded-xl border border-[#D8E1EC] bg-[#F8FAFD] p-8 text-center text-sm text-[#52657F]">No matching renewals</div> :
      <div className="overflow-x-auto rounded-xl border border-[#D8E1EC]">
        <table className="w-full min-w-[760px] text-left text-[11px]">
          <thead className="bg-[#F1F5FA] text-[10px] font-bold uppercase text-[#687991]"><tr>{["Renewal item","Vehicle","Reference","Expiry date","Days left","Status"].map(label => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#E7EDF5]">{visible.map(item => <tr key={item.id} className="group relative hover:bg-[#F8FAFD] focus-within:bg-[#F0F7FF]">
            <td className="px-3 py-3"><span className="inline-flex items-center gap-2 font-bold text-[#142746]"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${/insurance/i.test(item.title) ? "bg-[#E9F3FF] text-[#176BD4]" : /tax|permit/i.test(item.title) ? "bg-[#FFF2E6] text-[#D97716]" : "bg-[#EAF9F2] text-[#16A06B]"}`}>{/insurance/i.test(item.title) ? <ShieldCheck className="h-4 w-4"/> : /tax|permit/i.test(item.title) ? <FileText className="h-4 w-4"/> : <CalendarClock className="h-4 w-4"/>}</span>{item.title}</span></td>
            <td className="px-3 py-3 font-bold text-[#154D9B]"><Link href={{ pathname: `/customer/vehicles/${item.vehicleId}`, query: { account: accountId } }} className="after:absolute after:inset-0 after:cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#267AFF] focus-visible:outline-offset-2" aria-label={`View vehicle ${item.vehicleNo} renewal details`}>{item.vehicleNo}</Link></td>
            <td className="max-w-[220px] truncate px-3 py-3" title={item.reference}>{item.reference || "—"}</td>
            <td className="whitespace-nowrap px-3 py-3"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 text-[#456B9B]" />{item.expiry}</span></td>
            <td className={`px-3 py-3 font-semibold ${item.daysUntil < 0 ? "text-[#D62C3C]" : "text-[#21466D]"}`}>{item.daysUntil < 0 ? `${Math.abs(item.daysUntil)} overdue` : `${item.daysUntil} days`}</td>
            <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${item.status === "expired" ? "border-red-200 bg-red-50 text-red-600" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{item.status === "expired" ? "Expired" : "Due soon"}</span></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p className="mt-3 text-[10px] font-medium text-[#6A7B93]">Showing {visible.length} of {items.length} renewals</p>
    </section>
  </div>;
}
