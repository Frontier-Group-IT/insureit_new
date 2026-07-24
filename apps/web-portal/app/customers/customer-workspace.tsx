"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type CustomerRow = { id: string; customer_code: string; partner_type: string | null; company_name: string | null; contact_name: string; phone: string; city: string | null; fleet_size_band: string | null; onboarding_status: string; vehicles: { count: number }[] };
type ColumnKey = "customer" | "trade" | "partner" | "mobile" | "city" | "fleet" | "vehicles" | "status";
const partnerLabels: Record<string, string> = { individual_proprietor: "Individual / Proprietor", dealership: "Dealership", corporate: "Corporate", group: "Group", posp: "POSP", misp: "MISP" };
const fleetLabels: Record<string, string> = { less_than_5: "< 5", "5_to_20": "5–20", "20_to_50": "20–50", more_than_50: "> 50" };
const columnLabels: Record<ColumnKey, string> = { customer: "Customer Name", trade: "Legal Trade Name", partner: "Partner Type", mobile: "Mobile", city: "City", fleet: "Fleet", vehicles: "Vehicles", status: "Status" };
const PAGE_SIZE = 15;
const partnerOptions = [
  { value: "individual_proprietor", label: "Individual / Proprietor", description: "Owner, proprietor or individual fleet operator", available: true },
  { value: "dealership", label: "Dealership", description: "Vehicle dealer or service partner", available: true },
  { value: "corporate", label: "Corporate", description: "Registered company or enterprise fleet", available: true },
  { value: "group", label: "Group", description: "Multiple linked entities under one group", available: true }
];

