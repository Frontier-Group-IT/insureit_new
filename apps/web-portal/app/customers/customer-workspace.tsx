"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CustomerRow = {
  id: string;
  customer_code: string;
  partner_type: string | null;
  company_name: string | null;
  contact_name: string;
  phone: string;
  city: string | null;
  fleet_size_band: string | null;
  onboarding_status: string;
  vehicles: { count: number }[];
};

type ColumnKey = "customer" | "partner" | "mobile" | "city" | "fleet" | "vehicles" | "status";

const partnerLabels: Record<string, string> = {
  individual_proprietor: "Individual / Proprietor",
  dealership: "Dealership",
  corporate: "Corporate",
  group: "Group"
};

const fleetLabels: Record<string, string> = {
  less_than_5: "< 5",
  "5_to_20": "5–20",
  "20_to_50": "20–50",
  more_than_50: "> 50"
};

const columnLabels: Record<ColumnKey, string> = {
  customer: "Customer",
  partner: "Partner Type",
  mobile: "Mobile",
  city: "City",
  fleet: "Fleet",
  vehicles: "Vehicles",
  status: "Status"
};

const PAGE_SIZE = 15;

export function CustomerWorkspace({ rows }: { rows: CustomerRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(Object.keys(columnLabels) as ColumnKey[]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = status === "all" || row.onboarding_status === status;
      const haystack = [row.contact_name, row.company_name, row.customer_code, row.phone, row.city, row.partner_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [query, rows, status]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));
  const somePageSelected = pageRows.some((row) => selectedIds.has(row.id));

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleCurrentPage() {
    setSelectedIds((current) => {
      const next = new Set(current);
      pageRows.forEach((row) => allPageSelected ? next.delete(row.id) : next.add(row.id));
      return next;
    });
  }

  function exportSelected() {
    if (!selectedRows.length) return;
    const headings = ["Customer Code", "Customer", "Legal Trade Name", "Partner Type", "Mobile", "City", "Fleet", "Status"];
    const lines = selectedRows.map((row) => [row.customer_code, row.contact_name, row.company_name ?? "", row.partner_type ? partnerLabels[row.partner_type] ?? row.partner_type : "", row.phone, row.city ?? "", row.fleet_size_band ? fleetLabels[row.fleet_size_band] ?? row.fleet_size_band : "", row.onboarding_status]);
    const csv = [headings, ...lines].map((line) => line.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyMobiles() {
    if (!selectedRows.length) return;
    await navigator.clipboard.writeText(selectedRows.map((row) => row.phone).join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-white shadow-[var(--shadow-panel)]">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search customer, code, mobile or city" className="h-8 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-white px-3 text-[11.5px] lg:max-w-xl" />
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-8 min-w-[150px] rounded-md border border-[var(--border)] bg-white px-2.5 text-[11px]">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="documents_pending">Onboarding pending</option>
          </select>
        </div>
        <div className="flex items-center justify-end gap-1.5">
          <details className="relative">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2.5 text-[10.5px] font-semibold [&::-webkit-details-marker]:hidden">☷ Columns</summary>
            <div className="absolute right-0 top-9 z-30 w-48 rounded-lg border border-[var(--border)] bg-white p-1.5 shadow-xl">
              {(Object.keys(columnLabels) as ColumnKey[]).map((column) => <label key={column} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[10.5px] hover:bg-[#F4F7FB]"><input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => setVisibleColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column])} className="h-3 w-3" />{columnLabels[column]}</label>)}
            </div>
          </details>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] bg-white" onClick={() => window.location.reload()}>↻</button>
          <Link href="/customers/new" className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--brand-accent)] px-3 text-[10.5px] font-semibold text-white hover:bg-[#5D55D8]">+ Add Customer</Link>
        </div>
      </div>

      {selectedRows.length ? <div className="flex flex-wrap items-center gap-1.5 border-b border-[#D9E2EE] bg-[#F4F6FF] px-3 py-1.5 text-[10.5px]"><span className="mr-1 font-semibold">{selectedRows.length} selected</span>{selectedRows.length === 1 ? <><Link href={`/customers/${selectedRows[0].id}/edit`} className="rounded-md border border-[#C9D2E2] bg-white px-2.5 py-1 font-semibold">Open customer</Link><Link href={`/vehicles/new?customer_id=${selectedRows[0].id}`} className="rounded-md bg-[var(--brand-accent)] px-2.5 py-1 font-semibold text-white">+ Add Vehicle</Link></> : null}<button type="button" onClick={copyMobiles} className="rounded-md border border-[#C9D2E2] bg-white px-2.5 py-1 font-semibold">{copied ? "Copied" : "Copy mobiles"}</button><button type="button" onClick={exportSelected} className="rounded-md border border-[#C9D2E2] bg-white px-2.5 py-1 font-semibold">Export CSV</button><button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto rounded-md px-2 py-1 font-semibold text-[#667085]">Clear</button></div> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-[11px]">
          <thead className="border-b border-[var(--border)] bg-[#F8FAFC] text-[9.5px] font-semibold uppercase tracking-[0.035em] text-[#647086]"><tr><th className="w-9 px-2 py-2"><input type="checkbox" checked={allPageSelected} ref={(element) => { if (element) element.indeterminate = somePageSelected && !allPageSelected; }} onChange={toggleCurrentPage} className="h-3 w-3" /></th>{visibleColumns.includes("customer") ? <th className="px-2 py-2">Customer</th> : null}{visibleColumns.includes("partner") ? <th className="px-2 py-2">Partner Type</th> : null}{visibleColumns.includes("mobile") ? <th className="px-2 py-2">Mobile</th> : null}{visibleColumns.includes("city") ? <th className="px-2 py-2">City</th> : null}{visibleColumns.includes("fleet") ? <th className="px-2 py-2">Fleet</th> : null}{visibleColumns.includes("vehicles") ? <th className="px-2 py-2 text-center">Vehicles</th> : null}{visibleColumns.includes("status") ? <th className="px-2 py-2">Status</th> : null}<th className="w-11 px-2 py-2 text-center">Action</th></tr></thead>
          <tbody className="divide-y divide-[#E9EEF5] bg-white">{pageRows.map((customer) => <tr key={customer.id} className={selectedIds.has(customer.id) ? "bg-[#F5F6FF]" : "hover:bg-[#FAFCFF]"}><td className="px-2 py-1.5"><input type="checkbox" checked={selectedIds.has(customer.id)} onChange={() => toggleRow(customer.id)} className="h-3 w-3" /></td>{visibleColumns.includes("customer") ? <td className="px-2 py-1.5"><p className="font-semibold">{customer.contact_name}</p>{customer.company_name ? <p className="max-w-[220px] truncate text-[9.5px] text-[#667286]">{customer.company_name}</p> : null}<p className="text-[9px] text-[#8A96A7]">{customer.customer_code}</p></td> : null}{visibleColumns.includes("partner") ? <td className="px-2 py-1.5">{customer.partner_type ? partnerLabels[customer.partner_type] ?? customer.partner_type : "—"}</td> : null}{visibleColumns.includes("mobile") ? <td className="px-2 py-1.5">{customer.phone}</td> : null}{visibleColumns.includes("city") ? <td className="px-2 py-1.5">{customer.city ?? "—"}</td> : null}{visibleColumns.includes("fleet") ? <td className="px-2 py-1.5">{customer.fleet_size_band ? fleetLabels[customer.fleet_size_band] ?? customer.fleet_size_band : "—"}</td> : null}{visibleColumns.includes("vehicles") ? <td className="px-2 py-1.5 text-center font-semibold">{customer.vehicles?.[0]?.count ?? 0}</td> : null}{visibleColumns.includes("status") ? <td className="px-2 py-1.5"><StatusPill status={customer.onboarding_status} /></td> : null}<td className="px-2 py-1.5 text-center"><details className="relative inline-block"><summary className="grid h-6 w-6 cursor-pointer list-none place-items-center rounded-md text-[16px] font-bold [&::-webkit-details-marker]:hidden">⋮</summary><div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-[var(--border)] bg-white p-1 shadow-xl"><Link href={`/customers/${customer.id}/edit`} className="block rounded-md px-2 py-1.5 hover:bg-[#F3F7FC]">View / Edit</Link><Link href={`/vehicles/new?customer_id=${customer.id}`} className="block rounded-md px-2 py-1.5 hover:bg-[#F3F7FC]">Add Vehicle</Link></div></details></td></tr>)}</tbody>
        </table>
        {!pageRows.length ? <div className="px-4 py-14 text-center text-[11px] text-[var(--muted)]">No matching customers</div> : null}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--muted)]"><p>Showing {pageRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}</p><div className="flex items-center gap-1"><button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-7 rounded-md border px-2.5 disabled:opacity-40">Previous</button><span className="px-2 font-semibold">{safePage} / {totalPages}</span><button type="button" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-7 rounded-md border px-2.5 disabled:opacity-40">Next</button></div></div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{active ? "Active" : status.replaceAll("_", " ")}</span>;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
