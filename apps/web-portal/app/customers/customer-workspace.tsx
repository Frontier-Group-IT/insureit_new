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

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function updateStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  function toggleColumn(column: ColumnKey) {
    setVisibleColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column]);
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--border)] bg-white shadow-[var(--shadow-panel)]">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-[#7C8798]">⌕</span>
            <input
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search customer, code, mobile or city"
              className="h-8 w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-[11.5px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <select value={status} onChange={(event) => updateStatus(event.target.value)} className="h-8 min-w-[150px] rounded-md border border-[var(--border)] bg-white px-2.5 text-[11px] text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="documents_pending">Onboarding pending</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <details className="relative">
            <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-2.5 text-[10.5px] font-semibold text-[var(--text)] hover:bg-[#F8FAFD] [&::-webkit-details-marker]:hidden">☷ Columns</summary>
            <div className="absolute right-0 top-9 z-30 w-48 rounded-lg border border-[var(--border)] bg-white p-1.5 shadow-xl">
              {(Object.keys(columnLabels) as ColumnKey[]).map((column) => (
                <label key={column} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[10.5px] text-[var(--text)] hover:bg-[#F4F7FB]">
                  <input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => toggleColumn(column)} className="h-3 w-3" />
                  {columnLabels[column]}
                </label>
              ))}
            </div>
          </details>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] bg-white text-[15px] text-[var(--muted)] hover:bg-[#F8FAFD]" title="Refresh page" onClick={() => window.location.reload()}>↻</button>
          <Link href="/customers/new" className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--accent)] px-3 text-[10.5px] font-semibold text-white transition hover:bg-[var(--accent-strong)]">+ Add Customer</Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-[11px] text-[var(--text)]">
          <thead className="border-b border-[var(--border)] bg-[#F8FAFC] text-[9.5px] font-semibold uppercase tracking-[0.035em] text-[#647086]">
            <tr>
              <th className="w-9 px-2 py-2"><input type="checkbox" aria-label="Select all customers" className="h-3 w-3" /></th>
              {visibleColumns.includes("customer") ? <th className="px-2 py-2">Customer ↕</th> : null}
              {visibleColumns.includes("partner") ? <th className="px-2 py-2">Partner Type ↕</th> : null}
              {visibleColumns.includes("mobile") ? <th className="px-2 py-2">Mobile ↕</th> : null}
              {visibleColumns.includes("city") ? <th className="px-2 py-2">City ↕</th> : null}
              {visibleColumns.includes("fleet") ? <th className="px-2 py-2">Fleet</th> : null}
              {visibleColumns.includes("vehicles") ? <th className="px-2 py-2 text-center">Vehicles</th> : null}
              {visibleColumns.includes("status") ? <th className="px-2 py-2">Status</th> : null}
              <th className="w-11 px-2 py-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9EEF5] bg-white">
            {pageRows.map((customer) => (
              <tr key={customer.id} className="h-[42px] transition hover:bg-[#FAFCFF]">
                <td className="px-2 py-1.5"><input type="checkbox" aria-label={`Select ${customer.contact_name}`} className="h-3 w-3" /></td>
                {visibleColumns.includes("customer") ? <td className="px-2 py-1.5"><p className="font-semibold leading-4 text-[var(--text)]">{customer.contact_name}</p>{customer.company_name ? <p className="max-w-[220px] truncate text-[9.5px] leading-3 text-[#667286]">{customer.company_name}</p> : null}<p className="text-[9px] leading-3 text-[#8A96A7]">{customer.customer_code}</p></td> : null}
                {visibleColumns.includes("partner") ? <td className="px-2 py-1.5">{customer.partner_type ? partnerLabels[customer.partner_type] ?? customer.partner_type : "—"}</td> : null}
                {visibleColumns.includes("mobile") ? <td className="px-2 py-1.5 tabular-nums">{customer.phone}</td> : null}
                {visibleColumns.includes("city") ? <td className="px-2 py-1.5">{customer.city ?? "—"}</td> : null}
                {visibleColumns.includes("fleet") ? <td className="px-2 py-1.5">{customer.fleet_size_band ? fleetLabels[customer.fleet_size_band] ?? customer.fleet_size_band : "—"}</td> : null}
                {visibleColumns.includes("vehicles") ? <td className="px-2 py-1.5 text-center font-semibold">{customer.vehicles?.[0]?.count ?? 0}</td> : null}
                {visibleColumns.includes("status") ? <td className="px-2 py-1.5"><StatusPill status={customer.onboarding_status} /></td> : null}
                <td className="px-2 py-1.5 text-center">
                  <details className="relative inline-block text-left">
                    <summary className="grid h-6 w-6 cursor-pointer list-none place-items-center rounded-md text-[16px] font-bold text-[#617087] hover:bg-[#EDF3FA] [&::-webkit-details-marker]:hidden">⋮</summary>
                    <div className="absolute right-0 z-20 mt-1 w-32 rounded-lg border border-[var(--border)] bg-white p-1 shadow-xl">
                      <Link href={`/customers/${customer.id}/edit`} className="block rounded-md px-2 py-1.5 text-[10.5px] font-medium text-[var(--text)] hover:bg-[#F3F7FC]">View / Edit</Link>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!pageRows.length ? <div className="px-4 py-14 text-center"><p className="text-[12px] font-semibold text-[var(--text)]">No matching customers</p><p className="mt-1 text-[10.5px] text-[var(--muted)]">Adjust the search or status filter.</p></div> : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] px-3 py-2 text-[10px] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>Showing {pageRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}</p>
        <div className="flex items-center gap-1">
          <button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-7 rounded-md border border-[var(--border)] px-2.5 font-medium text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
          <span className="px-2 font-semibold text-[var(--text)]">{safePage} / {totalPages}</span>
          <button type="button" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-7 rounded-md border border-[var(--border)] px-2.5 font-medium text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40">Next</button>
        </div>
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === "active";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{active ? "Active" : status.replaceAll("_", " ")}</span>;
}
