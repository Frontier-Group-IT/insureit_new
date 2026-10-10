"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertCircle, CalendarCheck2, CalendarClock, CarFront, ChevronRight, ClipboardList, FileText, Search, ShieldCheck } from "lucide-react";

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
  const [selectedTiming, setSelectedTiming] = useState("all");
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items.filter(item => (selectedType === "all" || item.key === selectedType) && (selectedTiming === "all" || (selectedTiming === "overdue" ? item.daysUntil < 0 : item.daysUntil >= 0)) &&
      (!term || [item.title, item.vehicleNo, item.reference, item.status, item.expiry].some(value => value.toLowerCase().includes(term))));
  }, [items, query, selectedType, selectedTiming]);
  const overdue = items.filter(item => item.daysUntil < 0).length;
  const dueSoon = items.filter(item => item.daysUntil >= 0).length;
  const countFor = (term: string) => categories.filter(category => category.title.toLowerCase().includes(term)).reduce((total, category) => total + category.count, 0);
  const metrics = [
    { label: "Total renewals", value: items.length, Icon: ClipboardList, theme: "bg-[#F0F6FF]", icon: "text-[#1572D7]", filter: "all" },
    { label: "Due soon", value: dueSoon, Icon: CalendarCheck2, theme: "bg-[#ECFAF3]", icon: "text-[#00A56A]", filter: "due" },
    { label: "Overdue", value: overdue, Icon: AlertCircle, theme: "bg-[#FFF0F1]", icon: "text-[#D62C3C]", filter: "overdue" },
    { label: "Insurance policy", value: countFor("insurance"), Icon: ShieldCheck, theme: "bg-[#F4F1FF]", icon: "text-[#6B50D4]", filter: categories.find(c => c.title.toLowerCase().includes("insurance"))?.key ?? "all" },
    { label: "Road tax", value: countFor("road tax"), Icon: FileText, theme: "bg-[#FFF7EC]", icon: "text-[#E07D11]", filter: categories.find(c => c.title.toLowerCase().includes("road tax"))?.key ?? "all" },
    { label: "Fitness", value: countFor("fitness"), Icon: CarFront, theme: "bg-[#EDFBFE]", icon: "text-[#00A1B5]", filter: categories.find(c => c.title.toLowerCase().includes("fitness"))?.key ?? "all" },
  ];
  return <div className="space-y-3">
    <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
      <div className="absolute inset-y-0 right-0 w-[67%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-cover bg-center opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#06162F] via-[#08254C]/95 via-45% to-transparent" />
      <div className="relative flex min-h-[165px] items-center px-5 py-5 sm:min-h-[205px] sm:px-8">
        <div className="max-w-[58%]">
          <p className="text-[9px] font-extrabold uppercase tracking-[.15em] text-[#86C8FF]">Stay ahead of every expiry</p>
          <h1 className="mt-2 text-[clamp(24px,3vw,38px)] font-black leading-tight">Policy <span className="text-[#369BFF]">Renewals</span></h1>
          <p className="mt-2 max-w-[390px] text-[11px] leading-5 text-[#E0EEFF]">Never miss a renewal. Keep your vehicles and business protected with continuous coverage.</p>
        </div>
      </div>
    </section>
    <section aria-label="Renewal summary" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      {metrics.map(({ label, value, Icon, theme, icon, filter }) => <button type="button" key={label} onClick={() => { if (filter === "due" || filter === "overdue") { setSelectedType("all"); setSelectedTiming(filter); } else { setSelectedType(filter); setSelectedTiming("all"); } }} className={`flex min-h-[80px] items-center gap-2 rounded-xl border border-[#DEE7F1] p-2.5 text-left transition hover:border-[#8CB9EE] ${theme}`}>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/75 ${icon}`}><Icon className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><strong className="block text-[21px] font-black text-[#10213D]">{value}</strong><span className="block text-[10px] font-semibold leading-tight text-[#506684]">{label}</span></span>
        <ChevronRight className="h-3 w-3 shrink-0 text-[#6E85A4]" />
      </button>)}
    </section>
    <section className="overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white p-3 shadow-[0_8px_30px_rgba(20,40,75,.04)] sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-[#D8E1EC] bg-[#FBFCFE] px-3 py-2.5 transition-colors focus-within:border-[#4E95E9]">
          <Search className="h-4 w-4 shrink-0 text-[#73829A]" aria-hidden="true" />
          <span className="sr-only">Search renewals</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search vehicle, reference, renewal item..." className="w-full min-w-0 border-0 bg-transparent p-0 text-[11px] outline-none" />
        </label>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter renewal category">
          {[{ key: "all", title: "All", count: items.length }, ...categories].map(category =>
            <button key={category.key} type="button" aria-pressed={selectedType === category.key} onClick={() => { setSelectedType(category.key); setSelectedTiming("all"); }}
              className={`rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition ${selectedType === category.key ? "border-[#0E3268] bg-[#0E3268] text-white" : "border-[#D8E1EC] bg-white text-[#64748B] hover:bg-[#F1F5FA]"}`}>
              {category.title} · {category.count}
            </button>)}
        </div>
      </div>
      {visible.length === 0 ? <div className="rounded-xl border border-[#D8E1EC] bg-[#F8FAFD] p-8 text-center text-sm text-[#52657F]">No matching renewals</div> :
      <div className="overflow-x-auto rounded-xl border border-[#D8E1EC]">
        <table className="w-full min-w-[830px] text-left text-[11px]">
          <thead className="bg-[#F1F5FA] text-[10px] font-bold uppercase text-[#687991]"><tr>{["Renewal item","Vehicle","Reference","Expiry date","Days left","Status","Actions"].map(label => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#E7EDF5]">{visible.map(item => <tr key={item.id} className="hover:bg-[#F8FAFD]">
            <td className="px-3 py-3"><span className="inline-flex items-center gap-2 font-bold text-[#142746]"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${/insurance/i.test(item.title) ? "bg-[#E9F3FF] text-[#176BD4]" : /tax|permit/i.test(item.title) ? "bg-[#FFF2E6] text-[#D97716]" : "bg-[#EAF9F2] text-[#16A06B]"}`}>{/insurance/i.test(item.title) ? <ShieldCheck className="h-4 w-4"/> : /tax|permit/i.test(item.title) ? <FileText className="h-4 w-4"/> : <CalendarClock className="h-4 w-4"/>}</span>{item.title}</span></td>
            <td className="px-3 py-3 font-bold text-[#154D9B]"><Link href={{ pathname: `/customer/vehicles/${item.vehicleId}`, query: { account: accountId } }} className="hover:underline focus-visible:underline">{item.vehicleNo}</Link></td>
            <td className="max-w-[220px] truncate px-3 py-3" title={item.reference}>{item.reference || "—"}</td>
            <td className="whitespace-nowrap px-3 py-3"><span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5 text-[#456B9B]" />{item.expiry}</span></td>
            <td className={`px-3 py-3 font-semibold ${item.daysUntil < 0 ? "text-[#D62C3C]" : "text-[#21466D]"}`}>{item.daysUntil < 0 ? `${Math.abs(item.daysUntil)} overdue` : `${item.daysUntil} days`}</td>
            <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${item.status === "expired" ? "border-red-200 bg-red-50 text-red-600" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{item.status === "expired" ? "Expired" : "Due soon"}</span></td>
            <td className="px-3 py-3"><Link aria-label={`View vehicle ${item.vehicleNo}`} href={{ pathname: `/customer/vehicles/${item.vehicleId}`, query: { account: accountId } }} className="inline-flex rounded-lg border border-[#DCE6F2] p-2 text-[#1B5794] hover:bg-[#EDF5FF]"><ChevronRight className="h-4 w-4"/></Link></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p className="mt-3 text-[10px] font-medium text-[#6A7B93]">Showing {visible.length} of {items.length} renewals</p>
    </section>
  </div>;
}
