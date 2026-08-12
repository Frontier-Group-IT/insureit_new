"use client";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  BrokerRegisterShell,
  BrokerRegisterToolbar,
  RegisterEmpty,
  RegisterPagination,
  RegisterSelect,
  RegisterStatusPill,
  RegisterViewTabs
} from "@/components/broker-register";

type PolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  insured_declared_value: number | null;
  premium_amount: number | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
  insurance_companies: { name: string } | null;
  claims: { count: number }[];
};

type ViewKey = "all" | "active" | "expiring" | "expired" | "high_value" | "claims";
const PAGE_SIZE = 15;

export function PolicyWorkspace({ rows }: { rows: PolicyRow[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [insurer, setInsurer] = useState("all");
  const [page, setPage] = useState(1);

  const enriched = useMemo(() => rows.map((row) => ({ ...row, status: policyStatus(row.end_date), daysLeft: daysUntil(row.end_date) })), [rows]);
  const stats = useMemo(() => {
    const active = enriched.filter((row) => row.status === "Active").length;
    const expiring = enriched.filter((row) => row.status === "Expiring soon").length;
    const expired = enriched.filter((row) => row.status === "Expired").length;
    const claims = enriched.reduce((total, row) => total + claimCount(row), 0);
    return { active, expiring, expired, claims };
  }, [enriched]);
  const insurers = useMemo(() => Array.from(new Set(rows.map((row) => row.insurance_companies?.name).filter(Boolean))).sort() as string[], [rows]);
  const highValueThreshold = useMemo(() => {
    const values = rows.map((row) => Number(row.insured_declared_value ?? 0)).filter((value) => value > 0).sort((a, b) => b - a);
    return values[Math.min(values.length - 1, 9)] ?? 0;
  }, [rows]);

  const filtered = useMemo(() => enriched.filter((row) => {
    const haystack = [row.policy_no, row.policy_type, row.insurance_companies?.name, row.vehicles?.vehicle_no, row.customers?.company_name, row.customers?.contact_name, row.intermediary_type, row.intermediary_code].filter(Boolean).join(" ").toLowerCase();
    const matchesInsurer = insurer === "all" || row.insurance_companies?.name === insurer;
    const matchesView =
      view === "all" ||
      (view === "active" && row.status === "Active") ||
      (view === "expiring" && row.status === "Expiring soon") ||
      (view === "expired" && row.status === "Expired") ||
      (view === "high_value" && Number(row.insured_declared_value ?? 0) >= highValueThreshold && highValueThreshold > 0) ||
      (view === "claims" && claimCount(row) > 0);
    return matchesInsurer && matchesView && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  }), [enriched, highValueThreshold, insurer, query, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function changeView(next: string) {
    setView(next as ViewKey);
    setPage(1);
  }

  return (
    <BrokerRegisterShell
      eyebrow="Coverage register"
      title="Policy Portfolio"
      description="Prioritize renewals, expired cover, insurer spread, premium value and claim-linked policies."
      icon={<FileText className="h-5 w-5" />}
      metrics={[
        { label: "Policies", value: rows.length, hint: "Accessible cover", tone: "navy" },
        { label: "Active", value: stats.active, hint: "In force", tone: "green" },
        { label: "Renewal due", value: stats.expiring, hint: "Next 30 days", tone: stats.expiring ? "amber" : "slate" },
        { label: "Expired", value: stats.expired, hint: "Coverage gap", tone: stats.expired ? "red" : "slate" }
      ]}
    >
      <BrokerRegisterToolbar
        query={query}
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        searchPlaceholder="Search policy, insurer, vehicle, source or customer"
        activeViewLabel={`${filtered.length} in current view`}
        action={<Link href="/policies/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.22)]"><Plus className="h-4 w-4" />Add Policy</Link>}
      >
        <RegisterViewTabs
          value={view}
          onChange={changeView}
          options={[
            { value: "all", label: "All", count: rows.length },
            { value: "active", label: "Active", count: stats.active },
            { value: "expiring", label: "Renewal due", count: stats.expiring },
            { value: "expired", label: "Expired", count: stats.expired },
            { value: "high_value", label: "High value" },
            { value: "claims", label: "Claims", count: rows.filter((row) => claimCount(row) > 0).length }
          ]}
        />
        <RegisterSelect value={insurer} onChange={(value) => { setInsurer(value); setPage(1); }} label="Insurance company">
          <option value="all">All insurers</option>
          {insurers.map((item) => <option key={item} value={item}>{item}</option>)}
        </RegisterSelect>
      </BrokerRegisterToolbar>

      <div className="mobile-card-list p-3 md:hidden">
        {pageRows.map((policy) => <PolicyMobileCard key={policy.id} policy={policy} />)}
        {!pageRows.length ? <RegisterEmpty title="No matching policies" description="Adjust the search, insurer or saved view." /> : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1260px] table-fixed text-left text-[11px] text-[#252944]">
          <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
            <tr>
              <th className="w-[190px] px-4 py-3">Policy</th>
              <th className="w-[188px] px-3 py-3">Customer</th>
              <th className="w-[142px] px-3 py-3">Vehicle</th>
              <th className="w-[178px] px-3 py-3">Insurer</th>
              <th className="w-[156px] px-3 py-3">Validity</th>
              <th className="w-[118px] px-3 py-3">Status</th>
              <th className="w-[108px] px-3 py-3 text-right">IDV</th>
              <th className="w-[108px] px-3 py-3 text-right">Premium</th>
              <th className="w-[132px] px-3 py-3">Source</th>
              <th className="w-[86px] px-3 py-3 text-center">Claims</th>
              <th className="w-[72px] px-3 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {pageRows.map((policy) => (
              <tr key={policy.id} className="h-14 transition hover:bg-[#FAFCFF]">
                <td className="px-4"><Link href={`/policies/${policy.id}/edit`} className="block truncate text-[12px] font-bold text-[#0F172A] hover:text-[#17365D]">{policy.policy_no}</Link><p className="mt-0.5 truncate text-[9.5px] text-[#64748B]">{policy.policy_type}</p></td>
                <td className="px-3"><p className="truncate font-semibold text-[#334155]">{policy.customers?.contact_name ?? "-"}</p><p className="mt-0.5 truncate text-[9.5px] text-[#64748B]">{policy.customers?.company_name ?? "Individual account"}</p></td>
                <td className="px-3 font-mono">{policy.vehicles?.vehicle_no ?? "-"}</td>
                <td className="px-3"><span className="block truncate">{policy.insurance_companies?.name ?? "-"}</span></td>
                <td className="px-3"><p className="font-semibold">{formatDate(policy.start_date)} - {formatDate(policy.end_date)}</p><p className="mt-0.5 text-[9.5px] text-[#64748B]">{validityHint(policy)}</p></td>
                <td className="px-3"><PolicyStatus policy={policy} /></td>
                <td className="px-3 text-right font-semibold tabular-nums">{formatCurrency(policy.insured_declared_value)}</td>
                <td className="px-3 text-right font-semibold tabular-nums">{formatCurrency(policy.premium_amount)}</td>
                <td className="px-3"><p className="truncate font-semibold capitalize">{policy.intermediary_type?.replaceAll("_", " ") ?? "Direct"}</p><p className="mt-0.5 truncate text-[9.5px] text-[#64748B]">{policy.intermediary_code ?? "Sankalp"}</p></td>
                <td className="px-3 text-center"><Count value={claimCount(policy)} warn={claimCount(policy) > 0} /></td>
                <td className="px-3 text-center"><Link href={`/policies/${policy.id}/edit`} className="rounded-lg border border-[#BFD3F7] bg-[#F0F6FF] px-2.5 py-1.5 text-[9.5px] font-bold text-[#174EA6]">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pageRows.length ? <RegisterEmpty title="No matching policies" description="Adjust the search, insurer or saved view." /> : null}
      </div>

      <RegisterPagination pageRows={pageRows.length} filteredRows={filtered.length} safePage={safePage} totalPages={totalPages} pageSize={PAGE_SIZE} onPrevious={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} />
    </BrokerRegisterShell>
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
          <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 text-center font-semibold">{formatCurrency(policy.premium_amount)}</span>
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

function Count({ value, warn = false }: { value: number; warn?: boolean }) {
  return <div><p className={`text-[13px] font-bold tabular-nums ${warn ? "text-rose-700" : "text-[#0F172A]"}`}>{value}</p><p className="mt-0.5 text-[8.5px] text-[#94A3B8]">claims</p></div>;
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
function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
function formatCurrency(value: number | null) {
  if (!value) return "-";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0, style: "currency", currency: "INR" }).format(value);
}
function claimCount(row: PolicyRow) { return row.claims?.[0]?.count ?? 0; }
