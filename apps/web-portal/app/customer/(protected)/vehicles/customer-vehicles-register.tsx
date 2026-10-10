"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CarFront, Search } from "lucide-react";

export type VehicleItem = { id: string; number: string; make: string; model: string; type: string; chassis: string; engine: string; policy: string | null };
export function CustomerVehiclesRegister({ accountId, items, initialQuery = "" }: { accountId: string; items: VehicleItem[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(v => [v.number, v.make, v.model, v.chassis, v.engine, v.type, v.policy ?? ""].some(x => x.toLowerCase().includes(q))) : items;
  }, [items, query]);
  return <div className="space-y-3">
    <header className="flex flex-wrap items-center gap-3 rounded-xl border border-[#D8E1EC] bg-white px-4 py-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#17345B] text-white"><CarFront className="h-5 w-5" /></span>
      <h1 className="text-[18px] font-bold text-[#142746]">Vehicles</h1>
      <label className="flex min-w-[200px] flex-1 items-center gap-2 px-2 py-2.5 sm:max-w-[420px]">
        <Search className="h-4 w-4 text-[#73829A]" /><span className="sr-only">Search vehicles</span>
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search registration, chassis, make or model" className="w-full min-w-0 border-0 bg-transparent p-0 text-[12px] shadow-none outline-none ring-0 focus:outline-none focus:ring-0" />
      </label>
    </header>
    {rows.length === 0 ? <div className="rounded-xl border bg-white p-8 text-center text-sm">No matching vehicles</div> :
    <div className="overflow-x-auto rounded-xl border border-[#D8E1EC] bg-white">
      <table className="w-full min-w-[840px] border-collapse text-left text-[11px]">
        <thead className="bg-[#F1F5FA] text-[10px] font-extrabold uppercase text-[#687991]"><tr>{["Vehicle no.", "Make / model", "Type", "Chassis no.", "Engine no.", "Active policy", "Cover status"].map(h => <th key={h} className="border-b px-3 py-3">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#E7EDF5]">{rows.map(v => <tr key={v.id} className="hover:bg-[#F6F9FE]">
          <td className="px-3 py-2.5 font-extrabold text-[#133C73]"><Link href={{ pathname: `/customer/vehicles/${v.id}`, query: { account: accountId } }} className="hover:underline">{v.number}</Link></td>
          <td className="px-3 py-2.5 font-semibold">{v.model || v.make || "—"}</td>
          <td className="px-3 py-2.5">{v.type || "—"}</td><td className="px-3 py-2.5">{v.chassis || "—"}</td><td className="px-3 py-2.5">{v.engine || "—"}</td>
          <td className="px-3 py-2.5 font-bold">{v.policy || "—"}</td>
          <td className="px-3 py-2.5"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${v.policy ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>{v.policy ? "Covered" : "No active policy"}</span></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </div>;
}
