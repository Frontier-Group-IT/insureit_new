"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, Search } from "lucide-react";
import { IntermediaryTabs } from "./intermediary-tabs";
import { FormSubmitButton } from "@/components/form-submit-button";
import { FreshAccountReviewLink } from "./applications/account-review-back-link";
import { createLinkedIntermediaryAccount } from "./applications/[id]/account-review-actions";
import { WorkflowSuccessToast } from "./applications/workflow-success-toast";
import { PermanentDeleteButton } from "@/components/permanent-delete-button";

export type PartnerRegisterRow = {
  id: string;
  applicationId: string;
  partnerRecordId: string | null;
  displayName: string;
  mobile: string;
  partnerId: string;
  accountType: string;
  assignedRm: string;
  onboardingDate: string;
  linkedLabel: string;
  linkedHref: string | null;
  portalAccess: string;
  partnerStatus: string;
  customerCount: number | null;
  netPremium: number | null;
  payout: number | null;
  active: boolean;
  createType: "posp" | "misp";
  canCreateLinked: boolean;
  searchText: string;
};

type PartnerFilter = "" | "all" | "active" | "onboarding";

const PARTNER_PAGE_SIZE = 10;
const partnerActionBaseClassName = "inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border bg-transparent px-3 text-[9px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-px";
const partnerCreateActionClassName = `${partnerActionBaseClassName} border-emerald-500 text-emerald-600 hover:bg-emerald-50 focus-visible:ring-emerald-300`;
const partnerReviewActionClassName = `${partnerActionBaseClassName} border-orange-400 text-orange-600 hover:bg-orange-50 focus-visible:ring-orange-300`;
const partnerViewActionClassName = `${partnerActionBaseClassName} border-[#315FEA] text-[#315FEA] hover:bg-[#EEF3FF] focus-visible:ring-[#818CF8]`;

