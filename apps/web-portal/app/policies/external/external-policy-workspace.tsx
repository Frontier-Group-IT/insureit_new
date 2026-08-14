"use client";

import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  BrokerRegisterShell,
  BrokerRegisterToolbar,
  RegisterEmpty,
  RegisterPagination,
  RegisterSelect,
  RegisterStatusPill,
  RegisterViewTabs,
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

type ViewKey = "all" | "active" | "expiring" | "expired" | "claims";
const PAGE_SIZE = 15;

export function ExternalPolicyWorkspace({ rows, canEdit }: { rows: ExternalPolicyRow[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [insurer, setInsurer] = useState("all");
  const [page, setPage] = useState(1);

  const enriched = useMemo(() => rows.map((row) => ({ ...row, status: policyStatus(row.end_date), daysLeft: daysUntil(row.end_date) })), [rows]);
  const stats = useMemo(() => ({
    active: enriched.filter((row) => row.status === "Active").length,
    expiring: enriched.filter((row) => row.status === "Expiring soon").length,
    expired: enriched.filter((row) => row.status === "Expired").length,
  }), [enriched]);
  const insurers = useMemo(() => Array.from(new Set(rows.map((row) => row.insurance_companies?.name).filter(Boolean))).sort() as string[], [rows]);

  const filtered = useMemo(() => enriched.filter((row) => {
    const haystack = [row.policy_no, row.policy_type, row.insurance_companies?.name, row.vehicles?.vehicle_no, row.customers?.company_name, row.customers?.contact_name, row.added_via].filter(Boolean).join(" ").toLowerCase();
    const matchesInsurer = insurer === "all" || row.insurance_companies?.name === insurer;
    const matchesView = view === "all" || (view === "active" && row.status === "Active") || (view === "expiring" && row.status === "Expiring soon") || (view === "expired" && row.status === "Expired") || (view === "claims" && row.claim_count > 0);
    return matchesInsurer && matchesView && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  }), [enriched, insurer, query, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <BrokerRegisterShell
      eyebrow="Customer-recorded coverage"
      title="External Policy Portfolio"
      description="Policies recorded outside Sankalp business. These records are linked to existing customers and vehicles but remain excluded from the SIBL policy register and business calculations."
      icon={<ExternalLink className="h-5 w-5" />}
      metrics={[
        { label: "External Policies", value: rows.length, hint: "Separate portfolio", tone: "navy" },
        { label: "Active", value: stats.active, hint: "In force", tone: "green" },
        { label: "Renewal due", value: stats.expiring, hint: "Next 30 days", tone: stats.expiring ? "amber" : "slate" },
        { label: "Expired", value: stats.expired, hint: "Coverage gap", tone: stats.expired ? "red" : "slate" },
      ]}
    >
      <BrokerRegisterToolbar
        query={query}
        onQueryChange={(value) => { setQuery(value); setPage(1); }}
        searchPlaceholder="Search policy, insurer, vehicle or customer"
        activeViewLabel={`${filtered.length} in current view`}
        action={canEdit ? <Link href="/policies/external/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.22)]"><Plus className="h-4 w-4" />Add External Policy</Link> : undefined}
      >
        <RegisterViewTabs value={view} onChange={(value) => { setView(value as ViewKey); setPage(1); }} options={[
          { value: "all", label: "All", count: rows.length },
          { value: "active", label: "Active", count: stats.active },
          { value: "expiring", label: "Renewal due", count: stats.expiring },
          { value: "expired", label: "Expired", count: stats.expired },
          { value: "claims", label: "Claims", count: rows.filter((row) => row.claim_count > 0).length },
        ]} />
        <RegisterSelect value={insurer} onChange={(value) => { setInsurer(value); setPage(1); }} label="Insurance company">
          <option value="all">All insurers</option>
          {insurers.map((item) => <option key={item} value={item}>{item}</option>)}
        </RegisterSelect>
      </BrokerRegisterToolbar>

      <div className="mobile-card-list p-3 md:hidden">
        {pageRows.map((policy) => <article key={policy.id} className="mobile-record-card">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/policies/external/${policy.id}/edit`} className="block truncate text-[15px] font-extrabold text-[#12203B]">{policy.policy_no}</Link><p className="mt-0.5 truncate text-[12px] text-[#66748A]">{policy.insurance_companies?.name ?? "Insurer not set"}</p></div><PolicyStatus endDate={policy.end_date} /></div>
          <div className="mt-3 grid gap-2 text-[12px] text-[#53627A]"><span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{policy.customers?.contact_name ?? "Customer not linked"}</span><div className="grid grid-cols-2 gap-2"><span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{policy.vehicles?.vehicle_no ?? "Vehicle not linked"}</span><span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{validityHint(policy.end_date)}</span></div></div>
          {canEdit ? <Link href={`/policies/external/${policy.id}/edit`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#111A35] px-3 text-[12px] font-bold text-white">Open policy</Link> : null}
        </article>)}
        {!pageRows.length ? <RegisterEmpty title="No matching external policies" description="Adjust the search, insurer or saved view." /> : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1080px] table-fixed text-left text-[11px] text-[#252944]">
          <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-[0.06em] text-[#64748B]"><tr><th className="w-[180px] px-3 py-2">Policy</th><th className="w-[190px] px-2.5 py-2">Customer</th><th className="w-[145px] px-2.5 py-2">Vehicle</th><th className="w-[180px] px-2.5 py-2">Insurer</th><th className="w-[170px] px-2.5 py-2">Validity</th><th className="w-[110px] px-2.5 py-2">Status</th><th className="w-[110px] px-2.5 py-2 text-right">IDV</th><th className="w-[110px] px-2.5 py-2 text-right">Premium</th><th className="w-[70px] px-2.5 py-2 text-center">Claims</th><th className="w-[80px] px-2.5 py-2 text-center">Action</th></tr></thead>
          <tbody className="divide-y divide-[#EEF2F6]">{pageRows.map((policy) => <tr key={policy.id} className="h-12 transition hover:bg-[#FAFCFF]"><td className="px-3"><Link href={`/policies/external/${policy.id}/edit`} className="block truncate text-[12px] font-bold text-[#0F172A] hover:text-[#17365D]">{policy.policy_no}</Link><p className="truncate text-[9px] leading-4 text-[#64748B]">{policy.policy_type}</p></td><td className="px-2.5"><p className="truncate font-semibold text-[#334155]">{policy.customers?.contact_name ?? "-"}</p><p className="truncate text-[9px] leading-4 text-[#64748B]">{policy.customers?.company_name ?? "Individual account"}</p></td><td className="px-2.5 font-mono">{policy.vehicles?.vehicle_no ?? "-"}</td><td className="px-2.5"><span className="block truncate">{policy.insurance_companies?.name ?? "-"}</span></td><td className="px-2.5"><p className="font-semibold">{formatDate(policy.start_date)} - {formatDate(policy.end_date)}</p><p className="text-[9px] leading-4 text-[#64748B]">{validityHint(policy.end_date)}</p></td><td className="px-2.5"><PolicyStatus endDate={policy.end_date} /></td><td className="px-2.5 text-right font-semibold tabular-nums">{formatCurrency(policy.insured_declared_value)}</td><td className="px-2.5 text-right font-semibold tabular-nums">{formatCurrency(policy.premium_amount)}</td><td className="px-2.5 text-center font-semibold">{policy.claim_count}</td><td className="px-2.5 text-center">{canEdit ? <Link href={`/policies/external/${policy.id}/edit`} className="rounded-lg border border-[#BFD3F7] bg-[#F0F6FF] px-2.5 py-1.5 text-[9.5px] font-bold text-[#174EA6]">Open</Link> : <span className="text-[9px] text-[#94A3B8]">View</span>}</td></tr>)}</tbody>
        </table>
        {!pageRows.length ? <RegisterEmpty title="No matching external policies" description="Adjust the search, insurer or saved view." /> : null}
      </div>
      <RegisterPagination pageRows={pageRows.length} filteredRows={filtered.length} safePage={safePage} totalPages={totalPages} pageSize={PAGE_SIZE} onPrevious={() => setPage((value) => Math.max(1, value - 1))} onNext={() => setPage((value) => Math.min(totalPages, value + 1))} />
    </BrokerRegisterShell>
  );
}

function PolicyStatus({ endDate }: { endDate: string }) { const status = policyStatus(endDate); return status === "Expired" ? <RegisterStatusPill tone="red">Expired</RegisterStatusPill> : status === "Expiring soon" ? <RegisterStatusPill tone="amber">Renewal due</RegisterStatusPill> : <RegisterStatusPill tone="green">Active</RegisterStatusPill>; }
function validityHint(endDate: string) { const days = daysUntil(endDate); return days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Expires today" : `${days} days left`; }
function policyStatus(endDate: string) { const days = daysUntil(endDate); return days < 0 ? "Expired" : days <= 30 ? "Expiring soon" : "Active"; }
function daysUntil(endDate: string) { const end = new Date(`${endDate}T23:59:59`); const now = new Date(); if (Number.isNaN(end.getTime())) return 0; return Math.ceil((end.getTime() - now.getTime()) / 86400000); }
function formatDate(value: string) { const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date); }
function formatCurrency(value: number | null) { if (!value) return "-"; return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0, style: "currency", currency: "INR" }).format(value); }
