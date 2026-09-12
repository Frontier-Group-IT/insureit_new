"use client";

import Link from "next/link";
import { Eye, FileText, Plus, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { RegisterPagination, RegisterStatusPill, RegisterViewTabs } from "@/components/broker-register";

type Row = {
  id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  insured_declared_value: number | null;
  premium_amount: number | null;
  customers: { contact_name: string } | null;
  vehicles: { vehicle_no: string; chassis_no: string | null; engine_no: string | null } | null;
  insurance_companies: { name: string } | null;
};

type ViewKey = "all" | "active" | "expiring" | "expired";

const PAGE_SIZE = 10;

export function BackofficePolicyRegister({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [page, setPage] = useState(1);

  const enriched = useMemo(
    () => rows.map((row) => ({ ...row, status: policyStatus(row.end_date), daysLeft: daysUntil(row.end_date) })),
    [rows],
  );

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter((row) =>
      [
        row.policy_no,
        row.policy_type,
        row.customers?.contact_name,
        row.vehicles?.vehicle_no,
        row.vehicles?.chassis_no,
        row.vehicles?.engine_no,
        row.insurance_companies?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [enriched, query]);

  const stats = useMemo(() => ({
    all: searched.length,
    active: searched.filter((row) => row.status === "Active").length,
    expiring: searched.filter((row) => row.status === "Expiring soon").length,
    expired: searched.filter((row) => row.status === "Expired").length,
  }), [searched]);

  const filtered = useMemo(
    () => searched.filter((row) =>
      view === "all" ||
      (view === "active" && row.status === "Active") ||
      (view === "expiring" && row.status === "Expiring soon") ||
      (view === "expired" && row.status === "Expired"),
    ),
    [searched, view],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resetFilters() {
    setQuery("");
    setView("all");
    setPage(1);
  }

  function changeView(next: string) {
    setView(next as ViewKey);
    setPage(1);
  }

  return (
    <section className="mx-auto max-w-[1480px] overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
      <div className="border-b border-[#E5ECF5] bg-[#F8FAFC] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17365D] text-white shadow-[0_10px_22px_rgba(23,54,93,0.18)]">
              <FileText className="h-5 w-5" />
            </span>
            <h2 className="shrink-0 text-[18px] font-semibold leading-tight text-[#0F172A]">Policy Portfolio</h2>
            <label className="relative ml-1 min-w-0 flex-1 lg:max-w-[430px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B93AA]" />
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder="Search policy, customer, insurer, vehicle, chassis or engine"
                aria-label="Search policy, customer, insurer, vehicle, chassis or engine"
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
          <Link prefetch={false} href="/policies/new" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.22)]">
            <Plus className="h-4 w-4" />Add Policy
          </Link>
        </div>
      </div>

      <div className="border-b border-[#E5ECF5] bg-white px-3 py-2 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex h-10 min-w-[150px] items-center rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] font-semibold text-[#334155]">
            All Policies
          </div>
          <div className="min-w-0 [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-0">
            <RegisterViewTabs
              value={view}
              onChange={changeView}
              options={[
                { value: "all", label: "All", count: stats.all },
                { value: "active", label: "Active", count: stats.active },
                { value: "expiring", label: "Due", count: stats.expiring },
                { value: "expired", label: "Expired", count: stats.expired },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="mobile-card-list p-3 md:hidden">
        {pageRows.map((row) => (
          <article key={row.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold text-[#17203A]">{row.policy_no}</p>
                <p className="mt-0.5 truncate text-[10px] text-[#64748B]">{pretty(row.policy_type)}</p>
              </div>
              <PolicyStatus status={row.status} />
            </div>
            <div className="mt-3 grid gap-2 text-[11px] text-[#53627A]">
              <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{row.customers?.contact_name ?? "—"}</span>
              <div className="grid grid-cols-2 gap-2">
                <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-mono font-semibold">{row.vehicles?.vehicle_no ?? "—"}</span>
                <span className="rounded-xl bg-[#F7F9FC] px-3 py-2 font-semibold">{validityHint(row.daysLeft)}</span>
              </div>
            </div>
            <Link prefetch={false} href={`/policies/${row.id}`} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#111A35] px-3 text-[11px] font-bold text-white">
              <Eye className="h-3.5 w-3.5" />View policy
            </Link>
          </article>
        ))}
        {!pageRows.length ? <Empty /> : null}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1098px] table-fixed text-left text-[11px] text-[#252944]">
          <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9px] font-bold uppercase tracking-[0.06em] text-[#64748B]">
            <tr>
              <th className="w-[180px] px-3 py-2">Policy / Product</th>
              <th className="w-[180px] px-2.5 py-2">Customer</th>
              <th className="w-[140px] px-2.5 py-2">Risk / Asset</th>
              <th className="w-[180px] px-2.5 py-2">Insurer</th>
              <th className="w-[160px] px-2.5 py-2">Validity</th>
              <th className="w-[112px] px-2.5 py-2">Status</th>
              <th className="w-[118px] px-2.5 py-2 text-right">Insured Value</th>
              <th className="w-[108px] px-2.5 py-2 text-right">Premium</th>
              <th className="w-[104px] px-3 py-2 text-right">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F6]">
            {pageRows.map((row) => (
              <tr key={row.id} className="h-12 transition hover:bg-[#FAFCFF]">
                <td className="px-3">
                  <Link prefetch={false} href={`/policies/${row.id}`} className="block min-w-0 hover:text-[#17365D] hover:underline">
                    <span className="block truncate font-bold text-[#0F172A]">{row.policy_no}</span>
                    <span className="block truncate text-[8.5px] leading-3.5 text-[#7C899B]">{pretty(row.policy_type)}</span>
                  </Link>
                </td>
                <td className="px-2.5"><p className="truncate font-semibold text-[#334155]">{row.customers?.contact_name ?? "—"}</p></td>
                <td className="px-2.5"><p className="truncate font-mono font-semibold text-[#334155]">{row.vehicles?.vehicle_no ?? "—"}</p></td>
                <td className="px-2.5"><span className="block truncate">{row.insurance_companies?.name ?? "—"}</span></td>
                <td className="px-2.5"><p className="font-semibold">{date(row.start_date)} - {date(row.end_date)}</p><p className="text-[9px] leading-4 text-[#64748B]">{validityHint(row.daysLeft)}</p></td>
                <td className="px-2.5"><PolicyStatus status={row.status} /></td>
                <td className="px-2.5 text-right font-semibold tabular-nums">{money(row.insured_declared_value)}</td>
                <td className="px-2.5 text-right font-semibold tabular-nums">{money(row.premium_amount)}</td>
                <td className="px-3 text-right"><Link prefetch={false} href={`/policies/${row.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#CFE0F2] bg-[#EFF6FF] px-3 font-bold text-[#315B9A]"><Eye className="h-3.5 w-3.5" />View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pageRows.length ? <Empty /> : null}
      </div>

      <RegisterPagination
        pageRows={pageRows.length}
        filteredRows={filtered.length}
        safePage={safePage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPrevious={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
      />
    </section>
  );
}

function PolicyStatus({ status }: { status: "Active" | "Expiring soon" | "Expired" }) {
  if (status === "Expired") return <RegisterStatusPill tone="red">Expired</RegisterStatusPill>;
  if (status === "Expiring soon") return <RegisterStatusPill tone="amber">Due</RegisterStatusPill>;
  return <RegisterStatusPill tone="green">Active</RegisterStatusPill>;
}

function Empty() {
  return <div className="px-5 py-10 text-center text-[10px] text-[#7A8798]">No matching policies found.</div>;
}

function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function date(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function money(value: number | null) {
  return value == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function policyStatus(endDate: string): "Active" | "Expiring soon" | "Expired" {
  const days = daysUntil(endDate);
  return days < 0 ? "Expired" : days <= 30 ? "Expiring soon" : "Active";
}

function daysUntil(endDate: string) {
  const end = new Date(`${endDate}T23:59:59`);
  const now = new Date();
  if (Number.isNaN(end.getTime())) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

function validityHint(days: number) {
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Expires today";
  return `${days} days left`;
}