export function PartnerRegisterClient({
  rows,
  initialSearch,
  initialStatus,
  success,
  error,
  loadError,
  canPermanentDelete,
}: {
  rows: PartnerRegisterRow[];
  canPermanentDelete: boolean;
  initialSearch: string;
  initialStatus: string;
  success?: string;
  error?: string;
  loadError: boolean;
}) {
  const [search, setSearch] = useState(initialSearch);
  const initialFilter = initialStatus === "active" || initialStatus === "onboarding" ? initialStatus : "";
  const [status, setStatus] = useState(initialFilter);
  const [selectedFilter, setSelectedFilter] = useState<PartnerFilter>(initialFilter || "all");
  const [rmFilter, setRmFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const normalized = search.trim().toLowerCase();

  const rmOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.assignedRm).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [rows]);
  const searchedRows = useMemo(() => normalized ? rows.filter((row) => row.searchText.includes(normalized) || (normalized.replace(/\\D/g, "").length >= 3 && row.mobile.replace(/\\D/g, "").includes(normalized.replace(/\\D/g, "")))) : rows, [normalized, rows]);
  const scopedRows = useMemo(() => searchedRows.filter((row) => {
    if (rmFilter && row.assignedRm !== rmFilter) return false;
    const date = indiaDateKey(row.onboardingDate);
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  }), [searchedRows, rmFilter, dateFrom, dateTo]);
  const counts = useMemo(() => scopedRows.reduce((acc, row) => {
    if (row.active) acc.active += 1;
    else acc.onboarding += 1;
    return acc;
  }, { active: 0, onboarding: 0 }), [scopedRows]);
  const visibleRows = status === "active" ? scopedRows.filter((row) => row.active) : status === "onboarding" ? scopedRows.filter((row) => !row.active) : scopedRows;
  const totalRecords = visibleRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PARTNER_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * PARTNER_PAGE_SIZE;
  const pageRows = visibleRows.slice(pageStartIndex, pageStartIndex + PARTNER_PAGE_SIZE);
  const showingStart = totalRecords === 0 ? 0 : pageStartIndex + 1;
  const showingEnd = totalRecords === 0 ? 0 : Math.min(pageStartIndex + PARTNER_PAGE_SIZE, totalRecords);
  const extraFilterCount = Number(Boolean(rmFilter)) + Number(Boolean(dateFrom)) + Number(Boolean(dateTo));

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (status) params.set("account_status", status);
    const nextUrl = `/intermediaries/partner${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [search, status]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const successMessage = success === "portal_login_invited"
    ? "Password creation link sent."
    : success === "portal_invite_resent"
      ? "A fresh password creation link has been sent."
      : success === "documents_completed"
        ? "Documents saved and Partner activated."
        : "Action completed.";

  function selectFilter(next: Exclude<PartnerFilter, "">) {
    setSelectedFilter(next);
    setStatus(next === "all" ? "" : next);
    setCurrentPage(1);
  }

  function clearExtraFilters() {
    setRmFilter("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4 pb-6">
      {success ? <WorkflowSuccessToast message={successMessage} durationMs={4000} /> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] font-medium text-red-700">The requested action could not be completed. Please try again. If the problem continues, contact the system administrator.</div> : null}
      {canPermanentDelete ? <PartnerDeletePanel rows={rows} /> : null}
      <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
        <IntermediaryTabs active="partner" embedded />
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E7ECF3] bg-[#FAFBFD] px-5 py-3">
          <h2 className="mr-1 whitespace-nowrap text-[12.5px] font-semibold text-[#17203A]">Partner Register</h2>
          <form onSubmit={(event) => event.preventDefault()} className="relative min-w-[240px] flex-1 lg:max-w-[380px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setCurrentPage(1); }} placeholder="Search partner, mobile, email, ID or RM" className="h-9 w-full rounded-lg border border-[#D8E1EC] bg-white pl-9 pr-3 text-[10.5px] text-[#17203A] outline-none placeholder:text-[#94A3B8] focus:border-[#315FEA] focus:ring-2 focus:ring-[#E6ECFF]" />
          </form>
          <select aria-label="Assigned RM" value={rmFilter} onChange={(event) => { setRmFilter(event.target.value); setCurrentPage(1); }} className="h-9 min-w-[150px] rounded-lg border border-[#D8E1EC] bg-white px-2.5 text-[9.5px] font-semibold text-[#26374F] outline-none focus:border-[#315FEA]">
            <option value="">All RMs</option>
            {rmOptions.map((rm) => <option key={rm} value={rm}>{rm}</option>)}
          </select>
          <PartnerDateRangeFilter
            fromDate={dateFrom}
            toDate={dateTo}
            onFromDateChange={(value) => { setDateFrom(value); setCurrentPage(1); }}
            onToDateChange={(value) => { setDateTo(value); setCurrentPage(1); }}
            onClear={() => { setDateFrom(""); setDateTo(""); setCurrentPage(1); }}
          />
          {extraFilterCount ? <button type="button" onClick={clearExtraFilters} className="h-9 rounded-lg px-2.5 text-[8.5px] font-bold text-[#526178] hover:bg-[#F1F5F9] hover:text-[#17365D]">Clear filters ({extraFilterCount})</button> : null}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 whitespace-nowrap text-[9.5px] font-semibold">
            <FilterButton label="All" count={scopedRows.length} active={selectedFilter === "all"} onClick={() => selectFilter("all")} />
            <FilterButton label="Active" count={counts.active} active={selectedFilter === "active"} onClick={() => selectFilter("active")} />
            <FilterButton label="Onboarding" count={counts.onboarding} active={selectedFilter === "onboarding"} onClick={() => selectFilter("onboarding")} />
          </div>
        </div>
        {loadError ? <div className="px-4 py-12 text-center text-[11px] text-red-700">The register could not be loaded. Please refresh the page and try again.</div> : pageRows.length ? <PartnerTable rows={pageRows} /> : <div className="px-4 py-16 text-center"><p className="text-[12px] font-semibold">No records found</p><p className="mt-1 text-[10px] text-[#64748B]">Try changing the search, RM, onboarding date or status filter.</p></div>}
        {!loadError ? (
          <div className="flex flex-col gap-3 border-t border-[#E7ECF3] bg-white px-4 py-3.5 text-[10px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
            <span>Showing {showingStart}–{showingEnd} of {totalRecords}</span>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1} className="inline-flex h-8 items-center justify-center rounded-lg border border-[#DCE5EF] bg-white px-3 font-medium text-[#526178] transition-colors enabled:hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#B6C0CF]">Previous</button>
              <span className="min-w-[42px] text-center font-medium text-[#526178]">{currentPage} / {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages} className="inline-flex h-8 items-center justify-center rounded-lg border border-[#DCE5EF] bg-white px-3 font-medium text-[#526178] transition-colors enabled:hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#B6C0CF]">Next</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function PartnerDateRangeFilter({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onClear,
}: {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onClear: () => void;
}) {
  const label = fromDate || toDate
    ? `${fromDate ? shortDate(fromDate) : "Any"} – ${toDate ? shortDate(toDate) : "Any"}`
    : "Date Range";
  return <details className="group relative">
    <summary className="flex h-9 min-w-[160px] cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-[#D8E1EC] bg-white px-2.5 text-[9.5px] font-semibold text-[#26374F] outline-none transition hover:border-[#AFC0D4] focus-visible:ring-2 focus-visible:ring-[#315FEA]/10 [&::-webkit-details-marker]:hidden">
      <span className="flex min-w-0 items-center gap-2"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#8090A5]" /><span className="truncate">{label}</span></span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#8090A5] transition group-open:rotate-180" />
    </summary>
    <div className="absolute right-0 top-10 z-40 w-[292px] rounded-xl border border-[#D7E0EA] bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,.16)]">
      <div className="grid grid-cols-2 gap-2">
        <label><span className="mb-1 block text-[8px] font-bold text-[#7C899B]">From</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => onFromDateChange(event.target.value)} className="h-9 w-full rounded-lg border border-[#D7E0EA] px-2 text-[9.5px] font-semibold text-[#334155] outline-none focus:border-[#17365D]" /></label>
        <label><span className="mb-1 block text-[8px] font-bold text-[#7C899B]">To</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => onToDateChange(event.target.value)} className="h-9 w-full rounded-lg border border-[#D7E0EA] px-2 text-[9.5px] font-semibold text-[#334155] outline-none focus:border-[#17365D]" /></label>
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={(event) => { onClear(); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-[#64748B] hover:bg-[#F8FAFC]">Clear dates</button>
      </div>
    </div>
  </details>;
}

function shortDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year.slice(-2)}` : value;
}

function FilterButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-full px-2.5 py-1.5 transition-colors duration-150 ${active ? "bg-[#E7E7E7] text-[#17203A]" : "text-[#526178] hover:bg-[#E7E7E7] hover:text-[#17203A]"}`}>{label} <span className="ml-1">{count}</span></button>;
}

function PartnerTable({ rows }: { rows: PartnerRegisterRow[] }) {
  const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[1040px] table-fixed text-left text-[10.5px]">
      <thead className="border-b text-[8.5px] uppercase text-[#64748B]"><tr>
        <th className="w-[20%] px-4 py-3">Partner Name</th>
        <th className="w-[13%] px-3 py-3">Mobile Number</th>
        <th className="w-[15%] px-3 py-3">Assigned RM</th>
        <th className="w-[12%] px-3 py-3">Status</th>
        <th className="w-[9%] px-3 py-3 text-right">Customers</th>
        <th className="w-[11%] px-3 py-3 text-right">Net Premium</th>
        <th className="w-[10%] px-3 py-3 text-right">Payout</th>
        <th className="w-[10%] px-3 py-3 text-center">Action</th>
      </tr></thead>
      <tbody className="divide-y">{rows.map((row) => {
        const label = `${row.createType.toUpperCase()} ${row.partnerStatus}`;
        return <tr key={row.id} className="h-[52px] transition hover:bg-[#F8FAFF]">
          <td className="px-4 py-3"><div className="min-w-0"><FreshAccountReviewLink href={`/intermediaries/applications/${row.applicationId}`} className="block truncate font-semibold text-[#0F2A55] hover:text-[#315FEA] hover:underline">{row.displayName}</FreshAccountReviewLink><span className="mt-0.5 block truncate text-[9px] font-medium text-[#8190A4]">{row.partnerId}</span></div></td>
          <td className="truncate px-3 py-3 font-medium text-[#17203A]" title={row.mobile}>{row.mobile}</td>
          <td className={`truncate px-3 py-3 ${row.assignedRm === "Not assigned" ? "font-medium text-amber-700" : "text-[#17203A]"}`} title={row.assignedRm}>{row.assignedRm}</td>
          <td className="px-3 py-3"><Status value={label} tone="account" /></td>
          <td className="px-3 py-3 text-right tabular-nums" title={row.customerCount === null ? "Customer attribution unavailable" : undefined}>{row.customerCount === null ? "—" : row.customerCount.toLocaleString("en-IN")}</td>
          <td className="px-3 py-3 text-right tabular-nums" title={row.netPremium === null ? "Net premium attribution unavailable" : undefined}>{money(row.netPremium)}</td>
          <td className="px-3 py-3 text-right tabular-nums" title={row.payout === null ? "Payout attribution unavailable" : undefined}>{money(row.payout)}</td>
          <td className="px-3 py-3 text-center"><div className="flex flex-col items-center gap-1.5">{renderAction(row)}</div></td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

function renderAction(row: PartnerRegisterRow) {
  if (row.linkedHref) return <FreshAccountReviewLink href={row.linkedHref} className={partnerViewActionClassName}>View {row.createType.toUpperCase()}</FreshAccountReviewLink>;
  if (!row.active) return <FreshAccountReviewLink href={`/intermediaries/applications/${row.applicationId}`} className={partnerReviewActionClassName}>Review</FreshAccountReviewLink>;
  if (!row.canCreateLinked) return <span className="text-[#94A3B8]">-</span>;
  return <form action={createLinkedIntermediaryAccount}><input type="hidden" name="application_id" value={row.applicationId} /><input type="hidden" name="registration_type" value={row.createType} /><FormSubmitButton label={`Create ${row.createType.toUpperCase()}`} pendingLabel={`Creating ${row.createType.toUpperCase()}...`} className={partnerCreateActionClassName} /></form>;
}

function indiaDateKey(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function Status({ value, tone = "default" }: { value: string; tone?: "default" | "linked" | "portal" | "account" }) {
  const normalized = value.toLowerCase();
  const cls = tone === "linked" ? normalized.includes("active") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-violet-200 bg-violet-50 text-violet-700" : tone === "portal" ? "border-sky-200 bg-sky-50 text-sky-700" : tone === "account" ? normalized.includes("active") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-[8.5px] font-semibold ${cls}`}>{value}</span>;
}

