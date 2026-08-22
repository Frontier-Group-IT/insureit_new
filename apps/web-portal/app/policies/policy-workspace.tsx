"use client";

import Link from "next/link";
import { CalendarDays, Files, FileText, Plus, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  RegisterEmpty,
  RegisterPagination,
  RegisterSelect,
  RegisterStatusPill,
  RegisterViewTabs
} from "@/components/broker-register";

type PolicyDocument = {
  id: string;
  document_type: string;
  file_name: string;
  mime_type: string | null;
};

type PolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  business_line: string | null;
  start_date: string;
  end_date: string;
  insured_declared_value: number | null;
  premium_amount: number | null;
  gross_premium: number | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  source_name: string | null;
  policy_documents: PolicyDocument[];
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
  insurance_companies: { name: string } | null;
  claims: { count: number }[];
};

type SourceOption = { value: string; label: string };
type ViewKey = "all" | "active" | "expiring" | "expired" | "claims";
const PAGE_SIZE = 10;

function policySourceDatabaseType(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "sibl / partner" || normalized === "partner") return "partner";
  if (normalized === "posp") return "posp";
  if (normalized === "misp") return "misp";
  return null;
}

function policySourceKey(row: Pick<PolicyRow, "intermediary_type" | "intermediary_code">) {
  const type = policySourceDatabaseType(row.intermediary_type);
  const code = row.intermediary_code?.trim();
  return type && code ? `${type}:${code}` : "";
}

function PolicyDateFilter({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block h-10 w-[148px] shrink-0 xl:w-full xl:min-w-0">
      <span className={`pointer-events-none absolute inset-y-0 left-3 right-9 z-10 flex items-center text-[10.5px] font-semibold ${value ? "text-[#334155]" : "text-[#64748B]"}`}>
        {value ? formatDateFilterValue(value) : label}
      </span>
      <CalendarDays className="pointer-events-none absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#334155]" />
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => {
          const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
          input.showPicker?.();
        }}
        aria-label={label}
        className="absolute inset-0 h-10 w-full cursor-pointer rounded-xl border border-[#CBD5E1] bg-white px-3 text-transparent caret-transparent outline-none transition focus:border-[#17365D] focus:ring-2 focus:ring-[#17365D]/10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-datetime-edit]:opacity-0"
      />
    </label>
  );
}

export function PolicyWorkspace({ rows, sourceOptions = [] }: { rows: PolicyRow[]; sourceOptions?: SourceOption[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [source, setSource] = useState("all");
  const [insurer, setInsurer] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);

  const enriched = useMemo(() => rows.map((row) => ({ ...row, status: policyStatus(row.end_date), daysLeft: daysUntil(row.end_date) })), [rows]);
  const insurers = useMemo(() => Array.from(new Set(rows.map((row) => row.insurance_companies?.name).filter(Boolean))).sort() as string[], [rows]);

  const baseFiltered = useMemo(() => enriched.filter((row) => {
    const haystack = [row.policy_no, row.business_line, row.policy_type, row.insurance_companies?.name, row.vehicles?.vehicle_no, row.customers?.company_name, row.customers?.contact_name, row.intermediary_type, row.intermediary_code, row.source_name].filter(Boolean).join(" ").toLowerCase();
    const matchesSource = source === "all" || policySourceKey(row) === source;
    const matchesInsurer = insurer === "all" || row.insurance_companies?.name === insurer;
    const matchesFromDate = !fromDate || row.start_date >= fromDate;
    const matchesToDate = !toDate || row.start_date <= toDate;
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    return matchesSource && matchesInsurer && matchesFromDate && matchesToDate && matchesQuery;
  }), [enriched, fromDate, insurer, query, source, toDate]);

  const stats = useMemo(() => {
    const active = baseFiltered.filter((row) => row.status === "Active").length;
    const expiring = baseFiltered.filter((row) => row.status === "Expiring soon").length;
    const expired = baseFiltered.filter((row) => row.status === "Expired").length;
    const claims = baseFiltered.filter((row) => claimCount(row) > 0).length;
    return { all: baseFiltered.length, active, expiring, expired, claims };
  }, [baseFiltered]);

  const filtered = useMemo(() => baseFiltered.filter((row) =>
    view === "all" ||
    (view === "active" && row.status === "Active") ||
    (view === "expiring" && row.status === "Expiring soon") ||
    (view === "expired" && row.status === "Expired") ||
    (view === "claims" && claimCount(row) > 0)
  ), [baseFiltered, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function changeView(next: string) {
    setView(next as ViewKey);
    setPage(1);
  }

  function resetFilters() {
    setQuery("");
    setSource("all");
    setInsurer("all");
    setFromDate("");
    setToDate("");
    setView("all");
    setPage(1);
  }

  function openDocument(document: PolicyDocument) {
    if (openingDocumentId) return;
    setOpeningDocumentId(document.id);
    window.open(`/policies/documents/${encodeURIComponent(document.id)}/open`, "_blank", "noopener,noreferrer");
    window.setTimeout(() => setOpeningDocumentId(null), 750);
  }

  return (
    <section className="mx-auto max-w-[1480px] overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
      <div className="border-b border-[#E5ECF5] bg-[#F8FAFC] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17365D] text-white shadow-[0_10px_22px_rgba(23,54,93,0.18)]"><FileText className="h-5 w-5" /></span>
            <h2 className="shrink-0 text-[18px] font-semibold leading-tight text-[#0F172A]">Policy Portfolio</h2>
            <label className="relative ml-1 min-w-0 flex-1 lg:max-w-[430px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B93AA]" />
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder="Search policy, insurer, vehicle, source or customer"
                aria-label="Search policy, insurer, vehicle, source or customer"
                className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-3 text-[12px] text-[#0F172A] outline-none transition focus:border-[#17365D] focus:ring-2 focus:ring-[#17365D]/10"
              />
            </label>
            <button
              type="button"
              onClick={resetFilters}
              aria-label="Reset filters"
              title="Reset filters"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white text-[#475569] transition hover:border-[#9FB2C8] hover:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#17365D]/10"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
          <Link href="/policies/new" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.22)]"><Plus className="h-4 w-4" />Add Policy</Link>
        </div>
      </div>

      <div className="border-b border-[#E5ECF5] bg-white px-3 py-2 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:grid xl:grid-cols-[minmax(140px,0.9fr)_minmax(160px,1fr)_minmax(132px,0.72fr)_minmax(132px,0.72fr)_minmax(330px,auto)] xl:gap-1.5">
          <div className="[&>label]:block [&>label]:w-full [&_select]:min-w-[180px] [&_select]:w-[180px] xl:[&_select]:min-w-0 xl:[&_select]:w-full">
            <RegisterSelect value={source} onChange={(value) => { setSource(value); setPage(1); }} label="Lead source">
              <option value="all">All Sources</option>
              {sourceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </RegisterSelect>
          </div>
          <div className="[&>label]:block [&>label]:w-full [&_select]:min-w-[200px] [&_select]:w-[200px] xl:[&_select]:min-w-0 xl:[&_select]:w-full">
            <RegisterSelect value={insurer} onChange={(value) => { setInsurer(value); setPage(1); }} label="Insurance company">
              <option value="all">All insurers</option>
              {insurers.map((item) => <option key={item} value={item}>{item}</option>)}
            </RegisterSelect>
          </div>
          <PolicyDateFilter label="From Date" value={fromDate} max={toDate || undefined} onChange={(value) => { setFromDate(value); setPage(1); }} />
          <PolicyDateFilter label="To Date" value={toDate} min={fromDate || undefined} onChange={(value) => { setToDate(value); setPage(1); }} />
          <div className="min-w-0 max-w-full xl:min-w-[330px] xl:[&>div]:w-full xl:[&>div]:justify-between xl:[&>div]:gap-0.5 xl:[&_button]:px-2.5 xl:[&_button]:text-[10px]">
            <RegisterViewTabs
              value={view}
              onChange={changeView}
              options={[
                { value: "all", label: "All", count: stats.all },
                { value: "active", label: "Active", count: stats.active },
                { value: "expiring", label: "Renewal due", count: stats.expiring },
                { value: "expired", label: "Expired", count: stats.expired },
                { value: "claims", label: "Claims", count: stats.claims }
              ]}
            />
          </div>
        </div>
      </div>

      <div className="mobile-card-list p-3 md:hidden">
        {pageRows.map((policy) => <PolicyMobileCard key={policy.id} policy={policy} />)}
        {!pageRows.length ? <RegisterEmpty title="No matching policies" description="Adjust the search, source, insurer, date range or status view." /> : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1098px] table-fixed text-left text-[11px] text-[#252944]">
          <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
            <tr>
              <th className="w-[190px] px-3 py-2">Policy Type</th>
              <th className="w-[188px] px-2.5 py-2">Customer</th>
              <th className="w-[142px] px-2.5 py-2">Vehicle</th>
              <th className="w-[178px] px-2.5 py-2">Insurer</th>
              <th className="w-[156px] px-2.5 py-2">Validity</th>
              <th className="w-[118px] px-2.5 py-2">Status</th>
              <th className="w-[108px] px-2.5 py-2 text-right">IDV</th>
              <th className="w-[108px] px-2.5 py-2 text-right">Premium</th>
              <th className="w-[132px] px-2.5 py-2">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {pageRows.map((policy) => (
              <tr key={policy.id} className="h-12 transition hover:bg-[#FAFCFF]">
                <td className="px-3"><PolicyTypeLink policy={policy} openingDocumentId={openingDocumentId} onOpenDocument={openDocument} /></td>
                <td className="px-2.5"><p className="truncate font-semibold text-[#334155]">{policy.customers?.contact_name ?? "-"}</p><p className="truncate text-[9px] leading-4 text-[#64748B]">{policy.customers?.company_name ?? "Individual account"}</p></td>
                <td className="px-2.5 font-mono">{policy.vehicles?.vehicle_no ?? "-"}</td>
                <td className="px-2.5"><span className="block truncate">{policy.insurance_companies?.name ?? "-"}</span></td>
                <td className="px-2.5"><p className="font-semibold">{formatDate(policy.start_date)} - {formatDate(policy.end_date)}</p><p className="text-[9px] leading-4 text-[#64748B]">{validityHint(policy)}</p></td>
                <td className="px-2.5"><PolicyStatus policy={policy} /></td>
                <td className="px-2.5 text-right font-semibold tabular-nums">{formatCurrency(policy.insured_declared_value)}</td>
                <td className="px-2.5 text-right font-semibold tabular-nums">{formatCurrency(policy.gross_premium)}</td>
                <td className="px-2.5"><p className="truncate font-semibold capitalize">{policy.source_name ?? policy.intermediary_type?.replaceAll("_", " ") ?? "Direct"}</p><p className="truncate text-[9px] leading-4 text-[#64748B]">{policy.intermediary_code ?? "Sankalp"}</p></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pageRows.length ? <RegisterEmpty title="No matching policies" description="Adjust the search, source, insurer, date range or status view." /> : null}
      </div>

      <RegisterPagination pageRows={pageRows.length} filteredRows={filtered.length} safePage={safePage} totalPages={totalPages} pageSize={PAGE_SIZE} onPrevious={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} />
    </section>
  );
}

function PolicyMobileCard({ policy }: { policy: PolicyRow & { status: string; daysLeft: number } }) {
  return (
    <article className="mobile-record-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/policies/${policy.id}/edit`} className="block truncate text-[15px] font-extrabold text-[#12203B]">{policy.policy_no}</Link>
          <p className="mt-0.5 truncate text-[12px] text-[#66748A]">{policy.insurance_companies?.name ?? "Insurer not set"}</p>
        </div>
        <PolicyStatus policy={policy} />
      </div>
      <div className="mt-3 grid gap-2 text-[12px] text-[#53627A]">
        <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{policy.customers?.contact_name ?? "Customer not linked"}</span>
        <div className="grid grid-cols-2 gap-2">
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{policy.vehicles?.vehicle_no ?? "Vehicle not linked"}</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{validityHint(policy)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{formatCurrency(policy.insured_declared_value)}</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{formatCurrency(policy.gross_premium)}</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{claimCount(policy)} claims</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={`/policies/${policy.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#111A35] px-3 text-[12px] font-bold text-white">Open policy</Link>
        <Link href="/claims/new" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#BFD3F7] bg-[#F0F6FF] px-3 text-[12px] font-bold text-[#174EA6]">Report claim</Link>
      </div>
    </article>
  );
}

function PolicyStatus({ policy }: { policy: PolicyRow & { status?: string; daysLeft?: number } }) {
  const status = policy.status ?? policyStatus(policy.end_date);
  if (status === "Expired") return <RegisterStatusPill tone="red">Expired</RegisterStatusPill>;
  if (status === "Expiring soon") return <RegisterStatusPill tone="amber">Renewal due</RegisterStatusPill>;
  return <RegisterStatusPill tone="green">Active</RegisterStatusPill>;
}

function PolicyTypeLink({ policy, openingDocumentId, onOpenDocument }: { policy: PolicyRow; openingDocumentId: string | null; onOpenDocument: (document: PolicyDocument) => void; }) {
  const businessLine = policy.business_line?.trim();
  const product = policy.policy_type?.trim();
  const policyCopy = policy.policy_documents?.find((document) => document.document_type === "policy_copy") ?? null;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Link href={`/policies/${policy.id}/edit`} title={policy.policy_no} className="min-w-0 truncate text-[12px] text-[#0F172A] hover:text-[#17365D] hover:underline">
        {businessLine ? <span className="font-bold">{businessLine}</span> : null}
        {businessLine && product ? <span aria-hidden="true" className="mx-1 inline-block text-[11px] font-normal leading-none">•</span> : null}
        {product ? <span className="font-normal">{product}</span> : null}
        {!businessLine && !product ? <span className="font-normal">-</span> : null}
      </Link>
      {policyCopy ? (
        <button type="button" onClick={() => onOpenDocument(policyCopy)} disabled={openingDocumentId === policyCopy.id} aria-label={`Open policy copy for ${policy.policy_no}`} title={policyCopy.file_name ? `Open policy copy: ${policyCopy.file_name}` : "Open policy copy"} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[#7c3aed] transition hover:bg-[#E9D5FF] hover:text-[#6D28D9] disabled:cursor-wait disabled:opacity-50">
          <Files className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function validityHint(policy: PolicyRow & { daysLeft?: number }) {
  const days = policy.daysLeft ?? daysUntil(policy.end_date);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Expires today";
  return `${days} days left`;
}
function policyStatus(endDate: string) {
  const days = daysUntil(endDate);
  return days < 0 ? "Expired" : days <= 30 ? "Expiring soon" : "Active";
}
function daysUntil(endDate: string) {
  const end = new Date(`${endDate}T23:59:59`);
  const now = new Date();
  if (Number.isNaN(end.getTime())) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}
function formatDateFilterValue(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}-${month}-${year}` : value;
}
function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
function formatCurrency(value: number | null) {
  if (!value) return "-";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0, style: "currency", currency: "INR" }).format(value);
}
function claimCount(row: PolicyRow) { return row.claims?.[0]?.count ?? 0; }