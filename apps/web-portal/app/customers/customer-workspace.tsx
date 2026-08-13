"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Download, FileCheck2, MapPin, MoreVertical, Phone, Plus, ShieldCheck, Truck, X } from "lucide-react";
import {
  BrokerRegisterShell,
  BrokerRegisterToolbar,
  RegisterEmpty,
  RegisterPagination,
  RegisterSelect,
  RegisterStatusPill,
  RegisterViewTabs
} from "@/components/broker-register";

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
  policies: { count: number }[];
  claims: { count: number }[];
};

type ViewKey = "all" | "active" | "kyc" | "fleet" | "claims";

const PAGE_SIZE = 15;
const partnerLabels: Record<string, string> = {
  individual_proprietor: "Individual / Proprietor",
  dealership: "Dealership",
  corporate: "Corporate",
  group: "Group",
  posp: "POSP",
  misp: "MISP"
};
const fleetLabels: Record<string, string> = { less_than_5: "< 5", "5_to_20": "5-20", "20_to_50": "20-50", more_than_50: "> 50" };
const partnerOptions = [
  { value: "individual_proprietor", label: "Individual / Proprietor", description: "Owner, proprietor or individual fleet operator", available: true },
  { value: "dealership", label: "Dealership", description: "Vehicle dealer or service partner", available: true },
  { value: "corporate", label: "Corporate", description: "Registered company or enterprise fleet", available: true },
  { value: "group", label: "Group", description: "Multiple linked entities under one group", available: true }
];