function PartnerDeletePanel({ rows, embedded = false }: { rows: PartnerRegisterRow[]; embedded?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const choices = useMemo(() => rows.filter((row) => [row.displayName, row.partnerId, row.mobile, row.id].join(" ").toLowerCase().includes(query.trim().toLowerCase())), [rows, query]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  return <section className={embedded ? "border-b border-red-100 bg-gradient-to-r from-red-50 via-white to-amber-50" : "overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-amber-50 shadow-sm"}>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 border-b border-red-100 px-5 py-3 text-left">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-600"><AlertTriangle className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold uppercase tracking-wide text-red-700">IT Super User Only</span><span className="block text-[13px] font-semibold text-[#17203A]">Delete Partner Master Record</span></span>
      <span className="flex items-center gap-2 text-[10px] font-semibold text-red-700">{open ? "Collapse" : "Expand"}<ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></span>
    </button>
    {open ? <div className="grid items-end gap-3 px-5 py-4 lg:grid-cols-[minmax(150px,1fr)_minmax(200px,1.3fr)_minmax(280px,1.7fr)_auto]">
      <p className="text-[10.5px] leading-relaxed text-[#64748B]">Permanent deletion is blocked when the Partner has protected business records or dependent relationships.</p>
      <label className="grid gap-1 text-[9px] font-bold uppercase text-[#64748B]">Find Record
        <input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(""); }} placeholder="Search Partner name, code or mobile" className="h-10 rounded-xl border border-[#D8E1EC] bg-white px-3 text-[11px] font-normal normal-case outline-none focus:border-[#315B9A]" />
      </label>
      <label className="grid gap-1 text-[9px] font-bold uppercase text-[#64748B]">Select Exact Record
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="h-10 rounded-xl border border-[#D8E1EC] bg-white px-3 text-[11px] font-normal normal-case text-[#17203A]">
          <option value="">Choose a Partner</option>
          {choices.map((row) => <option key={row.id} value={row.id}>{row.displayName} · {row.partnerId} · {row.mobile}</option>)}
        </select>
      </label>
      <div className="min-w-[130px]">{selected ? <PermanentDeleteButton kind="partner" id={selected.id} relatedId={selected.partnerRecordId ?? undefined} name={selected.displayName} label="Delete Partner" /> : <button type="button" disabled className="h-10 w-full rounded-xl bg-red-300 px-4 text-[11px] font-bold text-white opacity-60">Delete Partner</button>}</div>
    </div> : null}
  </section>;
}
