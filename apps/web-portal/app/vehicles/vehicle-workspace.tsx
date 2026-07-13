"use client";

import Link from "next/link";
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

  return <section className="mx-auto max-w-[1440px] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="flex flex-col gap-2 border-b border-[#E2E8F0] px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
        <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search registration, customer, permit, make or model" className="h-9 min-w-0 flex-1 rounded-md border border-[#CBD5E1] px-3 text-[11.5px] lg:max-w-md" />
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="h-9 min-w-[170px] rounded-md border border-[#CBD5E1] bg-white px-2.5 text-[11px]"><option value="all">All vehicle types</option>{types.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <Link href="/vehicles/new" className="inline-flex h-9 items-center justify-center rounded-md bg-[#4F46E5] px-4 text-[11px] font-semibold text-white shadow-sm hover:bg-[#4338CA]">+ Add Vehicle</Link>
      </div>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] table-fixed text-left text-[11px] text-[#1E293B]">
      <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#64748B]"><tr><th className="w-[170px] px-3 py-2.5">Vehicle</th><th className="w-[210px] px-3 py-2.5">Customer</th><th className="w-[190px] px-3 py-2.5">Make / Model</th><th className="w-[150px] px-3 py-2.5">Permit</th><th className="w-[110px] px-3 py-2.5">Type</th><th className="w-[72px] px-3 py-2.5 text-center">Action</th></tr></thead>
      <tbody className="divide-y divide-[#EEF2F6]">{pageRows.map((vehicle) => <tr key={vehicle.id} className="h-12 hover:bg-[#FAFCFF]"><td className="px-3"><Link href={`/vehicles/${vehicle.id}/edit`} className="font-mono text-[12px] font-semibold text-[#0F172A] hover:text-[#4F46E5]">{vehicle.vehicle_no}</Link></td><td className="px-3"><span className="block truncate">{vehicle.customers?.contact_name ?? "—"}</span></td><td className="px-3"><span className="block truncate">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"}</span></td><td className="px-3"><span className="block truncate">{vehicle.permit_no ?? "—"}</span></td><td className="px-3"><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-blue-700">{vehicle.vehicle_type}</span></td><td className="px-3 text-center"><Link href={`/vehicles/${vehicle.id}/edit`} className="font-semibold text-[#4F46E5]">Edit</Link></td></tr>)}</tbody>
    </table>{!pageRows.length ? <div className="px-4 py-16 text-center"><p className="text-[12px] font-semibold text-[#334155]">No matching vehicles</p><p className="mt-1 text-[10.5px] text-[#94A3B8]">Adjust the search or vehicle type filter.</p></div> : null}</div>
    <div className="flex items-center justify-between border-t border-[#E2E8F0] px-3 py-2.5 text-[10px] text-[#64748B]"><p>Showing {pageRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</p><div className="flex gap-1"><button type="button" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-7 rounded-md border border-[#CBD5E1] px-2.5 disabled:opacity-40">Previous</button><button type="button" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="h-7 rounded-md border border-[#CBD5E1] px-2.5 disabled:opacity-40">Next</button></div></div>
  </section>;
}
