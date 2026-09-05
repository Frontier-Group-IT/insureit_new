"use client";

import Link from "next/link";
import { CalendarDays, ChevronDown, Files, FileText, Plus, RotateCcw, Search } from "lucide-react";
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
};

type NonMotorDetails = { category: string | null; risk_title: string | null; risk_location: string | null; transit_from: string | null; transit_to: string | null; nature_of_business: string | null; liability_type: string | null; risk_details: Record<string, unknown> | null };

type PolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  policy_product: string | null;
  business_line: string | null;
  issuance_date: string | null;
  created_at: string;
  start_date: string;
  end_date: string;
  insured_declared_value: number | null;
  gross_premium: number | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  source_name: string | null;
  policy_documents: PolicyDocument[];
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string; chassis_no: string | null; engine_no: string | null } | null;
  insurance_companies: { name: string } | null;
  non_motor_policy_details: NonMotorDetails | null;
  claims: { count: number }[];
};

type SourceOption = { value: string; label: string };
type ViewKey = "all" | "active" | "expiring" | "expired" | "claims";
type BusinessFilter = "all" | "Motor" | "Non Motor";
type TimeScope = "mtd" | "all";
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

function PolicyBusinessFilter({
  business,
  category,
  categories,
  onBusinessChange,
  onCategoryChange,
}: {
  business: BusinessFilter;
  category: string;
  categories: string[];
  onBusinessChange: (value: BusinessFilter) => void;
  onCategoryChange: (value: string) => void;
}) {
  const label = business === "all" ? "All Policies" : business === "Motor" ? "Motor" : category === "all" ? "Non Motor" : `Non Motor · ${category}`;
  return (
    <details className="group relative">
      <summary className="flex h-10 min-w-[150px] cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold text-[#334155] outline-none transition hover:border-[#9FB2C8] focus-visible:ring-2 focus-visible:ring-[#17365D]/10 [&::-webkit-details-marker]:hidden">
        <span className="truncate">{label}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748B] transition group-open:rotate-180" />
      </summary>
      <div className="absolute left-0 top-11 z-30 w-[250px] rounded-xl border border-[#D7E0EA] bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,.16)]">
        <p className="px-2 pb-1.5 pt-1 text-[8px] font-black uppercase tracking-[.1em] text-[#8A96A7]">Business line</p>
        {([["all","All Policies"],["Motor","Motor"],["Non Motor","Non Motor"]] as const).map(([value, text]) => (
          <button key={value} type="button" onClick={() => onBusinessChange(value)} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[10.5px] font-semibold transition ${business === value ? "bg-[#EEF4FB] text-[#17365D]" : "text-[#475569] hover:bg-[#F8FAFC]"}`}>
            {text}<span className={`h-2 w-2 rounded-full border ${business === value ? "border-[#17365D] bg-[#17365D]" : "border-[#CBD5E1]"}`} />
          </button>
        ))}
        {business === "Non Motor" ? (
          <div className="mt-2 border-t border-[#EEF2F6] px-2 pt-2">
            <label className="block text-[8px] font-black uppercase tracking-[.08em] text-[#8A96A7]">Category</label>
            <select value={category} onChange={(event) => onCategoryChange(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-[#D7E0EA] bg-white px-2.5 text-[10px] font-semibold text-[#334155] outline-none focus:border-[#17365D]">
              <option value="all">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function PolicyDateRangeFilter({
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
    ? `${fromDate ? shortFilterDate(fromDate) : "Any"} – ${toDate ? shortFilterDate(toDate) : "Any"}`
    : "Date Range";
  return (
    <details className="group relative">
      <summary className="flex h-10 min-w-[170px] cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10.5px] font-semibold text-[#334155] outline-none transition hover:border-[#9FB2C8] focus-visible:ring-2 focus-visible:ring-[#17365D]/10 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#64748B]" /><span className="truncate">{label}</span></span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748B] transition group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 top-11 z-30 w-[292px] rounded-xl border border-[#D7E0EA] bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,.16)]">
        <div className="grid grid-cols-2 gap-2">
          <label><span className="mb-1 block text-[8px] font-bold text-[#7C899B]">From</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => onFromDateChange(event.target.value)} className="h-9 w-full rounded-lg border border-[#D7E0EA] px-2 text-[9.5px] font-semibold text-[#334155] outline-none focus:border-[#17365D]" /></label>
          <label><span className="mb-1 block text-[8px] font-bold text-[#7C899B]">To</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => onToDateChange(event.target.value)} className="h-9 w-full rounded-lg border border-[#D7E0EA] px-2 text-[9.5px] font-semibold text-[#334155] outline-none focus:border-[#17365D]" /></label>
        </div>
        <div className="mt-2 flex justify-end"><button type="button" onClick={onClear} className="rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-[#64748B] hover:bg-[#F8FAFC]">Clear dates</button></div>
      </div>
    </details>
  );
}

function PolicyPeriodFilter({
  value,
  mtdCount,
  allCount,
  onChange,
}: {
  value: TimeScope;
  mtdCount: number;
  allCount: number;
  onChange: (value: TimeScope) => void;
}) {
  const selectedCount = value === "mtd" ? mtdCount : allCount;
  return (
    <details className="group relative shrink-0">
      <summary className="flex h-8 min-w-[74px] cursor-pointer list-none items-center justify-between gap-1.5 rounded-lg bg-[#17365D] px-2.5 text-[10px] font-bold text-white shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#17365D]/20 [&::-webkit-details-marker]:hidden">
        <span>{value === "mtd" ? "MTD" : "All"} <span className="opacity-80">{selectedCount}</span></span>
        <ChevronDown className="h-3 w-3 transition group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 top-9 z-40 min-w-[118px] rounded-xl border border-[#D7E0EA] bg-white p-1.5 shadow-[0_16px_36px_rgba(15,23,42,.16)]">
        <button type="button" onClick={() => onChange("mtd")} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[10px] font-bold transition ${value === "mtd" ? "bg-[#EEF4FB] text-[#17365D]" : "text-[#53627A] hover:bg-[#F8FAFC]"}`}><span>MTD</span><span className="text-[9px] tabular-nums opacity-70">{mtdCount}</span></button>
        <button type="button" onClick={() => onChange("all")} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[10px] font-bold transition ${value === "all" ? "bg-[#EEF4FB] text-[#17365D]" : "text-[#53627A] hover:bg-[#F8FAFC]"}`}><span>All</span><span className="text-[9px] tabular-nums opacity-70">{allCount}</span></button>
      </div>
    </details>
  );
}

export function PolicyWorkspace({ rows, sourceOptions = [] }: { rows: PolicyRow[]; sourceOptions?: SourceOption[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [timeScope, setTimeScope] = useState<TimeScope>("mtd");
  const [business, setBusiness] = useState<BusinessFilter>("all");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [insurer, setInsurer] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const { from: mtdStart, to: mtdEnd } = monthToDateBounds();

  const enriched = useMemo(() => rows.map((row) => ({ ...row, status: policyStatus(row.end_date), daysLeft: daysUntil(row.end_date) })), [rows]);
  const insurers = useMemo(() => Array.from(new Set(rows.map((row) => row.insurance_companies?.name).filter(Boolean))).sort() as string[], [rows]);
  const categories = useMemo(() => Array.from(new Set(rows.filter((row) => policyBusinessLine(row) === "Non Motor").map((row) => policyCategory(row)).filter(Boolean))).sort(), [rows]);

  const controlFiltered = useMemo(() => enriched.filter((row) => {
    const haystack = [row.policy_no, row.business_line, row.policy_type, row.policy_product, row.insurance_companies?.name, row.vehicles?.vehicle_no, row.vehicles?.chassis_no, row.vehicles?.engine_no, row.customers?.company_name, row.customers?.contact_name, row.intermediary_type, row.intermediary_code, row.source_name, policyCategory(row), riskAssetPrimary(row), riskAssetSecondary(row)].filter(Boolean).join(" ").toLowerCase();
    const matchesBusiness = business === "all" || policyBusinessLine(row) === business;
    const matchesCategory = business !== "Non Motor" || category === "all" || policyCategory(row) === category;
    const matchesSource = source === "all" || policySourceKey(row) === source;
    const matchesInsurer = insurer === "all" || row.insurance_companies?.name === insurer;
    const businessDate = policyBusinessDate(row);
    const matchesFromDate = !fromDate || businessDate >= fromDate;
    const matchesToDate = !toDate || businessDate <= toDate;
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    return matchesBusiness && matchesCategory && matchesSource && matchesInsurer && matchesFromDate && matchesToDate && matchesQuery;
  }), [business, category, enriched, fromDate, insurer, query, source, toDate]);

  const mtdFiltered = useMemo(() => controlFiltered.filter((row) => {
    const businessDate = policyBusinessDate(row);
    return businessDate >= mtdStart && businessDate <= mtdEnd;
  }), [controlFiltered, mtdEnd, mtdStart]);
  const baseFiltered = timeScope === "mtd" ? mtdFiltered : controlFiltered;

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

  function changeTimeScope(next: TimeScope) {
    setTimeScope(next);
    setFromDate("");
    setToDate("");
    setView("all");
    setPage(1);
  }

  function changeCustomFromDate(value: string) {
    setTimeScope("all");
    setFromDate(value);
    setView("all");
    setPage(1);
  }

  function changeCustomToDate(value: string) {
    setTimeScope("all");
    setToDate(value);
    setView("all");
    setPage(1);
  }

  function resetFilters() {
    setQuery("");
    setBusiness("all");
    setCategory("all");
    setSource("all");
    setInsurer("all");
    setTimeScope("mtd");
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
                placeholder="Search policy, customer, insurer, vehicle, chassis, engine, risk or source"
                aria-label="Search policy, customer, insurer, vehicle, chassis, engine, risk or source"
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
          <Link prefetch={false} href="/policies/new" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.22)]"><Plus className="h-4 w-4" />Add Policy</Link>
        </div>
      </div>

      <div className="border-b border-[#E5ECF5] bg-white px-3 py-2 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:grid xl:grid-cols-[minmax(150px,0.86fr)_minmax(150px,0.9fr)_minmax(160px,1fr)_minmax(170px,0.9fr)_minmax(330px,auto)] xl:gap-1.5">
          <PolicyBusinessFilter
            business={business}
            category={category}
            categories={categories}
            onBusinessChange={(value) => {
              setBusiness(value);
              if (value !== "Non Motor") setCategory("all");
              if (value === "Non Motor" && view === "claims") setView("all");
              setPage(1);
            }}
            onCategoryChange={(value) => { setCategory(value); setPage(1); }}
          />
          <div className="[&>label]:block [&>label]:w-full [&_select]:min-w-[170px] [&_select]:w-full">
            <RegisterSelect value={source} onChange={(value) => { setSource(value); setPage(1); }} label="Lead source">
              <option value="all">All Sources</option>
              {sourceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </RegisterSelect>
          </div>
          <div className="[&>label]:block [&>label]:w-full [&_select]:min-w-[180px] [&_select]:w-full">
            <RegisterSelect value={insurer} onChange={(value) => { setInsurer(value); setPage(1); }} label="Insurance company">
              <option value="all">All insurers</option>
              {insurers.map((item) => <option key={item} value={item}>{item}</option>)}
            </RegisterSelect>
          </div>
          <PolicyDateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={changeCustomFromDate}
            onToDateChange={changeCustomToDate}
            onClear={() => { setFromDate(""); setToDate(""); setPage(1); }}
          />
          <div className="min-w-0 max-w-full xl:min-w-[330px]">
            <div className="flex w-full items-center gap-0.5 overflow-visible rounded-xl border border-[#D8E2EE] bg-[#F8FAFC] p-1">
              <PolicyPeriodFilter value={timeScope} mtdCount={mtdFiltered.length} allCount={controlFiltered.length} onChange={changeTimeScope} />
              <div className="min-w-0 flex-1 [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0 xl:[&_button]:px-2.5 xl:[&_button]:text-[10px]">
                <RegisterViewTabs
                  value={view}
                  onChange={changeView}
                  options={[
                    { value: "active", label: "Active", count: stats.active },
                    { value: "expiring", label: "Due", count: stats.expiring },
                    { value: "expired", label: "Expired", count: stats.expired },
                    { value: "claims", label: "Claims", count: business === "Non Motor" ? undefined : stats.claims, disabled: business === "Non Motor", title: business === "Non Motor" ? "Non-Motor claim workflow is not enabled yet." : undefined }
                  ]}
                />
              </div>
            </div>
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
              <th className="w-[190px] px-3 py-2">Policy / Product</th>
              <th className="w-[188px] px-2.5 py-2">Customer</th>
              <th className="w-[142px] px-2.5 py-2">Risk / Asset</th>
              <th className="w-[178px] px-2.5 py-2">Insurer</th>
              <th className="w-[156px] px-2.5 py-2">Validity</th>
              <th className="w-[118px] px-2.5 py-2">Status</th>
              <th className="w-[108px] px-2.5 py-2 text-right">Insured Value</th>
              <th className="w-[108px] px-2.5 py-2 text-right">Gross Premium</th>
              <th className="w-[132px] px-2.5 py-2">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {pageRows.map((policy) => (
              <tr key={policy.id} className="h-12 transition hover:bg-[#FAFCFF]">
                <td className="px-3"><PolicyTypeLink policy={policy} openingDocumentId={openingDocumentId} onOpenDocument={openDocument} /></td>
                <td className="px-2.5"><p className="truncate font-semibold text-[#334155]">{policy.customers?.contact_name ?? "-"}</p><p className="truncate text-[9px] leading-4 text-[#64748B]">{policy.customers?.company_name ?? "Individual account"}</p></td>
                <td className="px-2.5"><RiskAssetCell policy={policy} /></td>
                <td className="px-2.5"><span className="block truncate">{policy.insurance_companies?.name ?? "-"}</span></td>
                <td className="px-2.5"><p className="font-semibold">{formatDate(policy.start_date)} - {formatDate(policy.end_date)}</p><p className="text-[9px] leading-4 text-[#64748B]">{validityHint(policy)}</p></td>
                <td className="px-2.5"><PolicyStatus policy={policy} /></td>
                <td className="px-2.5 text-right"><InsuredValueCell policy={policy} /></td>
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
  const isNonMotor = policyBusinessLine(policy) === "Non Motor";
  return (
    <article className="mobile-record-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link prefetch={false} href={`/policies/${policy.id}/edit`} className="block truncate text-[15px] font-extrabold text-[#12203B]">{policy.policy_no}</Link>
          <p className="mt-0.5 truncate text-[12px] text-[#66748A]">{policyBusinessLine(policy)} · {policyCategory(policy)}</p>
        </div>
        <PolicyStatus policy={policy} />
      </div>
      <div className="mt-3 grid gap-2 text-[12px] text-[#53627A]">
        <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{policy.customers?.contact_name ?? "Customer not linked"}</span>
        <div className="grid grid-cols-2 gap-2">
          <span className="min-w-0 rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold"><span className="block truncate">{riskAssetPrimary(policy)}</span>{riskAssetSecondary(policy) ? <span className="mt-0.5 block truncate text-[9px] font-medium text-[#8490A1]">{riskAssetSecondary(policy)}</span> : null}</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{validityHint(policy)}</span>
        </div>
        <div className={`grid gap-2 ${isNonMotor ? "grid-cols-2" : "grid-cols-3"}`}>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{insuredValuePrefix(policy)} {formatCurrency(policy.insured_declared_value)}</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{formatCurrency(policy.gross_premium)}</span>
          {!isNonMotor ? <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{claimCount(policy)} claims</span> : null}
        </div>
      </div>
      <div className={`mt-3 grid gap-2 ${isNonMotor ? "grid-cols-1" : "grid-cols-2"}`}>
        <Link prefetch={false} href={`/policies/${policy.id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#111A35] px-3 text-[12px] font-bold text-white">Open policy</Link>
        {!isNonMotor ? <Link prefetch={false} href="/claims/new" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#BFD3F7] bg-[#F0F6FF] px-3 text-[12px] font-bold text-[#174EA6]">Report claim</Link> : null}
      </div>
    </article>
  );
}

function PolicyStatus({ policy }: { policy: PolicyRow & { status?: string; daysLeft?: number } }) {
  const status = policy.status ?? policyStatus(policy.end_date);
  if (status === "Expired") return <RegisterStatusPill tone="red">Expired</RegisterStatusPill>;
  if (status === "Expiring soon") return <RegisterStatusPill tone="amber">Due</RegisterStatusPill>;
  return <RegisterStatusPill tone="green">Active</RegisterStatusPill>;
}

function PolicyTypeLink({ policy, openingDocumentId, onOpenDocument }: { policy: PolicyRow; openingDocumentId: string | null; onOpenDocument: (document: PolicyDocument) => void; }) {
  const businessLine = policyBusinessLine(policy);
  const category = policyCategory(policy);
  const product = policy.policy_product?.trim();
  const policyCopy = policy.policy_documents?.find((document) => document.document_type === "policy_copy") ?? null;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Link prefetch={false} href={`/policies/${policy.id}/edit`} title={policy.policy_no} className="min-w-0 text-[12px] text-[#0F172A] hover:text-[#17365D] hover:underline">
        <span className="block truncate"><span className="font-bold">{businessLine}</span><span aria-hidden="true" className="mx-1 text-[11px] font-normal">•</span><span className="font-normal">{category || "-"}</span></span>
        {product && product.toLowerCase() !== category.toLowerCase() ? <span className="block truncate text-[8.5px] leading-3.5 text-[#7C899B]">{product}</span> : null}
      </Link>
      {policyCopy ? (
        <button type="button" onClick={() => onOpenDocument(policyCopy)} disabled={openingDocumentId === policyCopy.id} aria-label={`Open policy copy for ${policy.policy_no}`} title={policyCopy.file_name ? `Open policy copy: ${policyCopy.file_name}` : "Open policy copy"} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-[#7c3aed] transition hover:bg-[#E9D5FF] hover:text-[#6D28D9] disabled:cursor-wait disabled:opacity-50">
          <Files className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function RiskAssetCell({ policy }: { policy: PolicyRow }) {
  return <div className="min-w-0"><p className={`truncate font-semibold text-[#334155] ${policyBusinessLine(policy) === "Motor" ? "font-mono" : ""}`}>{riskAssetPrimary(policy)}</p>{riskAssetSecondary(policy) ? <p className="truncate text-[8.5px] leading-3.5 text-[#7C899B]">{riskAssetSecondary(policy)}</p> : null}</div>;
}

function InsuredValueCell({ policy }: { policy: PolicyRow }) {
  return <div className="text-right tabular-nums"><p className="font-semibold text-[#334155]">{formatCurrency(policy.insured_declared_value)}</p><p className="text-[8px] font-bold uppercase tracking-[.06em] text-[#8A96A7]">{insuredValuePrefix(policy)}</p></div>;
}

function policyBusinessLine(policy: PolicyRow) {
  return policy.business_line?.trim() || "Motor";
}

function policyCategory(policy: PolicyRow) {
  if (policyBusinessLine(policy) === "Non Motor") return policy.non_motor_policy_details?.category?.trim() || policy.policy_type?.trim() || "Other";
  return policy.policy_type?.trim() || "Other";
}

function riskAssetPrimary(policy: PolicyRow) {
  if (policyBusinessLine(policy) !== "Non Motor") return policy.vehicles?.vehicle_no?.trim() || "Vehicle not linked";
  const detail = policy.non_motor_policy_details;
  const risk = detail?.risk_details ?? {};
  return firstText(
    detail?.risk_title,
    risk.cargoDescription,
    risk.projectName,
    risk.businessName,
    detail?.transit_from && detail?.transit_to ? `${detail.transit_from} → ${detail.transit_to}` : null,
    detail?.nature_of_business,
    detail?.liability_type,
    detail?.risk_location,
    "Non-Motor risk"
  );
}

function riskAssetSecondary(policy: PolicyRow) {
  if (policyBusinessLine(policy) !== "Non Motor") return "";
  const detail = policy.non_motor_policy_details;
  const primary = riskAssetPrimary(policy);
  const location = detail?.risk_location?.trim();
  if (location && location !== primary) return location;
  if (detail?.transit_from && detail?.transit_to) {
    const route = `${detail.transit_from} → ${detail.transit_to}`;
    if (route !== primary) return route;
  }
  return "";
}

function insuredValuePrefix(policy: PolicyRow) {
  if (policyBusinessLine(policy) !== "Non Motor") return "IDV";
  return /liability/i.test(policyCategory(policy)) ? "Limit" : "SI";
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "—";
}

function validityHint(policy: PolicyRow & { daysLeft?: number }) {
  const days = policy.daysLeft ?? daysUntil(policy.end_date);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Expires today";
  return `${days} days left`;
}
function policyBusinessDate(row: Pick<PolicyRow, "issuance_date" | "created_at">) {
  return row.issuance_date || row.created_at.slice(0, 10);
}

function monthToDateBounds() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${day}` };
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
function shortFilterDate(value: string) {
  const [, month, day] = value.split("-");
  return month && day ? `${day}/${month}` : value;
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
