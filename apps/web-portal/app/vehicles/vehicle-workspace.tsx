"use client";

import Link from "next/link";
import { CarFront, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

type VehicleRow = { id: string; vehicle_no: string; vehicle_type: string; make: string | null; model: string | null; permit_no: string | null; customers: { company_name: string | null; contact_name: string } | null };
const PAGE_SIZE = 15;

export function VehicleWorkspace({ rows }: { rows: VehicleRow[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const types = useMemo(() => Array.from(new Set(rows.map((row) => row.vehicle_type).filter(Boolean))).sort(), [rows]);
  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = [row.vehicle_no, row.vehicle_type, row.make, row.model, row.permit_no, row.customers?.company_name, row.customers?.contact_name].filter(Boolean).join(" ").toLowerCase();
    return (type === "all" || row.vehicle_type === type) && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  }), [query, rows, type]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return <section className="ui-glass-panel mx-auto max-w-[1440px] overflow-hidden rounded-[24px] border border-white/80 bg-white/78 shadow-[0_22px_65px_rgba(39,44,91,0.09)] backdrop-blur-xl">
    <div className="flex flex-col gap-3 border-b border-[#E8EAF3] bg-gradient-to-r from-[#FBFAFF] via-white to-[#F0FCFD] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#5B4BDA] to-[#17B7BD] text-white shadow-[0_12px_28px_rgba(91,75,218,.25)]"><CarFront className="h-5 w-5" /></span><div><p className="font-display text-[15px] font-semibold text-[#1A1D3C]">Vehicle registry</p><p className="text-[9.5px] font-medium text-[#7A8298]">{filtered.length} vehicles in current view</p></div></div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row lg:max-w-[860px] lg:justify-end">
        <label className="relative flex-1 lg:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8D95A9]" /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search registration, customer, permit, make or model" className="h-10 w-full rounded-xl pl-10 text-[11.5px]" /></label>
        <label className="relative"><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8D95A9]" /><select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="h-10 min-w-[180px] rounded-xl pl-9 text-[11px]"><option value="all">All vehicle types</option>{types.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <Link href="/vehicles/new" className="ui-primary-action inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[11px] font-bold text-white"><Plus className="h-4 w-4" />Add Vehicle</Link>
      </div>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] table-fixed text-left text-[11px] text-[#252944]">
      <thead className="sticky top-0 z-10 border-b border-[#E7E9F1] bg-[#F8F8FD]/95 text-[9px] font-bold uppercase tracking-[0.07em] text-[#747D95] backdrop-blur-xl"><tr><th className="w-[170px] px-4 py-3">Vehicle</th><th className="w-[210px] px-3 py-3">Customer</th><th className="w-[190px] px-3 py-3">Make / Model</th><th className="w-[150px] px-3 py-3">Permit</th><th className="w-[110px] px-3 py-3">Type</th><th className="w-[72px] px-3 py-3 text-center">Action</th></tr></thead>
      <tbody className="divide-y divide-[#EEF0F6]">{pageRows.map((vehicle) => <tr key={vehicle.id} className="h-14 transition hover:bg-[#F6F4FF]"><td className="px-4"><Link href={`/vehicles/${vehicle.id}/edit`} className="font-display text-[12px] font-semibold tracking-[-0.01em] text-[#1A1D3C] hover:text-[#5B4BDA]">{vehicle.vehicle_no}</Link></td><td className="px-3"><span className="block truncate">{vehicle.customers?.contact_name ?? "—"}</span></td><td className="px-3"><span className="block truncate">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}</span></td><td className="px-3"><span className="block truncate">{vehicle.permit_no ?? "—"}</span></td><td className="px-3"><span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[9px] font-bold text-cyan-700">{vehicle.vehicle_type}</span></td><td className="px-3 text-center"><Link href={`/vehicles/${vehicle.id}/edit`} className="rounded-lg border border-[#D8D5FF] bg-[#F2F0FF] px-2.5 py-1.5 text-[9.5px] font-bold text-[#5B4BDA]">Edit</Link></td></tr>)}</tbody>
    </table>{!pageRows.length ? <div className="px-4 py-16 text-center"><p className="font-display text-[13px] font-semibold text-[#303550]">No matching vehicles</p><p className="mt-1 text-[10px] text-[#9299AA]">Adjust the search or vehicle type filter.</p></div> : null}</div>
    <div className="flex items-center justify-between border-t border-[#E8EAF2] bg-white/70 px-4 py-3 text-[10px] text-[#6E768C]"><p>Showing {pageRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</p><div className="flex gap-1"><button type="button" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-8 rounded-lg border border-[#D9DCE7] bg-white px-3 font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="h-8 rounded-lg border border-[#D9DCE7] bg-white px-3 font-semibold disabled:opacity-40">Next</button></div></div>
  </section>;
}