export function CustomerWorkspace({ rows }: { rows: CustomerRow[] }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [partner, setPartner] = useState("all");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(Object.keys(columnLabels) as ColumnKey[]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [partnerModalOpen, setPartnerModalOpen] = useState(searchParams.get("choose_partner") === "1");

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = status === "all" || row.onboarding_status === status;
      const matchesPartner = partner === "all" || row.partner_type === partner;
      const haystack = [row.contact_name, row.company_name, row.phone, row.city, row.partner_type].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && matchesPartner && (!normalized || haystack.includes(normalized));
    });
  }, [partner, query, rows, status]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));
  const somePageSelected = pageRows.some((row) => selectedIds.has(row.id));

  function toggleRow(id: string) { setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleCurrentPage() { setSelectedIds((current) => { const next = new Set(current); pageRows.forEach((row) => allPageSelected ? next.delete(row.id) : next.add(row.id)); return next; }); }
  function exportSelected() {
    if (!selectedRows.length) return;
    const headings = ["Customer", "Legal Trade Name", "Partner Type", "Mobile", "City", "Fleet", "Status"];
    const lines = selectedRows.map((row) => [row.contact_name, row.company_name ?? "", row.partner_type ? partnerLabels[row.partner_type] ?? row.partner_type : "", row.phone, row.city ?? "", row.fleet_size_band ? fleetLabels[row.fleet_size_band] ?? row.fleet_size_band : "", row.onboarding_status]);
    const csv = [headings, ...lines].map((line) => line.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }
  async function copyMobiles() { if (!selectedRows.length) return; await navigator.clipboard.writeText(selectedRows.map((row) => row.phone).join("\n")); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }

  return (
    <>
      {partnerModalOpen ? <PartnerTypeModal onClose={() => setPartnerModalOpen(false)} /> : null}
      <section className="mx-auto max-w-[1440px] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 border-b border-[#E2E8F0] px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search customer, trade name, mobile or city" className="h-9 min-w-0 flex-1 rounded-md border border-[#CBD5E1] px-3 text-[11.5px] lg:max-w-md" />
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-9 min-w-[145px] rounded-md border border-[#CBD5E1] bg-white px-2.5 text-[11px]"><option value="all">All statuses</option><option value="active">Active</option><option value="documents_pending">KYC incomplete</option></select>
            <select value={partner} onChange={(event) => { setPartner(event.target.value); setPage(1); }} className="h-9 min-w-[175px] rounded-md border border-[#CBD5E1] bg-white px-2.5 text-[11px]"><option value="all">All partner types</option>{Object.entries(partnerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <Link href="/customers/applications" className="inline-flex h-9 items-center justify-center rounded-md border border-[#CBD5E1] bg-white px-3 text-[10.5px] font-semibold text-[#334155]">KYC Applications</Link>
            <button type="button" onClick={() => setPartnerModalOpen(true)} className="inline-flex h-9 items-center justify-center rounded-md bg-[#4F46E5] px-4 text-[11px] font-semibold text-white shadow-sm hover:bg-[#4338CA]">+ Add Customer</button>
          </div>
          <div className="flex items-center justify-end gap-2"><button type="button" disabled={!selectedRows.length} onClick={exportSelected} className="h-9 rounded-md border border-[#CBD5E1] bg-white px-3 text-[10.5px] font-semibold text-[#334155] disabled:opacity-40">Export</button><details className="relative"><summary className="flex h-9 cursor-pointer list-none items-center rounded-md border border-[#CBD5E1] bg-white px-3 text-[10.5px] font-semibold [&::-webkit-details-marker]:hidden">Columns</summary><div className="absolute right-0 top-10 z-30 w-52 rounded-lg border border-[#E2E8F0] bg-white p-1.5 shadow-xl">{(Object.keys(columnLabels) as ColumnKey[]).map((column) => <label key={column} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[10.5px] hover:bg-[#F8FAFC]"><input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => setVisibleColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column])} className="h-3.5 w-3.5" />{columnLabels[column]}</label>)}</div></details></div>
        </div>
        {selectedRows.length ? <div className="flex flex-wrap items-center gap-2 border-b border-[#D9E2EE] bg-[#EEF2FF] px-3 py-2 text-[10.5px]"><span className="mr-1 font-semibold text-[#312E81]">{selectedRows.length} selected</span>{selectedRows.length === 1 ? <><Link href={`/customers/${selectedRows[0].id}/edit`} className="rounded-md border border-[#C7D2FE] bg-white px-2.5 py-1 font-semibold">Open customer</Link><Link href={`/vehicles/new?customer_id=${selectedRows[0].id}`} className="rounded-md bg-[#4F46E5] px-2.5 py-1 font-semibold text-white">+ Add Vehicle</Link>{selectedRows[0].onboarding_status !== "active" ? <Link href={`/customers/${selectedRows[0].id}/edit#documents`} className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">Upload Documents</Link> : null}</> : null}<button type="button" onClick={copyMobiles} className="rounded-md border border-[#C7D2FE] bg-white px-2.5 py-1 font-semibold">{copied ? "Copied" : "Copy mobiles"}</button><button type="button" onClick={exportSelected} className="rounded-md border border-[#C7D2FE] bg-white px-2.5 py-1 font-semibold">Export CSV</button><button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto px-2 py-1 font-semibold text-[#64748B]">Clear</button></div> : null}
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full min-w-[1040px] table-fixed text-left text-[11px] text-[#1E293B]">
            <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#64748B]"><tr><th className="w-10 px-3 py-2.5"><input type="checkbox" checked={allPageSelected} ref={(element) => { if (element) element.indeterminate = somePageSelected && !allPageSelected; }} onChange={toggleCurrentPage} className="h-3.5 w-3.5" /></th>{visibleColumns.includes("customer") ? <th className="w-[180px] px-3 py-2.5">Customer Name</th> : null}{visibleColumns.includes("trade") ? <th className="w-[180px] px-3 py-2.5">Legal Trade Name</th> : null}{visibleColumns.includes("partner") ? <th className="w-[150px] px-3 py-2.5">Partner Type</th> : null}{visibleColumns.includes("mobile") ? <th className="w-[135px] px-3 py-2.5">Mobile</th> : null}{visibleColumns.includes("city") ? <th className="w-[100px] px-3 py-2.5">City</th> : null}{visibleColumns.includes("fleet") ? <th className="w-[70px] px-3 py-2.5">Fleet</th> : null}{visibleColumns.includes("vehicles") ? <th className="w-[70px] px-3 py-2.5 text-center">Vehicles</th> : null}{visibleColumns.includes("status") ? <th className="w-[112px] px-3 py-2.5">Status</th> : null}<th className="w-[72px] px-3 py-2.5 text-center">Action</th></tr></thead>
            <tbody className="divide-y divide-[#EEF2F6]">{pageRows.map((customer) => <tr key={customer.id} className={`h-12 ${selectedIds.has(customer.id) ? "bg-[#F5F3FF]" : "hover:bg-[#FAFCFF]"}`}><td className="px-3"><input type="checkbox" checked={selectedIds.has(customer.id)} onChange={() => toggleRow(customer.id)} className="h-3.5 w-3.5" /></td>{visibleColumns.includes("customer") ? <td className="px-3"><Link href={`/customers/${customer.id}/edit`} className="block truncate text-[12px] font-semibold text-[#0F172A] hover:text-[#4F46E5]">{customer.contact_name}</Link></td> : null}{visibleColumns.includes("trade") ? <td className="px-3"><span className="block truncate text-[#475569]">{customer.company_name ?? "—"}</span></td> : null}{visibleColumns.includes("partner") ? <td className="px-3">{customer.partner_type ? partnerLabels[customer.partner_type] ?? customer.partner_type : "—"}</td> : null}{visibleColumns.includes("mobile") ? <td className="px-3 tabular-nums">{customer.phone}</td> : null}{visibleColumns.includes("city") ? <td className="px-3">{customer.city ?? "—"}</td> : null}{visibleColumns.includes("fleet") ? <td className="px-3">{customer.fleet_size_band ? fleetLabels[customer.fleet_size_band] ?? customer.fleet_size_band : "—"}</td> : null}{visibleColumns.includes("vehicles") ? <td className="px-3 text-center font-semibold">{customer.vehicles?.[0]?.count ?? 0}</td> : null}{visibleColumns.includes("status") ? <td className="px-3"><StatusPill status={customer.onboarding_status} /></td> : null}<td className="px-3 text-center"><details className="relative inline-block"><summary className="grid h-7 w-7 cursor-pointer list-none place-items-center rounded-md text-[16px] font-bold hover:bg-[#EEF2F7] [&::-webkit-details-marker]:hidden">⋮</summary><div className="absolute right-0 z-30 mt-1 w-40 rounded-lg border border-[#E2E8F0] bg-white p-1 shadow-xl"><Link href={`/customers/${customer.id}/edit`} className="block rounded-md px-2 py-1.5 hover:bg-[#F8FAFC]">View / Edit</Link>{customer.onboarding_status !== "active" ? <Link href={`/customers/${customer.id}/edit#documents`} className="block rounded-md px-2 py-1.5 font-medium text-amber-700 hover:bg-amber-50">Upload Documents</Link> : null}<Link href={`/vehicles/new?customer_id=${customer.id}`} className="block rounded-md px-2 py-1.5 hover:bg-[#F8FAFC]">Add Vehicle</Link></div></details></td></tr>)}</tbody>
          </table>
          {!pageRows.length ? <div className="px-4 py-16 text-center"><p className="text-[12px] font-semibold text-[#334155]">No matching customers</p><p className="mt-1 text-[10.5px] text-[#94A3B8]">Adjust the search or filters.</p></div> : null}
        </div>
        <div className="flex items-center justify-between border-t border-[#E2E8F0] px-3 py-2.5 text-[10px] text-[#64748B]"><p>Showing {pageRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}</p><div className="flex items-center gap-1"><button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-7 rounded-md border border-[#CBD5E1] px-2.5 disabled:opacity-40">Previous</button><span className="px-2 font-semibold">{safePage} / {totalPages}</span><button type="button" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-7 rounded-md border border-[#CBD5E1] px-2.5 disabled:opacity-40">Next</button></div></div>
      </section>
    </>
  );
}

function PartnerTypeModal({ onClose }: { onClose: () => void }) { return <div className="fixed inset-0 z-[120] grid place-items-center bg-[#0F172A]/35 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true"><div className="w-full max-w-[720px] rounded-2xl border border-white/60 bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.28)]"><div className="flex items-start justify-between gap-4"><h3 className="text-[18px] font-semibold text-[#0F172A]">Select partner type</h3><button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md border border-[#E2E8F0] text-[#64748B]">×</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{partnerOptions.map((option) => option.available ? <a key={option.value} href={`/customers/new?partner_type=${option.value}`} className="group rounded-xl border border-[#CBD5E1] p-4 transition hover:border-[#6366F1] hover:bg-[#F8FAFF]"><div className="flex items-center justify-between"><p className="text-[13px] font-semibold text-[#0F172A]">{option.label}</p><span className="text-[#4F46E5]">→</span></div><p className="mt-1 text-[10.5px] leading-4 text-[#64748B]">{option.description}</p></a> : <button key={option.value} type="button" disabled className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-left opacity-75"><div className="flex items-center justify-between"><p className="text-[13px] font-semibold text-[#475569]">{option.label}</p><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">Coming soon</span></div><p className="mt-1 text-[10.5px] leading-4 text-[#94A3B8]">{option.description}</p></button>)}</div></div></div>; }
function StatusPill({ status }: { status: string }) { const active = status === "active"; return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />{active ? "Active" : "KYC incomplete"}</span>; }
function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }
