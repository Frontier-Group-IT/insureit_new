"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Funnel, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import {
  BrokerRegisterShell,
  BrokerRegisterToolbar,
  RegisterEmpty,
  RegisterPagination,
  RegisterSelect,
  RegisterStatusPill,
  RegisterViewTabs
} from "@/components/broker-register";

type ExternalPolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  insured_declared_value: number | null;
  premium_amount: number | null;
  added_via: string;
  created_at: string;
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
  insurance_companies: { name: string } | null;
  claim_count: number;
};

type PolicyState = "Active" | "Expiring soon" | "Expired";
type ExternalPolicyViewRow = ExternalPolicyRow & { status: PolicyState };
type ViewKey = "all" | "active" | "expiring" | "expired" | "claims";
type ColumnFilters = {
  policyNo: string;
  customer: string;
  vehicle: string;
  insurer: string;
  validityFrom: string;
  validityTo: string;
  status: "all" | PolicyState;
  idvMin: string;
  premiumMin: string;
  claimsMin: string;
};

const PAGE_SIZE = 10;
const EMPTY_COLUMN_FILTERS: ColumnFilters = {
  policyNo: "",
  customer: "",
  vehicle: "",
  insurer: "all",
  validityFrom: "",
  validityTo: "",
  status: "all",
  idvMin: "",
  premiumMin: "",
  claimsMin: ""
};

export function ExternalPolicyWorkspace({ rows, canEdit }: { rows: ExternalPolicyRow[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [insurer, setInsurer] = useState("all");
  const [page, setPage] = useState(1);
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>(EMPTY_COLUMN_FILTERS);

  const enriched = useMemo<ExternalPolicyViewRow[]>(
    () => rows.map((row) => ({ ...row, status: policyStatus(row.end_date) })),
    [rows]
  );

  const stats = useMemo(() => ({
    active: enriched.filter((row) => row.status === "Active").length,
    expiring: enriched.filter((row) => row.status === "Expiring soon").length,
    expired: enriched.filter((row) => row.status === "Expired").length,
    claims: enriched.filter((row) => row.claim_count > 0).length,
  }), [enriched]);

  const insurers = useMemo(
    () => Array.from(new Set(rows.map((row) => row.insurance_companies?.name).filter(Boolean))).sort() as string[],
    [rows]
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const policyNoFilter = columnFilters.policyNo.trim().toLowerCase();
    const customerFilter = columnFilters.customer.trim().toLowerCase();
    const vehicleFilter = columnFilters.vehicle.trim().toLowerCase();
    const idvMin = Number(columnFilters.idvMin);
    const premiumMin = Number(columnFilters.premiumMin);
    const claimsMin = Number(columnFilters.claimsMin);

    return enriched.filter((row) => {
      const haystack = [
        row.policy_no,
        row.policy_type,
        row.insurance_companies?.name,
        row.vehicles?.vehicle_no,
        row.customers?.company_name,
        row.customers?.contact_name,
        row.added_via,
      ].filter(Boolean).join(" ").toLowerCase();
      const customerHaystack = [row.customers?.contact_name, row.customers?.company_name].filter(Boolean).join(" ").toLowerCase();
      const matchesInsurer = insurer === "all" || row.insurance_companies?.name === insurer;
      const matchesView = view === "all"
        || (view === "active" && row.status === "Active")
        || (view === "expiring" && row.status === "Expiring soon")
        || (view === "expired" && row.status === "Expired")
        || (view === "claims" && row.claim_count > 0);
      const matchesColumnInsurer = columnFilters.insurer === "all" || row.insurance_companies?.name === columnFilters.insurer;
      const matchesValidity = (!columnFilters.validityFrom || row.end_date >= columnFilters.validityFrom)
        && (!columnFilters.validityTo || row.start_date <= columnFilters.validityTo);
      const matchesStatus = columnFilters.status === "all" || row.status === columnFilters.status;
      const matchesIdv = !columnFilters.idvMin || ((row.insured_declared_value ?? -1) >= idvMin);
      const matchesPremium = !columnFilters.premiumMin || ((row.premium_amount ?? -1) >= premiumMin);
      const matchesClaims = !columnFilters.claimsMin || row.claim_count >= claimsMin;

      return matchesInsurer
        && matchesView
        && matchesColumnInsurer
        && matchesValidity
        && matchesStatus
        && matchesIdv
        && matchesPremium
        && matchesClaims
        && (!normalized || haystack.includes(normalized))
        && (!policyNoFilter || row.policy_no.toLowerCase().includes(policyNoFilter))
        && (!customerFilter || customerHaystack.includes(customerFilter))
        && (!vehicleFilter || (row.vehicles?.vehicle_no ?? "").toLowerCase().includes(vehicleFilter));
    });
  }, [columnFilters, enriched, insurer, query, view]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function changeView(next: string) {
    setView(next as ViewKey);
    setPage(1);
  }

  function setColumnFilter<K extends keyof ColumnFilters>(key: K, value: ColumnFilters[K]) {
    setColumnFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function resetFilters() {
    setQuery("");
    setView("all");
    setInsurer("all");
    setColumnFilters(EMPTY_COLUMN_FILTERS);
    setShowColumnFilters(false);
    setPage(1);
  }

  const hasColumnFilters = Object.entries(columnFilters).some(([key, value]) => key === "insurer" || key === "status" ? value !== "all" : Boolean(value));
  const resetDisabled = !query && insurer === "all" && view === "all" && !hasColumnFilters;

  return (
    <BrokerRegisterShell
      eyebrow="Policy register"
      title="External Policies"
      description="Review outside insurance policies linked to existing customers and vehicles from one compact register."
      icon={<ShieldCheck className="h-5 w-5" />}
      metrics={[
        { label: "Policies", value: rows.length, hint: "Accessible records", tone: "navy" },
        { label: "Active", value: stats.active, hint: "Currently valid", tone: "green" },
        { label: "Renewal due", value: stats.expiring, hint: "Within 30 days", tone: stats.expiring ? "amber" : "slate" },
        { label: "Claims", value: stats.claims, hint: "Policies with claims", tone: stats.claims ? "red" : "slate" }
      ]}
    >
      <BrokerRegisterToolbar
        query={query}
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        searchPlaceholder="Search policy, customer, vehicle or insurer"
        activeViewLabel={`${filteredRows.length} in current view`}
        action={canEdit ? (
          <Link href="/policies/external/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.22)]">
            <Plus className="h-4 w-4" />Add External Policy
          </Link>
        ) : undefined}
      >
        <RegisterViewTabs
          value={view}
          onChange={changeView}
          options={[
            { value: "all", label: "All", count: rows.length },
            { value: "active", label: "Active", count: stats.active },
            { value: "expiring", label: "Renewal due", count: stats.expiring },
            { value: "expired", label: "Expired", count: stats.expired },
            { value: "claims", label: "Claims", count: stats.claims }
          ]}
        />
        <RegisterSelect value={insurer} onChange={(value) => { setInsurer(value); setPage(1); }} label="Insurance company">
          <option value="all">All insurers</option>
          {insurers.map((item) => <option key={item} value={item}>{item}</option>)}
        </RegisterSelect>
        <button
          type="button"
          onClick={resetFilters}
          disabled={resetDisabled}
          aria-label="Reset filters"
          title="Reset filters"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white text-[#475569] transition hover:border-[#9FB2C8] hover:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#17365D]/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </BrokerRegisterToolbar>

      <div className="mobile-card-list p-3 md:hidden">
        {pageRows.map((policy) => <ExternalPolicyMobileCard key={policy.id} policy={policy} canEdit={canEdit} />)}
        {!pageRows.length ? <RegisterEmpty title="No matching policies" description="Adjust the search, insurer or status view." /> : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[930px] table-fixed text-left text-[11px] text-[#1E293B]">
          <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
            <tr>
              <FilterableHeader label="Policy No." active={Boolean(columnFilters.policyNo)} onToggle={() => setShowColumnFilters((current) => !current)} className="w-[115px]" />
              <FilterableHeader label="Customer" active={Boolean(columnFilters.customer)} onToggle={() => setShowColumnFilters((current) => !current)} className="w-[140px]" />
              <FilterableHeader label="Vehicle" active={Boolean(columnFilters.vehicle)} onToggle={() => setShowColumnFilters((current) => !current)} className="w-[95px]" />
              <FilterableHeader label="Insurer" active={columnFilters.insurer !== "all"} onToggle={() => setShowColumnFilters((current) => !current)} className="w-[135px]" />
              <FilterableHeader label="Validity" active={Boolean(columnFilters.validityFrom || columnFilters.validityTo)} onToggle={() => setShowColumnFilters((current) => !current)} className="w-[150px]" />
              <FilterableHeader label="Status" active={columnFilters.status !== "all"} onToggle={() => setShowColumnFilters((current) => !current)} className="w-[90px]" />
              <FilterableHeader label="IDV" active={Boolean(columnFilters.idvMin)} onToggle={() => setShowColumnFilters((current) => !current)} className="w-[80px] text-right" align="right" />
              <FilterableHeader label="Premium" active={Boolean(columnFilters.premiumMin)} onToggle={() => setShowColumnFilters((current) => !current)} className="w-[80px] text-right" align="right" />
              <FilterableHeader label="Claims" active={Boolean(columnFilters.claimsMin)} onToggle={() => setShowColumnFilters((current) => !current)} className="w-[45px] text-center" align="center" />
            </tr>
            {showColumnFilters ? (
              <tr className="border-t border-[#E2E8F0] bg-white normal-case tracking-normal">
                <th className="px-1.5 py-1.5"><ColumnInput value={columnFilters.policyNo} onChange={(value) => setColumnFilter("policyNo", value)} placeholder="Filter" /></th>
                <th className="px-1.5 py-1.5"><ColumnInput value={columnFilters.customer} onChange={(value) => setColumnFilter("customer", value)} placeholder="Filter" /></th>
                <th className="px-1.5 py-1.5"><ColumnInput value={columnFilters.vehicle} onChange={(value) => setColumnFilter("vehicle", value)} placeholder="Filter" /></th>
                <th className="px-1.5 py-1.5">
                  <ColumnSelect value={columnFilters.insurer} onChange={(value) => setColumnFilter("insurer", value)}>
                    <option value="all">All</option>
                    {insurers.map((item) => <option key={item} value={item}>{item}</option>)}
                  </ColumnSelect>
                </th>
                <th className="px-1.5 py-1.5">
                  <div className="grid gap-1">
                    <input type="date" value={columnFilters.validityFrom} max={columnFilters.validityTo || undefined} onChange={(event) => setColumnFilter("validityFrom", event.target.value)} aria-label="Validity from" className="h-7 w-full rounded-md border border-[#D8E2EE] bg-white px-1 text-[9px] font-medium text-[#475569] outline-none focus:border-[#17365D]" />
                    <input type="date" value={columnFilters.validityTo} min={columnFilters.validityFrom || undefined} onChange={(event) => setColumnFilter("validityTo", event.target.value)} aria-label="Validity to" className="h-7 w-full rounded-md border border-[#D8E2EE] bg-white px-1 text-[9px] font-medium text-[#475569] outline-none focus:border-[#17365D]" />
                  </div>
                </th>
                <th className="px-1.5 py-1.5">
                  <ColumnSelect value={columnFilters.status} onChange={(value) => setColumnFilter("status", value as ColumnFilters["status"])}>
                    <option value="all">All</option>
                    <option value="Active">Active</option>
                    <option value="Expiring soon">Renewal due</option>
                    <option value="Expired">Expired</option>
                  </ColumnSelect>
                </th>
                <th className="px-1.5 py-1.5"><ColumnInput type="number" value={columnFilters.idvMin} onChange={(value) => setColumnFilter("idvMin", value)} placeholder="Min" /></th>
                <th className="px-1.5 py-1.5"><ColumnInput type="number" value={columnFilters.premiumMin} onChange={(value) => setColumnFilter("premiumMin", value)} placeholder="Min" /></th>
                <th className="px-1.5 py-1.5"><ColumnInput type="number" value={columnFilters.claimsMin} onChange={(value) => setColumnFilter("claimsMin", value)} placeholder="Min" /></th>
              </tr>
            ) : null}
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {pageRows.map((policy) => (
              <tr key={policy.id} className="h-11 transition hover:bg-[#FAFCFF]">
                <td className="px-2.5">
                  {canEdit ? (
                    <Link href={`/policies/external/${policy.id}/edit`} className="block truncate text-[12px] font-bold text-[#17365D] hover:underline" title={policy.policy_no}>
                      {policy.policy_no}
                    </Link>
                  ) : (
                    <p className="truncate text-[12px] font-bold text-[#0F172A]" title={policy.policy_no}>{policy.policy_no}</p>
                  )}
                  <p className="truncate text-[9px] leading-4 text-[#64748B]">{policy.policy_type}</p>
                </td>
                <td className="px-2.5">
                  <p className="truncate font-semibold text-[#334155]">{policy.customers?.contact_name ?? "-"}</p>
                  {policy.customers?.company_name ? <p className="truncate text-[9px] leading-4 text-[#64748B]">{policy.customers.company_name}</p> : null}
                </td>
                <td className="px-2.5 font-semibold">{policy.vehicles?.vehicle_no ?? "-"}</td>
                <td className="px-2.5"><span className="block truncate" title={policy.insurance_companies?.name ?? "-"}>{policy.insurance_companies?.name ?? "-"}</span></td>
                <td className="px-2.5">
                  <p className="whitespace-nowrap font-semibold">{formatDate(policy.start_date)} - {formatDate(policy.end_date)}</p>
                  <p className={`text-[9px] leading-4 ${policy.status === "Expiring soon" ? "font-semibold text-amber-600" : policy.status === "Expired" ? "text-red-600" : "text-[#64748B]"}`}>{validityHint(policy.end_date)}</p>
                </td>
                <td className="px-2.5"><PolicyStatus status={policy.status} /></td>
                <td className="px-2.5 text-right font-semibold tabular-nums">{formatCurrency(policy.insured_declared_value)}</td>
                <td className="px-2.5 text-right font-semibold tabular-nums">{formatCurrency(policy.premium_amount)}</td>
                <td className="px-2.5 text-center font-semibold tabular-nums">{policy.claim_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pageRows.length ? <RegisterEmpty title="No matching policies" description="Adjust the search, insurer, status or column filters." /> : null}
      </div>

      <RegisterPagination
        pageRows={pageRows.length}
        filteredRows={filteredRows.length}
        safePage={safePage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPrevious={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
      />
    </BrokerRegisterShell>
  );
}

function FilterableHeader({ label, active, onToggle, className, align = "left" }: { label: string; active: boolean; onToggle: () => void; className: string; align?: "left" | "right" | "center" }) {
  return (
    <th className={`${className} px-2.5 py-2.5`}>
      <button type="button" onClick={onToggle} aria-label={`Toggle ${label} filter`} title={`Filter ${label}`} className={`inline-flex w-full items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"} ${active ? "text-[#17365D]" : "text-[#64748B]"}`}>
        <span>{label}</span>
        <Funnel className={`h-3 w-3 ${active ? "fill-current" : ""}`} />
      </button>
    </th>
  );
}

function ColumnInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (value: string) => void; placeholder: string; type?: "text" | "number" }) {
  return <input type={type} min={type === "number" ? 0 : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-7 w-full min-w-0 rounded-md border border-[#D8E2EE] bg-white px-2 text-[9px] font-medium text-[#475569] outline-none placeholder:text-[#A3AEC0] focus:border-[#17365D]" />;
}

function ColumnSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-full min-w-0 rounded-md border border-[#D8E2EE] bg-white px-1.5 text-[9px] font-medium text-[#475569] outline-none focus:border-[#17365D]">{children}</select>;
}

function ExternalPolicyMobileCard({ policy, canEdit }: { policy: ExternalPolicyViewRow; canEdit: boolean }) {
  return (
    <article className="mobile-record-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {canEdit ? (
            <Link href={`/policies/external/${policy.id}/edit`} className="block truncate text-[15px] font-extrabold text-[#12203B]">{policy.policy_no}</Link>
          ) : (
            <p className="truncate text-[15px] font-extrabold text-[#12203B]">{policy.policy_no}</p>
          )}
          <p className="mt-0.5 truncate text-[12px] text-[#66748A]">{policy.insurance_companies?.name ?? "Insurer not set"}</p>
        </div>
        <PolicyStatus status={policy.status} />
      </div>
      <div className="mt-3 grid gap-2 text-[12px] text-[#53627A]">
        <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{policy.customers?.contact_name ?? "Customer not linked"}</span>
        <div className="grid grid-cols-2 gap-2">
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{policy.vehicles?.vehicle_no ?? "Vehicle not linked"}</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{validityHint(policy.end_date)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{formatCurrency(policy.insured_declared_value)}</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{formatCurrency(policy.premium_amount)}</span>
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{policy.claim_count} claims</span>
        </div>
      </div>
    </article>
  );
}

function PolicyStatus({ status }: { status: PolicyState }) {
  if (status === "Expired") return <RegisterStatusPill tone="red">Expired</RegisterStatusPill>;
  if (status === "Expiring soon") return <RegisterStatusPill tone="amber">Renewal due</RegisterStatusPill>;
  return <RegisterStatusPill tone="green">Active</RegisterStatusPill>;
}

function validityHint(endDate: string) {
  const days = daysUntil(endDate);
  return days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Expires today" : `${days} days left`;
}

function policyStatus(endDate: string): PolicyState {
  const days = daysUntil(endDate);
  return days < 0 ? "Expired" : days <= 30 ? "Expiring soon" : "Active";
}

function daysUntil(endDate: string) {
  const end = new Date(`${endDate}T23:59:59`);
  const now = new Date();
  if (Number.isNaN(end.getTime())) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(date);
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0, style: "currency", currency: "INR" }).format(value);
}
