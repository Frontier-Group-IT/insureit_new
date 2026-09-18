"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CalendarRange, Check, Download, HandCoins, Loader2, ReceiptIndianRupee, TrendingUp, WalletCards } from "lucide-react";
import {
  BUSINESS_MIS_AMOUNT_COLUMNS,
  BUSINESS_MIS_DATE_COLUMNS,
  BUSINESS_MIS_HEADERS,
  BUSINESS_MIS_PERCENT_COLUMNS,
  type AccountsDashboardClientSnapshot,
  type BusinessMisClientCell,
} from "@/lib/accounts-business-mis-schema";
import { loadAccountsSnapshotAction } from "./accounts-snapshot-actions";
import { ReconciliationTools } from "./reconciliation-tools";

type Period = "last_month" | "mtd" | "custom";
type Filters = {
  period: Period;
  fromDate: string;
  toDate: string;
  insurerId: string | null;
};
type Result = { filters: Filters; snapshot: AccountsDashboardClientSnapshot };

type Props = {
  initialFilters: Filters;
  initialSnapshot: AccountsDashboardClientSnapshot;
};

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "last_month", label: "Last month" },
  { value: "mtd", label: "MTD" },
  { value: "custom", label: "Custom" },
];

export function AccountsDashboardClient({ initialFilters, initialSnapshot }: Props) {
  const [filters, setFilters] = useState(initialFilters);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [from, setFrom] = useState(initialFilters.fromDate);
  const [to, setTo] = useState(initialFilters.toDate);
  const [insurer, setInsurer] = useState(initialFilters.insurerId ?? "");
  const [isPending, setIsPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const cache = useRef(new Map<string, Result>());

  useEffect(() => {
    cache.current.set(cacheKey(filters.period, filters.fromDate, filters.toDate, filters.insurerId ?? ""), {
      filters,
      snapshot,
    });
  }, []); // Seed only the server-rendered snapshot.

  const exportHref = useMemo(() => {
    const params = new URLSearchParams({
      period: filters.period,
      from: filters.fromDate,
      to: filters.toDate,
    });
    if (filters.insurerId) params.set("insurer", filters.insurerId);
    return `/accounts/business-mis-export?${params.toString()}`;
  }, [filters]);

  const applyResult = (result: Result, href: string) => {
    setFilters(result.filters);
    setSnapshot(result.snapshot);
    setFrom(result.filters.fromDate);
    setTo(result.filters.toDate);
    setInsurer(result.filters.insurerId ?? "");
    setLoadError("");
    if (typeof window !== "undefined") window.history.replaceState(window.history.state, "", href);
  };

  const fetchResult = async (period: Period, nextFrom: string, nextTo: string, nextInsurer: string) => {
    const href = accountsHref(period, nextFrom, nextTo, nextInsurer);
    const key = cacheKey(period, nextFrom, nextTo, nextInsurer);
    const cached = cache.current.get(key);
    if (cached) {
      applyResult(cached, href);
      return;
    }

    setIsPending(true);
    setLoadError("");
    try {
      const result = await loadAccountsSnapshotAction({
        period,
        from: period === "custom" ? nextFrom : undefined,
        to: period === "custom" ? nextTo : undefined,
        insurer: nextInsurer || undefined,
      });
      cache.current.set(cacheKey(result.filters.period, result.filters.fromDate, result.filters.toDate, result.filters.insurerId ?? ""), result as Result);
      applyResult(result as Result, href);
    } catch {
      setLoadError("Accounts data could not be refreshed. Your current figures are still shown.");
    } finally {
      setIsPending(false);
    }
  };

  const prefetchResult = (period: Period, nextFrom = from, nextTo = to, nextInsurer = insurer) => {
    if (isPending) return;
    const key = cacheKey(period, nextFrom, nextTo, nextInsurer);
    if (cache.current.has(key)) return;
    void loadAccountsSnapshotAction({
      period,
      from: period === "custom" ? nextFrom : undefined,
      to: period === "custom" ? nextTo : undefined,
      insurer: nextInsurer || undefined,
    }).then((result) => {
      cache.current.set(cacheKey(result.filters.period, result.filters.fromDate, result.filters.toDate, result.filters.insurerId ?? ""), result as Result);
    }).catch(() => undefined);
  };

  const misLoadFailed = snapshot.warnings.length > 0 && snapshot.rows.length === 0;

  return <div className="mx-auto max-w-[1560px] space-y-2 pb-4">
    <section className="rounded-2xl border border-[#dbe3ee] bg-white px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold leading-5 text-[#17365D]">Accounts Dashboard</h1>
          <p className="text-[8px] font-medium text-[#7c899b]">{displayRange(filters.fromDate, filters.toDate)}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <ReconciliationTools />
          <span className="h-5 w-px bg-[#dce4ee]" aria-hidden="true" />
          <a href={exportHref} title="Export / download Business MIS" aria-label="Export / download Business MIS" className="grid h-8 w-8 place-items-center rounded-lg border border-[#17365D] bg-white text-[#17365D] shadow-sm transition hover:bg-[#f3f7fb]">
            <Download className="h-3.5 w-3.5" />
          </a>
          <div className="flex rounded-lg border border-[#dce4ee] bg-[#f8fafc] p-0.5">
            {PERIODS.map((item) => <button key={item.value} type="button" disabled={isPending} onMouseEnter={() => prefetchResult(item.value)} onFocus={() => prefetchResult(item.value)} onClick={() => void fetchResult(item.value, from, to, insurer)} className={`rounded-md px-2.5 py-1.5 text-[8px] font-bold transition ${filters.period === item.value ? "bg-[#17365D] text-white shadow-sm" : "text-[#667085] hover:bg-white hover:text-[#17365D]"} disabled:cursor-wait disabled:opacity-70`}>
              {item.label}
            </button>)}
          </div>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#667085]" aria-label="Updating dashboard" /> : null}
        </div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void fetchResult(filters.period, from, to, insurer); }} className="mt-2 basis-full grid gap-1.5 border-t border-[#edf1f5] pt-2 md:grid-cols-2 xl:grid-cols-[135px_135px_minmax(200px,1fr)_minmax(200px,1fr)_32px]">
        <FilterField label="From"><input name="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} disabled={filters.period !== "custom" || isPending} className="h-8 w-full rounded-lg border border-[#dce4ee] bg-white px-2 text-[8.5px] font-semibold text-[#344054] disabled:bg-[#f6f8fb] disabled:text-[#98a2b3]" /></FilterField>
        <FilterField label="To"><input name="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} disabled={filters.period !== "custom" || isPending} className="h-8 w-full rounded-lg border border-[#dce4ee] bg-white px-2 text-[8.5px] font-semibold text-[#344054] disabled:bg-[#f6f8fb] disabled:text-[#98a2b3]" /></FilterField>
        <FilterField label="Insurer"><select name="insurer" value={insurer} onChange={(event) => setInsurer(event.target.value)} disabled={isPending} className="h-8 w-full rounded-lg border border-[#dce4ee] bg-white px-2 text-[8.5px] font-semibold text-[#344054] disabled:bg-[#f6f8fb] disabled:text-[#98a2b3]"><option value="">All insurers</option>{snapshot.insurers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FilterField>
        <FilterField label="Branch"><select disabled className="h-8 w-full rounded-lg border border-dashed border-[#d8e1eb] bg-[#f7f9fc] px-2 text-[8.5px] font-semibold text-[#98a2b3]"><option>All branches · Coming soon</option></select></FilterField>
        <button type="submit" disabled={isPending} title="Apply filters" aria-label="Apply filters" className="mt-auto grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-white shadow-sm hover:bg-[#234b7a] disabled:cursor-wait disabled:opacity-60">{isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button>
      </form>
    </section>

    {loadError ? <section className="rounded-xl border border-[#f1d7a7] bg-[#fffaf0] px-3 py-1.5 text-[8.5px] font-semibold text-[#8a5a13]">{loadError}</section> : null}
    {snapshot.warnings.length ? <section className="rounded-xl border border-[#f1d7a7] bg-[#fffaf0] px-3 py-1.5 text-[8.5px] font-semibold text-[#8a5a13]">{snapshot.warnings.join(" ")}</section> : null}

    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard icon={CalendarRange} label="Policies" value={integer(snapshot.policyCount)} />
      <KpiCard icon={ReceiptIndianRupee} label="Net premium" value={currency(snapshot.netPremium)} />
      <KpiCard icon={WalletCards} label="Projected net pay-in" value={currency(snapshot.projectedNetPayin)} />
      <KpiCard icon={HandCoins} label="Projected net payout" value={currency(snapshot.projectedNetPayout)} />
      <KpiCard icon={TrendingUp} label="Projected retention" value={currency(snapshot.projectedRetention)} />
    </section>

    <BusinessMisTable rows={snapshot.rows} loadFailed={misLoadFailed} />
  </div>;
}

function BusinessMisTable({ rows, loadFailed }: { rows: BusinessMisClientCell[][]; loadFailed: boolean }) {
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-[#dbe3ee] bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-[#e8edf4] px-3 py-2">
      <h2 className="text-[11.5px] font-semibold text-[#17365D]">Business MIS</h2>
      <span className="shrink-0 rounded-full border border-[#dce4ee] bg-[#f8fafc] px-2 py-0.5 text-[7.5px] font-bold tabular-nums text-[#667085]">{integer(rows.length)} rows</span>
    </div>
    {loadFailed ? <div className="px-4 py-10 text-center text-[9px] font-semibold text-[#b42318]">Business MIS data could not be refreshed.</div> :
      <div className="max-h-[calc(100vh-255px)] min-h-[420px] overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-20">
            <tr>{BUSINESS_MIS_HEADERS.map((header, index) => <th key={header} className={headerClass(index)}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, rowIndex) => <tr key={`${rowIndex}-${String(row[12] ?? "")}`} className="group hover:bg-[#f8fbff]">
              {row.map((cell, columnIndex) => <td key={columnIndex} className={cellClass(columnIndex)}>{formatMisCell(cell, columnIndex)}</td>)}
            </tr>) : <tr><td colSpan={BUSINESS_MIS_HEADERS.length} className="px-4 py-12 text-center text-[9px] font-medium text-[#98a2b3]">No Business MIS records are available for the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>}
  </section>;
}

function headerClass(index: number) {
  const groupTone = index <= 7 ? "bg-[#f4f6fa]" : index <= 14 ? "bg-[#edf4fb]" : index <= 24 ? "bg-[#eef8f6]" : "bg-[#fff6e9]";
  const numeric = BUSINESS_MIS_AMOUNT_COLUMNS.has(index) || BUSINESS_MIS_PERCENT_COLUMNS.has(index) ? "text-right" : "text-left";
  return `${groupTone} ${numeric} whitespace-nowrap border-b border-r border-[#dfe6ef] px-3 py-2 text-[7.25px] font-black uppercase tracking-[.04em] text-[#526174]`;
}

function cellClass(index: number) {
  const numeric = BUSINESS_MIS_AMOUNT_COLUMNS.has(index) || BUSINESS_MIS_PERCENT_COLUMNS.has(index);
  const width = index === 7 || index === 13 || index === 31 ? "min-w-[190px] max-w-[240px]" : index === 12 || index === 20 ? "min-w-[150px]" : index >= 8 && index <= 29 ? "min-w-[128px]" : "min-w-[132px]";
  return `${width} border-b border-r border-[#edf1f5] px-3 py-2 text-[8.25px] leading-4 text-[#475467] ${numeric ? "whitespace-nowrap text-right font-semibold tabular-nums text-[#243b5a]" : ""}`;
}

function formatMisCell(value: BusinessMisClientCell, index: number) {
  if (value === "" || value === null || value === undefined) return "—";
  if (BUSINESS_MIS_DATE_COLUMNS.has(index) && typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(parsed);
  }
  if (BUSINESS_MIS_AMOUNT_COLUMNS.has(index) && typeof value === "number") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
  }
  if (BUSINESS_MIS_PERCENT_COLUMNS.has(index) && typeof value === "number") {
    return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  return String(value);
}

function cacheKey(period: Period, from: string, to: string, insurer: string) {
  return [period, period === "custom" ? from : "", period === "custom" ? to : "", insurer].join("|");
}

function accountsHref(period: Period, from: string, to: string, insurer: string) {
  const params = new URLSearchParams();
  params.set("period", period);
  if (period === "custom") {
    params.set("from", from);
    params.set("to", to);
  }
  if (insurer) params.set("insurer", insurer);
  return `/accounts?${params.toString()}`;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-0.5 block text-[7px] font-black uppercase tracking-[.07em] text-[#7c899b]">{label}</span>{children}</label>;
}

function KpiCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return <article className="flex min-h-[58px] items-center justify-between gap-3 rounded-xl border border-[#dbe3ee] bg-white px-3 py-2 shadow-sm"><div className="min-w-0"><p className="truncate text-[7.5px] font-black uppercase tracking-[.07em] text-[#7c899b]">{label}</p><p className="mt-1 truncate text-[17px] font-semibold leading-5 tabular-nums text-[#14213c]" title={value}>{value}</p></div><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#edf6f5] text-[#0f766e]"><Icon className="h-3.5 w-3.5" /></span></article>;
}

function currency(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function integer(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
function displayRange(from: string, to: string) {
  const format = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`));
  return from === to ? format(from) : `${format(from)} – ${format(to)}`;
}