export function CustomerWorkspace({ rows }: { rows: CustomerRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [partner, setPartner] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const partnerModalOpen = searchParams.get("choose_partner") === "1";

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.onboarding_status === "active").length;
    const kyc = rows.length - active;
    const fleet = rows.filter((row) => vehicleCount(row) >= 5).length;
    const claims = rows.reduce((total, row) => total + claimCount(row), 0);
    return { active, kyc, fleet, claims };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesPartner = partner === "all" || row.partner_type === partner;
      const matchesView =
        view === "all" ||
        (view === "active" && row.onboarding_status === "active") ||
        (view === "kyc" && row.onboarding_status !== "active") ||
        (view === "fleet" && vehicleCount(row) >= 5) ||
        (view === "claims" && claimCount(row) > 0);
      const haystack = [row.customer_code, row.contact_name, row.company_name, row.phone, row.city, row.partner_type].filter(Boolean).join(" ").toLowerCase();
      return matchesPartner && matchesView && (!normalized || haystack.includes(normalized));
    });
  }, [partner, query, rows, view]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));
  const somePageSelected = pageRows.some((row) => selectedIds.has(row.id));

  function setViewAndReset(next: string) {
    setView(next as ViewKey);
    setPage(1);
  }
  function openPartnerModal() {
    router.push("/customers?choose_partner=1");
  }
  function closePartnerModal() {
    router.push("/customers");
  }
  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    const headings = ["Customer", "Code", "Legal Trade Name", "Partner Type", "Mobile", "City", "Fleet", "Vehicles", "Policies", "Claims", "Status"];
    const lines = selectedRows.map((row) => [row.contact_name, row.customer_code, row.company_name ?? "", row.partner_type ? partnerLabels[row.partner_type] ?? row.partner_type : "", row.phone, row.city ?? "", row.fleet_size_band ? fleetLabels[row.fleet_size_band] ?? row.fleet_size_band : "", String(vehicleCount(row)), String(policyCount(row)), String(claimCount(row)), statusLabel(row.onboarding_status)]);
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
    <>
      {partnerModalOpen ? <PartnerTypeModal onClose={closePartnerModal} /> : null}
      <BrokerRegisterShell
        eyebrow="Master register"
        title="Customer Portfolio"
        description="Scan customer quality, fleet depth, policy coverage and claim exposure from one operational register."
        icon={<Building2 className="h-5 w-5" />}
        metrics={[
          { label: "Customers", value: rows.length, hint: "Accessible records", tone: "navy" },
          { label: "Active", value: stats.active, hint: "KYC complete", tone: "green" },
          { label: "KYC gaps", value: stats.kyc, hint: "Need attention", tone: stats.kyc ? "amber" : "slate" },
          { label: "Open claims", value: stats.claims, hint: "Linked exposure", tone: stats.claims ? "red" : "slate" }
        ]}
      >
        <BrokerRegisterToolbar
          query={query}
          onQueryChange={(value) => { setQuery(value); setPage(1); }}
          searchPlaceholder="Search customer, code, trade name, mobile or city"
          activeViewLabel={`${filteredRows.length} in current view`}
          action={<button type="button" onClick={openPartnerModal} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.22)]"><Plus className="h-4 w-4" />Add Customer</button>}
        >
          <RegisterViewTabs
            value={view}
            onChange={setViewAndReset}
            options={[
              { value: "all", label: "All", count: rows.length },
              { value: "active", label: "Active", count: stats.active },
              { value: "kyc", label: "KYC gaps", count: stats.kyc },
              { value: "fleet", label: "Fleet", count: stats.fleet },
              { value: "claims", label: "Claims", count: rows.filter((row) => claimCount(row) > 0).length }
            ]}
          />
          <RegisterSelect value={partner} onChange={(value) => { setPartner(value); setPage(1); }} label="Partner type">
            <option value="all">All partner types</option>
            {Object.entries(partnerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </RegisterSelect>
          <Link href="/customers/applications" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10.5px] font-semibold text-[#334155]"><FileCheck2 className="h-4 w-4" />KYC Applications</Link>
        </BrokerRegisterToolbar>

        {selectedRows.length ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#D9E2EE] bg-[#EEF2FF] px-3 py-2.5 text-[11px]">
            <span className="mr-1 font-semibold text-[#312E81]">{selectedRows.length} selected</span>
            {selectedRows.length === 1 ? <Link href={`/customers/${selectedRows[0].id}/edit`} className="rounded-lg border border-[#C7D2FE] bg-white px-3 py-2 font-semibold">Open</Link> : null}
            <button type="button" onClick={copyMobiles} className="rounded-lg border border-[#C7D2FE] bg-white px-3 py-2 font-semibold">{copied ? "Copied" : "Copy mobiles"}</button>
            <button type="button" onClick={exportSelected} className="inline-flex items-center gap-1 rounded-lg border border-[#C7D2FE] bg-white px-3 py-2 font-semibold"><Download className="h-3.5 w-3.5" />Export</button>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto px-2 py-2 font-semibold text-[#64748B]">Clear</button>
          </div>
        ) : null}

        <div className="mobile-card-list p-3 md:hidden">
          {pageRows.map((customer) => <CustomerMobileCard key={customer.id} customer={customer} selected={selectedIds.has(customer.id)} onToggle={() => toggleRow(customer.id)} />)}
          {!pageRows.length ? <RegisterEmpty title="No matching customers" description="Adjust the search, partner type or saved view." /> : null}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] table-fixed text-left text-[11px] text-[#1E293B]">
            <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
              <tr>
                <th className="w-9 px-2.5 py-2.5"><input aria-label="Select all customers on this page" type="checkbox" checked={allPageSelected} ref={(element) => { if (element) element.indeterminate = somePageSelected && !allPageSelected; }} onChange={toggleCurrentPage} className="h-4 w-4" /></th>
                <th className="w-[240px] px-2.5 py-2.5">Customer</th>
                <th className="w-[190px] px-2.5 py-2.5">Type / location</th>
                <th className="w-[145px] px-2.5 py-2.5">Mobile</th>
                <th className="w-[126px] px-2.5 py-2.5">Status</th>
                <th className="w-[160px] px-2.5 py-2.5">Next action</th>
                <th className="w-[60px] px-2.5 py-2.5 text-center">More</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2F6]">
              {pageRows.map((customer) => (
                <tr key={customer.id} className={`h-11 ${selectedIds.has(customer.id) ? "bg-[#F5F3FF]" : "hover:bg-[#FAFCFF]"}`}>
                  <td className="px-2.5"><input aria-label={`Select ${customer.contact_name}`} type="checkbox" checked={selectedIds.has(customer.id)} onChange={() => toggleRow(customer.id)} className="h-4 w-4" /></td>
                  <td className="px-2.5">
                    <Link href={`/customers/${customer.id}/edit`} className="block truncate text-[12.5px] font-bold text-[#0F172A] hover:text-[#17365D]">{customer.contact_name}</Link>
                  </td>
                  <td className="px-2.5">
                    <p className="truncate font-semibold text-[#334155]">{customer.partner_type ? partnerLabels[customer.partner_type] ?? customer.partner_type : "Not classified"}</p>
                    <p className="mt-0.5 truncate text-[9.5px] text-[#64748B]">{customer.city ?? "Location not set"}</p>
                  </td>
                  <td className="px-2.5 tabular-nums">{customer.phone}</td>
                  <td className="px-2.5"><CustomerStatus status={customer.onboarding_status} /></td>
                  <td className="px-2.5"><NextAction customer={customer} /></td>
                  <td className="px-2.5 text-center"><RowActions customer={customer} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pageRows.length ? <RegisterEmpty title="No matching customers" description="Adjust the search, partner type or saved view." /> : null}
        </div>

        <RegisterPagination pageRows={pageRows.length} filteredRows={filteredRows.length} safePage={safePage} totalPages={totalPages} pageSize={PAGE_SIZE} onPrevious={() => setPage((current) => Math.max(1, current - 1))} onNext={() => setPage((current) => Math.min(totalPages, current + 1))} />
      </BrokerRegisterShell>
    </>
  );
}

function CustomerMobileCard({ customer, selected, onToggle }: { customer: CustomerRow; selected: boolean; onToggle: () => void }) {
  return (
    <article className={`mobile-record-card ${selected ? "border-[#8b7fff] bg-[#f7f5ff]" : ""}`}>
      <div className="flex items-start gap-3">
        <input aria-label={`Select ${customer.contact_name}`} type="checkbox" checked={selected} onChange={onToggle} className="mt-1 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={`/customers/${customer.id}/edit`} className="block truncate text-[15px] font-extrabold text-[#12203B]">{customer.contact_name}</Link>
              <p className="mt-0.5 truncate text-[12px] text-[#66748A]">{customer.company_name ?? customer.customer_code}</p>
            </div>
            <CustomerStatus status={customer.onboarding_status} />
          </div>
          <div className="mt-3 grid gap-2 text-[12px] text-[#53627A]">
            <a href={`tel:${customer.phone}`} className="flex min-h-10 items-center gap-2 rounded-xl bg-[#f7f9fc] px-3"><Phone className="h-4 w-4 text-[#17365D]" /><span className="font-semibold tabular-nums">{customer.phone}</span></a>
            <div className="grid grid-cols-2 gap-2">
              <span className="flex min-h-10 items-center gap-2 rounded-xl bg-[#f7f9fc] px-3"><MapPin className="h-4 w-4 text-[#0E7490]" /><span className="truncate">{customer.city ?? "Location not set"}</span></span>
              <span className="flex min-h-10 items-center gap-2 rounded-xl bg-[#f7f9fc] px-3"><Truck className="h-4 w-4 text-[#B45309]" /><span>{vehicleCount(customer)} vehicles</span></span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <span className="rounded-xl bg-[#f7f9fc] px-3 py-2 font-semibold">{policyCount(customer)} policies</span>
              <span className="rounded-xl bg-[#f7f9fc] px-3 py-2 font-semibold">{claimCount(customer)} claims</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={`/customers/${customer.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#111a35] px-3 text-[12px] font-bold text-white">Open customer</Link>
            <Link href={`/vehicles/new?customer_id=${customer.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#BFD3F7] bg-[#F0F6FF] px-3 text-[12px] font-bold text-[#174EA6]">Add vehicle</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function PartnerTypeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-[#0F172A]/45 px-3 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-label="Select partner type">
      <div className="max-h-[88vh] w-full max-w-[720px] overflow-y-auto rounded-[20px] border border-white/60 bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.28)] sm:p-5">
        <div className="flex items-start justify-between gap-4"><h3 className="text-[18px] font-semibold text-[#0F172A]">Select partner type</h3><button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-xl border border-[#E2E8F0] text-[#64748B]" aria-label="Close partner selection"><X className="h-5 w-5" /></button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{partnerOptions.map((option) => option.available ? <a key={option.value} href={`/customers/new?partner_type=${option.value}`} className="group min-h-[112px] rounded-xl border border-[#CBD5E1] p-4 transition hover:border-[#17365D] hover:bg-[#F8FAFF]"><div className="flex items-center justify-between"><p className="text-[14px] font-semibold text-[#0F172A]">{option.label}</p><span className="text-[#17365D]">-&gt;</span></div><p className="mt-1 text-[12px] leading-5 text-[#64748B]">{option.description}</p></a> : null)}</div>
      </div>
    </div>
  );
}

function RowActions({ customer }: { customer: CustomerRow }) {
  return (
    <details className="relative inline-block">
      <summary aria-label={`Actions for ${customer.contact_name}`} className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-lg hover:bg-[#EEF2F7] [&::-webkit-details-marker]:hidden"><MoreVertical className="h-4 w-4" /></summary>
      <div className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-[#E2E8F0] bg-white p-1 shadow-xl">
        <Link href={`/customers/${customer.id}/edit`} className="block rounded-lg px-2 py-2 hover:bg-[#F8FAFC]">View / Edit</Link>
        {customer.onboarding_status !== "active" ? <Link href={`/customers/${customer.id}/edit#documents`} className="block rounded-lg px-2 py-2 font-medium text-amber-700 hover:bg-amber-50">Upload Documents</Link> : null}
        <Link href={`/vehicles/new?customer_id=${customer.id}`} className="block rounded-lg px-2 py-2 hover:bg-[#F8FAFC]">Add Vehicle</Link>
      </div>
    </details>
  );
}

function CustomerStatus({ status }: { status: string }) {
  return status === "active" ? <RegisterStatusPill tone="green">Active</RegisterStatusPill> : <RegisterStatusPill tone="amber">KYC incomplete</RegisterStatusPill>;
}

function NextAction({ customer }: { customer: CustomerRow }) {
  if (customer.onboarding_status !== "active") return <Link href={`/customers/${customer.id}/edit#documents`} className="font-bold text-amber-700 hover:underline">Complete KYC</Link>;
  if (vehicleCount(customer) === 0) return <Link href={`/vehicles/new?customer_id=${customer.id}`} className="font-bold text-[#174EA6] hover:underline">Add vehicle</Link>;
  if (policyCount(customer) === 0) return <Link href="/policies/new" className="font-bold text-[#174EA6] hover:underline">Add policy</Link>;
  return <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />Portfolio active</span>;
}

function CountCell({ value, hint, warn = false }: { value: number; hint: string; warn?: boolean }) {
  return <div><p className={`text-[13px] font-bold tabular-nums ${warn ? "text-rose-700" : "text-[#0F172A]"}`}>{value}</p><p className="mt-0.5 text-[8.5px] text-[#94A3B8]">{hint}</p></div>;
}
function vehicleCount(row: CustomerRow) { return row.vehicles?.[0]?.count ?? 0; }
function policyCount(row: CustomerRow) { return row.policies?.[0]?.count ?? 0; }
function claimCount(row: CustomerRow) { return row.claims?.[0]?.count ?? 0; }
function statusLabel(status: string) { return status === "active" ? "Active" : "KYC incomplete"; }
function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }
