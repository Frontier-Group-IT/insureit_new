"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileCheck2, MapPin, MoreVertical, Phone, Plus, SlidersHorizontal, Truck, X } from "lucide-react";

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
  { value: "group", label: "Group", description: "Multiple linked entities under one group", available: true },
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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const activeFilterCount = Number(status !== "all") + Number(partner !== "all");

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
      {filtersOpen ? <MobileFilterSheet status={status} partner={partner} onStatusChange={(value) => { setStatus(value); setPage(1); }} onPartnerChange={(value) => { setPartner(value); setPage(1); }} onClear={() => { setStatus("all"); setPartner("all"); setPage(1); }} onClose={() => setFiltersOpen(false)} /> : null}

      <section className="mx-auto max-w-[1440px] overflow-hidden rounded-[22px] border border-[#E2E8F0] bg-white/94 shadow-[0_18px_55px_rgba(39,51,89,.08)]">
        <div className="border-b border-[#E2E8F0] p-3 sm:p-4">
          <div className="flex gap-2">
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search customer, trade name, mobile or city" aria-label="Search customers" className="h-11 min-w-0 flex-1 rounded-xl border border-[#CBD5E1] px-3 text-[14px] md:max-w-md" />
            <button type="button" onClick={() => setFiltersOpen(true)} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#CBD5E1] bg-white text-[#334155] md:hidden" aria-label="Open customer filters"><SlidersHorizontal className="h-4.5 w-4.5" />{activeFilterCount ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#6759ff] px-1 text-[9px] font-bold text-white">{activeFilterCount}</span> : null}</button>
            <button type="button" onClick={() => setPartnerModalOpen(true)} className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#6759ff] to-[#17bfc5] px-3 text-[12px] font-bold text-white shadow-[0_10px_24px_rgba(103,89,255,.24)]"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add Customer</span></button>
          </div>

          <div className="mt-3 hidden items-center gap-2 md:flex">
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 min-w-[145px] rounded-xl border border-[#CBD5E1] bg-white px-2.5 text-[12px]"><option value="all">All statuses</option><option value="active">Active</option><option value="documents_pending">KYC incomplete</option></select>
            <select value={partner} onChange={(event) => { setPartner(event.target.value); setPage(1); }} className="h-10 min-w-[175px] rounded-xl border border-[#CBD5E1] bg-white px-2.5 text-[12px]"><option value="all">All partner types</option>{Object.entries(partnerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <Link href="/customers/applications" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold text-[#334155]"><FileCheck2 className="h-4 w-4" />KYC Applications</Link>
            <div className="ml-auto flex items-center gap-2"><button type="button" disabled={!selectedRows.length} onClick={exportSelected} className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold text-[#334155] disabled:opacity-40">Export</button><details className="relative"><summary className="flex h-10 cursor-pointer list-none items-center rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold [&::-webkit-details-marker]:hidden">Columns</summary><div className="absolute right-0 top-11 z-30 w-52 rounded-xl border border-[#E2E8F0] bg-white p-1.5 shadow-xl">{(Object.keys(columnLabels) as ColumnKey[]).map((column) => <label key={column} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] hover:bg-[#F8FAFC]"><input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => setVisibleColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column])} className="h-4 w-4" />{columnLabels[column]}</label>)}</div></details></div>
          </div>
        </div>

        {selectedRows.length ? <div className="mobile-sticky-actions flex flex-wrap items-center gap-2 border-b border-[#D9E2EE] bg-[#EEF2FF] px-3 py-2.5 text-[11px]"><span className="mr-1 font-semibold text-[#312E81]">{selectedRows.length} selected</span>{selectedRows.length === 1 ? <><Link href={`/customers/${selectedRows[0].id}/edit`} className="rounded-lg border border-[#C7D2FE] bg-white px-3 py-2 font-semibold">Open</Link><Link href={`/vehicles/new?customer_id=${selectedRows[0].id}`} className="rounded-lg bg-[#4F46E5] px-3 py-2 font-semibold text-white">Add Vehicle</Link></> : null}<button type="button" onClick={copyMobiles} className="rounded-lg border border-[#C7D2FE] bg-white px-3 py-2 font-semibold">{copied ? "Copied" : "Copy mobiles"}</button><button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto px-2 py-2 font-semibold text-[#64748B]">Clear</button></div> : null}

        <div className="mobile-card-list p-3 md:hidden">
          {pageRows.map((customer) => <CustomerMobileCard key={customer.id} customer={customer} selected={selectedIds.has(customer.id)} onToggle={() => toggleRow(customer.id)} />)}
          {!pageRows.length ? <EmptyCustomers /> : null}
        </div>

        <div className="hidden overflow-x-auto overflow-y-visible md:block">
          <table className="w-full min-w-[1040px] table-fixed text-left text-[11px] text-[#1E293B]">
            <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[#64748B]"><tr><th className="w-10 px-3 py-2.5"><input aria-label="Select all customers on this page" type="checkbox" checked={allPageSelected} ref={(element) => { if (element) element.indeterminate = somePageSelected && !allPageSelected; }} onChange={toggleCurrentPage} className="h-4 w-4" /></th>{visibleColumns.includes("customer") ? <th className="w-[180px] px-3 py-2.5">Customer Name</th> : null}{visibleColumns.includes("trade") ? <th className="w-[180px] px-3 py-2.5">Legal Trade Name</th> : null}{visibleColumns.includes("partner") ? <th className="w-[150px] px-3 py-2.5">Partner Type</th> : null}{visibleColumns.includes("mobile") ? <th className="w-[135px] px-3 py-2.5">Mobile</th> : null}{visibleColumns.includes("city") ? <th className="w-[100px] px-3 py-2.5">City</th> : null}{visibleColumns.includes("fleet") ? <th className="w-[70px] px-3 py-2.5">Fleet</th> : null}{visibleColumns.includes("vehicles") ? <th className="w-[70px] px-3 py-2.5 text-center">Vehicles</th> : null}{visibleColumns.includes("status") ? <th className="w-[112px] px-3 py-2.5">Status</th> : null}<th className="w-[72px] px-3 py-2.5 text-center">Action</th></tr></thead>
            <tbody className="divide-y divide-[#EEF2F6]">{pageRows.map((customer) => <tr key={customer.id} className={`h-12 ${selectedIds.has(customer.id) ? "bg-[#F5F3FF]" : "hover:bg-[#FAFCFF]"}`}><td className="px-3"><input aria-label={`Select ${customer.contact_name}`} type="checkbox" checked={selectedIds.has(customer.id)} onChange={() => toggleRow(customer.id)} className="h-4 w-4" /></td>{visibleColumns.includes("customer") ? <td className="px-3"><Link href={`/customers/${customer.id}/edit`} className="block truncate text-[12px] font-semibold text-[#0F172A] hover:text-[#4F46E5]">{customer.contact_name}</Link></td> : null}{visibleColumns.includes("trade") ? <td className="px-3"><span className="block truncate text-[#475569]">{customer.company_name ?? "—"}</span></td> : null}{visibleColumns.includes("partner") ? <td className="px-3">{customer.partner_type ? partnerLabels[customer.partner_type] ?? customer.partner_type : "—"}</td> : null}{visibleColumns.includes("mobile") ? <td className="px-3 tabular-nums">{customer.phone}</td> : null}{visibleColumns.includes("city") ? <td className="px-3">{customer.city ?? "—"}</td> : null}{visibleColumns.includes("fleet") ? <td className="px-3">{customer.fleet_size_band ? fleetLabels[customer.fleet_size_band] ?? customer.fleet_size_band : "—"}</td> : null}{visibleColumns.includes("vehicles") ? <td className="px-3 text-center font-semibold">{customer.vehicles?.[0]?.count ?? 0}</td> : null}{visibleColumns.includes("status") ? <td className="px-3"><StatusPill status={customer.onboarding_status} /></td> : null}<td className="px-3 text-center"><details className="relative inline-block"><summary aria-label={`Actions for ${customer.contact_name}`} className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl hover:bg-[#EEF2F7] [&::-webkit-details-marker]:hidden"><MoreVertical className="h-4 w-4" /></summary><div className="absolute right-0 z-30 mt-1 w-40 rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-xl"><Link href={`/customers/${customer.id}/edit`} className="block rounded-lg px-2 py-2 hover:bg-[#F8FAFC]">View / Edit</Link>{customer.onboarding_status !== "active" ? <Link href={`/customers/${customer.id}/edit#documents`} className="block rounded-lg px-2 py-2 font-medium text-amber-700 hover:bg-amber-50">Upload Documents</Link> : null}<Link href={`/vehicles/new?customer_id=${customer.id}`} className="block rounded-lg px-2 py-2 hover:bg-[#F8FAFC]">Add Vehicle</Link></div></details></td></tr>)}</tbody>
          </table>
          {!pageRows.length ? <EmptyCustomers /> : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-[#E2E8F0] px-3 py-3 text-[11px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between"><p>Showing {pageRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}</p><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"><button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-11 rounded-xl border border-[#CBD5E1] px-3 font-semibold disabled:opacity-40">Previous</button><span className="px-1 font-semibold">{safePage} / {totalPages}</span><button type="button" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-11 rounded-xl border border-[#CBD5E1] px-3 font-semibold disabled:opacity-40">Next</button></div></div>
      </section>
    </>
  );
}

function CustomerMobileCard({ customer, selected, onToggle }: { customer: CustomerRow; selected: boolean; onToggle: () => void }) {
  return <article className={`mobile-record-card ${selected ? "border-[#8b7fff] bg-[#f7f5ff]" : ""}`}><div className="flex items-start gap-3"><input aria-label={`Select ${customer.contact_name}`} type="checkbox" checked={selected} onChange={onToggle} className="mt-1 h-5 w-5 shrink-0" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><Link href={`/customers/${customer.id}/edit`} className="block truncate text-[15px] font-extrabold text-[#12203B]">{customer.contact_name}</Link><p className="mt-0.5 truncate text-[12px] text-[#66748A]">{customer.company_name ?? customer.customer_code}</p></div><StatusPill status={customer.onboarding_status} /></div><div className="mt-3 grid gap-2 text-[12px] text-[#53627A]"><a href={`tel:${customer.phone}`} className="flex min-h-10 items-center gap-2 rounded-xl bg-[#f7f9fc] px-3"><Phone className="h-4 w-4 text-[#6759ff]" /><span className="font-semibold tabular-nums">{customer.phone}</span></a><div className="grid grid-cols-2 gap-2"><span className="flex min-h-10 items-center gap-2 rounded-xl bg-[#f7f9fc] px-3"><MapPin className="h-4 w-4 text-[#17aeb3]" /><span className="truncate">{customer.city ?? "Location not set"}</span></span><span className="flex min-h-10 items-center gap-2 rounded-xl bg-[#f7f9fc] px-3"><Truck className="h-4 w-4 text-[#e59a22]" /><span>{customer.vehicles?.[0]?.count ?? 0} vehicles</span></span></div></div><div className="mt-3 grid grid-cols-2 gap-2"><Link href={`/customers/${customer.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#111a35] px-3 text-[12px] font-bold text-white">Open customer</Link><Link href={`/vehicles/new?customer_id=${customer.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d8d2ff] bg-[#f4f1ff] px-3 text-[12px] font-bold text-[#5b4ce5]">Add vehicle</Link></div></div></div></article>;
}

function MobileFilterSheet({ status, partner, onStatusChange, onPartnerChange, onClear, onClose }: { status: string; partner: string; onStatusChange: (value: string) => void; onPartnerChange: (value: string) => void; onClear: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-[120] md:hidden" role="dialog" aria-modal="true" aria-label="Customer filters"><button className="absolute inset-0 bg-[#081127]/60 backdrop-blur-sm" onClick={onClose} aria-label="Close filters" /><div className="mobile-safe-bottom absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white p-4 shadow-[0_-24px_70px_rgba(16,24,40,.24)]"><div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#d8deea]" /><div className="flex items-center justify-between"><h2 className="text-[18px] font-extrabold text-[#12203B]">Filter customers</h2><button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f2f4f8]" aria-label="Close filters"><X className="h-5 w-5" /></button></div><div className="mt-4 space-y-4"><label className="block text-[13px] font-bold text-[#334155]">Status<select value={status} onChange={(event) => onStatusChange(event.target.value)} className="mt-1.5 w-full"><option value="all">All statuses</option><option value="active">Active</option><option value="documents_pending">KYC incomplete</option></select></label><label className="block text-[13px] font-bold text-[#334155]">Partner type<select value={partner} onChange={(event) => onPartnerChange(event.target.value)} className="mt-1.5 w-full"><option value="all">All partner types</option>{Object.entries(partnerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={onClear} className="h-12 rounded-2xl border border-[#d8deea] bg-white text-[13px] font-bold text-[#53627A]">Clear all</button><button type="button" onClick={onClose} className="h-12 rounded-2xl bg-gradient-to-r from-[#6759ff] to-[#17bfc5] text-[13px] font-bold text-white">Apply filters</button></div></div></div>;
}

function PartnerTypeModal({ onClose }: { onClose: () => void }) { return <div className="fixed inset-0 z-[120] grid place-items-center bg-[#0F172A]/45 px-3 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-label="Select partner type"><div className="max-h-[88vh] w-full max-w-[720px] overflow-y-auto rounded-[24px] border border-white/60 bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.28)] sm:p-5"><div className="flex items-start justify-between gap-4"><h3 className="text-[18px] font-semibold text-[#0F172A]">Select partner type</h3><button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-xl border border-[#E2E8F0] text-[#64748B]" aria-label="Close partner selection"><X className="h-5 w-5" /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{partnerOptions.map((option) => option.available ? <a key={option.value} href={`/customers/new?partner_type=${option.value}`} className="group min-h-[112px] rounded-2xl border border-[#CBD5E1] p-4 transition hover:border-[#6366F1] hover:bg-[#F8FAFF]"><div className="flex items-center justify-between"><p className="text-[14px] font-semibold text-[#0F172A]">{option.label}</p><span className="text-[#4F46E5]">→</span></div><p className="mt-1 text-[12px] leading-5 text-[#64748B]">{option.description}</p></a> : null)}</div></div></div>; }
function StatusPill({ status }: { status: string }) { const active = status === "active"; return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />{active ? "Active" : "KYC incomplete"}</span>; }
function EmptyCustomers() { return <div className="px-4 py-14 text-center"><p className="text-[14px] font-semibold text-[#334155]">No matching customers</p><p className="mt-1 text-[12px] text-[#94A3B8]">Adjust the search or filters.</p></div>; }
function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }
