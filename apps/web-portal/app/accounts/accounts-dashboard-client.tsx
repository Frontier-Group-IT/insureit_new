"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, CalendarDays, CalendarRange, Check, ChevronDown, Download, HandCoins, Loader2, ReceiptIndianRupee, TrendingUp, WalletCards } from "lucide-react";
import {
  BUSINESS_MIS_AMOUNT_COLUMNS,
  BUSINESS_MIS_DATE_COLUMNS,
  BUSINESS_MIS_HEADERS,
  BUSINESS_MIS_PERCENT_COLUMNS,
  type AccountsDashboardClientSnapshot,
  type BusinessMisClientCell,
} from "@/lib/accounts-business-mis-schema";
import { loadAccountsSnapshotAction } from "./accounts-snapshot-actions";
import { AccountsPolicyReconciliationDrawer } from "./accounts-policy-reconciliation-drawer";
import type { AccountsPolicyReconciliationLookup } from "./accounts-reconciliation-detail-actions";
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

type ReconciliationState = "reconciled" | "partial" | "pending" | "variance" | "not_applicable";

type ReconciliationOverview = {
  projectedPayin: number;
  postedPayin: number;
  pendingPayin: number;
  projectedPayout: number;
  paidPayout: number;
  pendingPayout: number;
  payinProgress: number;
  payoutProgress: number;
  payinReconciled: number;
  payoutReconciled: number;
  fullyReconciled: number;
  partial: number;
  pending: number;
  variance: number;
  notApplicable: number;
};

const PRESET_PERIODS: Array<{ value: Exclude<Period, "custom">; label: string }> = [
  { value: "last_month", label: "Last month" },
  { value: "mtd", label: "MTD" },
];

export function AccountsDashboardClient({ initialFilters, initialSnapshot }: Props) {
  const [filters, setFilters] = useState(initialFilters);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [from, setFrom] = useState(initialFilters.fromDate);
  const [to, setTo] = useState(initialFilters.toDate);
  const [insurer, setInsurer] = useState(initialFilters.insurerId ?? "");
  const [isPending, setIsPending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(initialFilters.fromDate);
  const [customTo, setCustomTo] = useState(initialFilters.toDate);
  const [customError, setCustomError] = useState("");
  const [reconciliationLookup, setReconciliationLookup] = useState<AccountsPolicyReconciliationLookup | null>(null);
  const customRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, Result>([
    [cacheKey(initialFilters.period, initialFilters.fromDate, initialFilters.toDate, initialFilters.insurerId ?? ""), {
      filters: initialFilters,
      snapshot: initialSnapshot,
    }],
  ]));
  const inflight = useRef(new Map<string, Promise<Result>>());
  const insurersRef = useRef(initialSnapshot.insurers);

  const exportHref = useMemo(() => {
    const params = new URLSearchParams({
      period: filters.period,
      from: filters.fromDate,
      to: filters.toDate,
    });
    if (filters.insurerId) params.set("insurer", filters.insurerId);
    return `/accounts/business-mis-export?${params.toString()}`;
  }, [filters]);

  const reconciliation = useMemo(() => buildReconciliationOverview(snapshot.rows), [snapshot.rows]);

  const normalizeResult = (result: Result): Result => {
    const nextInsurers = result.snapshot.insurers.length ? result.snapshot.insurers : insurersRef.current;
    if (result.snapshot.insurers.length) insurersRef.current = result.snapshot.insurers;
    return { ...result, snapshot: { ...result.snapshot, insurers: nextInsurers } };
  };

  const requestResult = (period: Period, nextFrom: string, nextTo: string, nextInsurer: string): Promise<Result> => {
    const key = cacheKey(period, nextFrom, nextTo, nextInsurer);
    const cached = cache.current.get(key);
    if (cached) return Promise.resolve(cached);

    const pending = inflight.current.get(key);
    if (pending) return pending;

    const request = loadAccountsSnapshotAction({
      period,
      from: period === "custom" ? nextFrom : undefined,
      to: period === "custom" ? nextTo : undefined,
      insurer: nextInsurer || undefined,
    }).then((raw) => {
      const result = normalizeResult(raw as Result);
      cache.current.set(cacheKey(result.filters.period, result.filters.fromDate, result.filters.toDate, result.filters.insurerId ?? ""), result);
      return result;
    }).finally(() => {
      inflight.current.delete(key);
    });

    inflight.current.set(key, request);
    return request;
  };

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
    setIsPending(true);
    setLoadError("");
    try {
      const result = await requestResult(period, nextFrom, nextTo, nextInsurer);
      applyResult(result, href);
    } catch {
      setLoadError("Accounts data could not be refreshed. Your current figures are still shown.");
    } finally {
      setIsPending(false);
    }
  };

  const refreshReconciliationSnapshot = async () => {
    const href = accountsHref(filters.period, filters.fromDate, filters.toDate, filters.insurerId ?? "");
    setIsPending(true);
    setLoadError("");
    try {
      const raw = await loadAccountsSnapshotAction({
        period: filters.period,
        from: filters.period === "custom" ? filters.fromDate : undefined,
        to: filters.period === "custom" ? filters.toDate : undefined,
        insurer: filters.insurerId ?? undefined,
      });
      const result = normalizeResult(raw as Result);
      cache.current.clear();
      cache.current.set(cacheKey(result.filters.period, result.filters.fromDate, result.filters.toDate, result.filters.insurerId ?? ""), result);
      applyResult(result, href);
    } catch {
      setLoadError("Reconciliation was saved, but the dashboard could not refresh automatically. Apply the filters again to reload the latest figures.");
    } finally {
      setIsPending(false);
    }
  };

  const prefetchResult = (period: Period, nextFrom = from, nextTo = to, nextInsurer = insurer) => {
    const key = cacheKey(period, nextFrom, nextTo, nextInsurer);
    if (cache.current.has(key) || inflight.current.has(key)) return;
    void requestResult(period, nextFrom, nextTo, nextInsurer).catch(() => undefined);
  };

  const openCustomRange = () => {
    if (customOpen) {
      setCustomOpen(false);
      return;
    }
    setCustomFrom(filters.fromDate);
    setCustomTo(filters.toDate);
    setCustomError("");
    setCustomOpen(true);
  };

  const applyCustomRange = async () => {
    if (!customFrom || !customTo) {
      setCustomError("Choose both From and To dates.");
      return;
    }
    if (customFrom > customTo) {
      setCustomError("From date cannot be after To date.");
      return;
    }
    setCustomError("");
    await fetchResult("custom", customFrom, customTo, insurer);
    setCustomOpen(false);
  };

  useEffect(() => {
    if (!customOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!customRef.current?.contains(event.target as Node)) setCustomOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCustomOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [customOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const standardPeriod of ["last_month", "mtd"] as const) {
        if (standardPeriod === filters.period) continue;
        const key = cacheKey(standardPeriod, from, to, insurer);
        if (cache.current.has(key) || inflight.current.has(key)) continue;

        const request = loadAccountsSnapshotAction({
          period: standardPeriod,
          insurer: insurer || undefined,
        }).then((raw) => {
          const result = raw as Result;
          const nextInsurers = result.snapshot.insurers.length ? result.snapshot.insurers : insurersRef.current;
          const normalized = { ...result, snapshot: { ...result.snapshot, insurers: nextInsurers } };
          cache.current.set(cacheKey(normalized.filters.period, normalized.filters.fromDate, normalized.filters.toDate, normalized.filters.insurerId ?? ""), normalized);
          return normalized;
        }).finally(() => {
          inflight.current.delete(key);
        });

        inflight.current.set(key, request);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters.period, insurer, from, to]);

  const misLoadFailed = snapshot.warnings.length > 0 && snapshot.rows.length === 0;

  return <div className="mx-auto max-w-[1560px] space-y-2 pb-4">
    <section className="rounded-2xl border border-[#dbe3ee] bg-white px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold leading-5 text-[#17365D]">Accounts Dashboard</h1>
          <p className="text-[8px] font-medium text-[#7c899b]">{displayRange(filters.fromDate, filters.toDate)}</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <ReconciliationTools onImported={refreshReconciliationSnapshot} />
          <span className="h-5 w-px bg-[#dce4ee]" aria-hidden="true" />
          <a href={exportHref} title="Export / download Business MIS" aria-label="Export / download Business MIS" className="grid h-8 w-8 place-items-center rounded-lg border border-[#17365D] bg-white text-[#17365D] shadow-sm transition hover:bg-[#f3f7fb]">
            <Download className="h-3.5 w-3.5" />
          </a>
          <div className="flex rounded-lg border border-[#dce4ee] bg-[#f8fafc] p-0.5">
            {PRESET_PERIODS.map((item) => <button key={item.value} type="button" disabled={isPending} onMouseEnter={() => prefetchResult(item.value)} onFocus={() => prefetchResult(item.value)} onClick={() => { setCustomOpen(false); void fetchResult(item.value, from, to, insurer); }} className={`rounded-md px-2.5 py-1.5 text-[8px] font-bold transition ${filters.period === item.value ? "bg-[#17365D] text-white shadow-sm" : "text-[#667085] hover:bg-white hover:text-[#17365D]"} disabled:cursor-wait disabled:opacity-70`}>
              {item.label}
            </button>)}
            <div ref={customRef} className="relative">
              <button type="button" disabled={isPending} onClick={openCustomRange} aria-expanded={customOpen} aria-haspopup="dialog" className={`flex h-full items-center gap-1 rounded-md px-2.5 py-1.5 text-[8px] font-bold transition ${filters.period === "custom" ? "bg-[#17365D] text-white shadow-sm" : "text-[#667085] hover:bg-white hover:text-[#17365D]"} disabled:cursor-wait disabled:opacity-70`}>
                <CalendarDays className="h-3 w-3" />
                <span>{filters.period === "custom" ? compactRange(filters.fromDate, filters.toDate) : "Custom"}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${customOpen ? "rotate-180" : ""}`} />
              </button>

              {customOpen ? <div role="dialog" aria-label="Choose custom date range" className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(340px,calc(100vw-28px))] rounded-xl border border-[#dbe3ee] bg-white p-3 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-[#17365D]">Custom date range</p>
                    <p className="mt-0.5 text-[7.5px] text-[#7c899b]">Choose the exact accounting period to display.</p>
                  </div>
                  <CalendarRange className="mt-0.5 h-4 w-4 text-[#667085]" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <FilterField label="From"><input type="date" value={customFrom} onChange={(event) => { setCustomFrom(event.target.value); setCustomError(""); }} disabled={isPending} className="h-9 w-full rounded-lg border border-[#dce4ee] bg-white px-2 text-[9px] font-semibold text-[#344054] outline-none focus:border-[#17365D]" /></FilterField>
                  <FilterField label="To"><input type="date" value={customTo} onChange={(event) => { setCustomTo(event.target.value); setCustomError(""); }} disabled={isPending} className="h-9 w-full rounded-lg border border-[#dce4ee] bg-white px-2 text-[9px] font-semibold text-[#344054] outline-none focus:border-[#17365D]" /></FilterField>
                </div>
                {customError ? <p className="mt-2 text-[8px] font-semibold text-[#b42318]">{customError}</p> : null}
                <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-[#edf1f5] pt-2.5">
                  <button type="button" disabled={isPending} onClick={() => setCustomOpen(false)} className="h-8 rounded-lg border border-[#dce4ee] bg-white px-3 text-[8px] font-bold text-[#667085] hover:bg-[#f8fafc] disabled:opacity-60">Cancel</button>
                  <button type="button" disabled={isPending} onClick={() => void applyCustomRange()} className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#17365D] px-3 text-[8px] font-bold text-white shadow-sm hover:bg-[#234b7a] disabled:cursor-wait disabled:opacity-60">{isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Apply</button>
                </div>
              </div> : null}
            </div>
          </div>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#667085]" aria-label="Updating dashboard" /> : null}
        </div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void fetchResult(filters.period, filters.fromDate, filters.toDate, insurer); }} className="mt-2 basis-full grid gap-1.5 border-t border-[#edf1f5] pt-2 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_32px]">
        <FilterField label="Insurer"><select name="insurer" value={insurer} onChange={(event) => setInsurer(event.target.value)} disabled={isPending} className="h-8 w-full rounded-lg border border-[#dce4ee] bg-white px-2 text-[8.5px] font-semibold text-[#344054] disabled:bg-[#f6f8fb] disabled:text-[#98a2b3]"><option value="">All insurers</option>{snapshot.insurers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></FilterField>
        <FilterField label="Branch"><select disabled className="h-8 w-full rounded-lg border border-dashed border-[#d8e1eb] bg-[#f7f9fc] px-2 text-[8.5px] font-semibold text-[#98a2b3]"><option>All branches · Coming soon</option></select></FilterField>
        <button type="submit" disabled={isPending} title="Apply business filters" aria-label="Apply business filters" className="mt-auto grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-white shadow-sm hover:bg-[#234b7a] disabled:cursor-wait disabled:opacity-60">{isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button>
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

    <ReconciliationOverviewPanel overview={reconciliation} policyCount={snapshot.rows.length} />

    <BusinessMisTable rows={snapshot.rows} loadFailed={misLoadFailed} onOpenReconciliation={setReconciliationLookup} />
    <AccountsPolicyReconciliationDrawer lookup={reconciliationLookup} onClose={() => setReconciliationLookup(null)} onPosted={refreshReconciliationSnapshot} />
  </div>;
}

function ReconciliationOverviewPanel({ overview, policyCount }: { overview: ReconciliationOverview; policyCount: number }) {
  return <section className="rounded-2xl border border-[#dbe3ee] bg-white px-3 py-2.5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-[11.5px] font-semibold text-[#17365D]">Reconciliation overview</h2>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <StatusChip label="All" value={policyCount} />
        <StatusChip label="Fully reconciled" value={overview.fullyReconciled} tone="success" />
        <StatusChip label="Partial" value={overview.partial} tone="warning" />
        <StatusChip label="Pending" value={overview.pending} />
        <StatusChip label="Variance" value={overview.variance} tone={overview.variance ? "danger" : "neutral"} />
        <StatusChip label="Not applicable" value={overview.notApplicable} />
      </div>
    </div>

    <div className="mt-2 grid gap-2 xl:grid-cols-2">
      <ReconciliationProgress
        title="Pay-In reconciliation"
        projectedLabel="Projected Pay-In"
        actualLabel="Received Pay-In"
        projected={overview.projectedPayin}
        actual={overview.postedPayin}
        pending={overview.pendingPayin}
        progress={overview.payinProgress}
        reconciled={overview.payinReconciled}
      />
      <ReconciliationProgress
        title="Payout reconciliation"
        projectedLabel="Projected Payout"
        actualLabel="Paid Payout"
        projected={overview.projectedPayout}
        actual={overview.paidPayout}
        pending={overview.pendingPayout}
        progress={overview.payoutProgress}
        reconciled={overview.payoutReconciled}
      />
    </div>
  </section>;
}

function ReconciliationProgress({ title, projectedLabel, actualLabel, projected, actual, pending, progress, reconciled }: { title: string; projectedLabel: string; actualLabel: string; projected: number; actualLabel: string; actual: number; pending: number; progress: number; reconciled: number }) {
  return <article className="rounded-xl border border-[#e1e7ef] bg-[#fbfcfe] px-3 py-2.5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[9px] font-bold text-[#17365D]">{title}</p>
        <p className="mt-0.5 text-[7.5px] text-[#7c899b]">{integer(reconciled)} policy rows reconciled</p>
      </div>
      <span className="text-[13px] font-bold tabular-nums text-[#17365D]">{percentage(progress)}</span>
    </div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e7edf4]"><div className="h-full rounded-full bg-[#0f766e] transition-[width]" style={{ width: `${progress}%` }} /></div>
    <div className="mt-2 grid grid-cols-3 gap-2">
      <MiniAmount label={projectedLabel} value={projected} />
      <MiniAmount label={actualLabel} value={actual} />
      <MiniAmount label="Pending" value={pending} emphasized={pending > 0} />
    </div>
  </article>;
}

function MiniAmount({ label, value, emphasized = false }: { label: string; value: number; emphasized?: boolean }) {
  return <div className="min-w-0"><p className="truncate text-[6.8px] font-black uppercase tracking-[.05em] text-[#98a2b3]">{label}</p><p className={`mt-0.5 truncate text-[11px] font-semibold tabular-nums ${emphasized ? "text-[#9a6700]" : "text-[#344054]"}`} title={currency(value)}>{currency(value)}</p></div>;
}

function StatusChip({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const cls = tone === "success" ? "border-[#bfe3d5] bg-[#f0faf6] text-[#0f766e]" : tone === "warning" ? "border-[#f1d7a7] bg-[#fffaf0] text-[#8a5a13]" : tone === "danger" ? "border-[#f3c7c3] bg-[#fff5f4] text-[#b42318]" : "border-[#dce4ee] bg-[#f8fafc] text-[#667085]";
  return <span className={`rounded-full border px-2 py-1 text-[7.5px] font-bold tabular-nums ${cls}`}>{label} {integer(value)}</span>;
}

function BusinessMisTable({ rows, loadFailed, onOpenReconciliation }: { rows: BusinessMisClientCell[][]; loadFailed: boolean; onOpenReconciliation: (lookup: AccountsPolicyReconciliationLookup) => void }) {
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
              {row.map((cell, columnIndex) => <td key={columnIndex} className={cellClass(columnIndex)}>{columnIndex === 12 && String(cell ?? "").trim() ? <button type="button" title="Open reconciliation history" onClick={() => onOpenReconciliation({ policyNumber: String(row[12] ?? ""), registrationNumber: String(row[6] ?? ""), insuredName: String(row[7] ?? ""), insurerName: String(row[13] ?? "") })} className="group/policy inline-flex items-center gap-1.5 text-left font-semibold text-[#17365D] underline decoration-[#b8c8d9] decoration-dotted underline-offset-2 transition hover:text-[#0f766e] hover:decoration-[#0f766e]"><span>{formatMisCell(cell, columnIndex)}</span><span className="rounded border border-[#dce4ee] bg-white px-1 py-0 text-[6px] font-bold uppercase tracking-[.04em] text-[#7c899b] opacity-0 transition group-hover/policy:opacity-100 group-focus/policy:opacity-100">History</span></button> : formatMisCell(cell, columnIndex)}</td>)}
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

function buildReconciliationOverview(rows: BusinessMisClientCell[][]): ReconciliationOverview {
  let projectedPayin = 0;
  let postedPayin = 0;
  let projectedPayout = 0;
  let paidPayout = 0;
  let payinReconciled = 0;
  let payoutReconciled = 0;
  let fullyReconciled = 0;
  let partial = 0;
  let pending = 0;
  let variance = 0;
  let notApplicable = 0;

  for (const row of rows) {
    const payinProjection = amount(row[19]);
    const payinActual = amount(row[21]);
    const payoutProjection = amount(row[27]);
    const payoutActual = amount(row[29]);
    projectedPayin += payinProjection;
    postedPayin += payinActual;
    projectedPayout += payoutProjection;
    paidPayout += payoutActual;

    const payinState = reconcileState(payinProjection, payinActual);
    const payoutState = reconcileState(payoutProjection, payoutActual);
    if (payinState === "reconciled") payinReconciled += 1;
    if (payoutState === "reconciled") payoutReconciled += 1;

    const states = [payinState, payoutState];
    if (states.includes("variance")) {
      variance += 1;
      continue;
    }

    const applicableStates = states.filter((state): state is Exclude<ReconciliationState, "not_applicable"> => state !== "not_applicable");
    if (!applicableStates.length) {
      notApplicable += 1;
    } else if (applicableStates.every((state) => state === "reconciled")) {
      fullyReconciled += 1;
    } else if (applicableStates.every((state) => state === "pending")) {
      pending += 1;
    } else {
      partial += 1;
    }
  }

  return {
    projectedPayin,
    postedPayin,
    pendingPayin: Math.max(0, projectedPayin - postedPayin),
    projectedPayout,
    paidPayout,
    pendingPayout: Math.max(0, projectedPayout - paidPayout),
    payinProgress: progress(projectedPayin, postedPayin),
    payoutProgress: progress(projectedPayout, paidPayout),
    payinReconciled,
    payoutReconciled,
    fullyReconciled,
    partial,
    pending,
    variance,
    notApplicable,
  };
}

function reconcileState(projected: number, actual: number): ReconciliationState {
  if (projected <= 0.01) return actual > 0.01 ? "variance" : "not_applicable";
  if (actual > projected + 0.01) return "variance";
  if (Math.abs(actual - projected) <= 0.01) return "reconciled";
  if (actual > 0.01) return "partial";
  return "pending";
}

function amount(value: BusinessMisClientCell | undefined) {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function progress(projected: number, actual: number) {
  if (projected <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((actual / projected) * 1000) / 10));
}

function percentage(value: number) { return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value)}%`; }

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
function compactRange(from: string, to: string) {
  const format = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`));
  return from === to ? format(from) : `${format(from)} – ${format(to)}`;
}
