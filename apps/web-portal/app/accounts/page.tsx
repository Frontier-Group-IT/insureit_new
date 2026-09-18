import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarRange, Download, HandCoins, Landmark, ReceiptIndianRupee, TrendingUp, WalletCards } from "lucide-react";
import { AppShell } from "@/components/shell";
import { loadAccountsDashboard, type AccountsDashboardQuery } from "@/lib/accounts-dashboard";
import {
  BUSINESS_MIS_AMOUNT_COLUMNS,
  BUSINESS_MIS_DATE_COLUMNS,
  BUSINESS_MIS_HEADERS,
  BUSINESS_MIS_PERCENT_COLUMNS,
  loadBusinessMisRows,
  type BusinessMisCell,
} from "@/lib/accounts-business-mis";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { ReconciliationTools } from "./reconciliation-tools";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<AccountsDashboardQuery> };
const PERIODS = [{ value: "last_month", label: "Last month" }, { value: "mtd", label: "MTD" }, { value: "custom", label: "Custom" }] as const;

export default async function AccountsPage({ searchParams }: Props) {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const query = await searchParams;
  const data = await loadAccountsDashboard(profile, query);
  const { filters } = data;
  let misRows: BusinessMisCell[][] = [];
  let misLoadFailed = false;
  try {
    misRows = await loadBusinessMisRows(profile, filters);
  } catch {
    misLoadFailed = true;
  }

  const exportParams = new URLSearchParams({ period: filters.period, from: filters.fromDate, to: filters.toDate });
  if (filters.insurerId) exportParams.set("insurer", filters.insurerId);
  const exportHref = `/accounts/business-mis-export?${exportParams.toString()}`;

  return <AppShell title="Accounts Dashboard"><div className="mx-auto max-w-[1560px] space-y-3 pb-6">
    <section className="rounded-2xl border border-[#dbe3ee] bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e8f5f3] text-[#0f766e]"><Landmark className="h-4 w-4" /></span><div><h1 className="text-[17px] font-semibold text-[#17365D]">Accounts Dashboard</h1><p className="mt-0.5 text-[9px] font-medium text-[#7c899b]">{data.periodLabel}</p></div></div><div className="flex flex-wrap items-center gap-2"><a href={exportHref} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#17365D] bg-white px-3.5 text-[9px] font-bold text-[#17365D] shadow-sm transition hover:bg-[#f3f7fb]"><Download className="h-3.5 w-3.5" />Export</a><div className="flex rounded-xl border border-[#dce4ee] bg-[#f8fafc] p-1">{PERIODS.map(item => <Link key={item.value} prefetch={false} href={periodHref(item.value, filters.insurerId)} className={`rounded-lg px-3 py-1.5 text-[9px] font-bold ${filters.period === item.value ? "bg-[#17365D] text-white shadow-sm" : "text-[#667085] hover:bg-white hover:text-[#17365D]"}`}>{item.label}</Link>)}</div></div></div>
      <form action="/accounts" className="mt-3 grid gap-2 border-t border-[#edf1f5] pt-3 md:grid-cols-2 xl:grid-cols-[150px_150px_minmax(220px,1fr)_minmax(220px,1fr)_auto]"><input type="hidden" name="period" value={filters.period} /><FilterField label="From"><input name="from" type="date" defaultValue={filters.fromDate} disabled={filters.period !== "custom"} className="h-9 w-full rounded-lg border border-[#dce4ee] bg-white px-2.5 text-[9px] font-semibold text-[#344054] disabled:bg-[#f6f8fb] disabled:text-[#98a2b3]" /></FilterField><FilterField label="To"><input name="to" type="date" defaultValue={filters.toDate} disabled={filters.period !== "custom"} className="h-9 w-full rounded-lg border border-[#dce4ee] bg-white px-2.5 text-[9px] font-semibold text-[#344054] disabled:bg-[#f6f8fb] disabled:text-[#98a2b3]" /></FilterField><FilterField label="Insurer"><select name="insurer" defaultValue={filters.insurerId ?? ""} className="h-9 w-full rounded-lg border border-[#dce4ee] bg-white px-2.5 text-[9px] font-semibold text-[#344054]"><option value="">All insurers</option>{data.insurers.map(insurer => <option key={insurer.id} value={insurer.id}>{insurer.name}</option>)}</select></FilterField><FilterField label="Branch"><select disabled className="h-9 w-full rounded-lg border border-dashed border-[#d8e1eb] bg-[#f7f9fc] px-2.5 text-[9px] font-semibold text-[#98a2b3]"><option>All branches · Coming soon</option></select></FilterField><button className="mt-auto h-9 rounded-lg bg-[#17365D] px-4 text-[9px] font-bold text-white shadow-sm hover:bg-[#234b7a]">Apply</button></form>
    </section>

    {data.warnings.length ? <section className="rounded-xl border border-[#f1d7a7] bg-[#fffaf0] px-3 py-2 text-[9px] font-semibold text-[#8a5a13]">{data.warnings.join(" ")}</section> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><KpiCard icon={CalendarRange} label="Policies" value={integer(data.policyCount)} note="Policies in selected period" /><KpiCard icon={ReceiptIndianRupee} label="Net premium" value={currency(data.netPremium)} note="Premium excluding policy GST" /><KpiCard icon={WalletCards} label="Projected net pay-in" value={currency(data.projectedNetPayin)} note="Projected insurer pay-in after TDS" /><KpiCard icon={HandCoins} label="Projected net payout" value={currency(data.projectedNetPayout)} note={`${integer(data.payoutIntermediaryCount)} intermediaries included`} /><KpiCard icon={TrendingUp} label="Projected retention" value={currency(data.projectedRetention)} note="" /></section>

    <BusinessMisTable rows={misRows} loadFailed={misLoadFailed} />

    <ReconciliationTools period={filters.period} fromDate={filters.fromDate} toDate={filters.toDate} insurerId={filters.insurerId} />
  </div></AppShell>;
}

function BusinessMisTable({ rows, loadFailed }: { rows: BusinessMisCell[][]; loadFailed: boolean }) {
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-[#dbe3ee] bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3 border-b border-[#e8edf4] px-4 py-3">
      <div><h2 className="text-[13px] font-semibold text-[#17365D]">Business MIS</h2><p className="mt-0.5 text-[8px] font-medium text-[#8a96a7]">Detailed accounts register</p></div>
      <span className="shrink-0 rounded-full border border-[#dce4ee] bg-[#f8fafc] px-2.5 py-1 text-[8px] font-bold tabular-nums text-[#667085]">{integer(rows.length)} rows</span>
    </div>
    {loadFailed ? <div className="px-4 py-10 text-center text-[9px] font-semibold text-[#b42318]">Business MIS data could not be refreshed.</div> :
      <div className="max-h-[560px] overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-30">
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
  const sticky = index === 0 ? "sticky left-0 z-40 min-w-[120px]" : index === 1 ? "sticky left-[120px] z-40 min-w-[138px] shadow-[8px_0_12px_-12px_rgba(16,24,40,.45)]" : "";
  return `${groupTone} ${numeric} ${sticky} whitespace-nowrap border-b border-r border-[#dfe6ef] px-3 py-2.5 text-[7.5px] font-black uppercase tracking-[.045em] text-[#526174]`;
}

function cellClass(index: number) {
  const numeric = BUSINESS_MIS_AMOUNT_COLUMNS.has(index) || BUSINESS_MIS_PERCENT_COLUMNS.has(index);
  const sticky = index === 0 ? "sticky left-0 z-10 min-w-[120px] bg-white group-hover:bg-[#f8fbff]" : index === 1 ? "sticky left-[120px] z-10 min-w-[138px] bg-white shadow-[8px_0_12px_-12px_rgba(16,24,40,.35)] group-hover:bg-[#f8fbff]" : "";
  const width = index === 7 || index === 13 || index === 31 ? "min-w-[190px] max-w-[240px]" : index === 12 || index === 20 ? "min-w-[150px]" : index >= 8 && index <= 29 ? "min-w-[128px]" : "min-w-[132px]";
  return `${sticky} ${width} border-b border-r border-[#edf1f5] px-3 py-2.5 text-[8.5px] leading-4 text-[#475467] ${numeric ? "whitespace-nowrap text-right font-semibold tabular-nums text-[#243b5a]" : ""}`;
}

function formatMisCell(value: BusinessMisCell, index: number) {
  if (value === "" || value === null || value === undefined) return "—";
  if (BUSINESS_MIS_DATE_COLUMNS.has(index) && value instanceof Date) {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(value);
  }
  if (BUSINESS_MIS_AMOUNT_COLUMNS.has(index) && typeof value === "number") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
  }
  if (BUSINESS_MIS_PERCENT_COLUMNS.has(index) && typeof value === "number") {
    return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  return String(value);
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-[8px] font-black uppercase tracking-[.08em] text-[#7c899b]">{label}</span>{children}</label>; }
function KpiCard({ icon: Icon, label, value, note }: { icon: typeof Building2; label: string; value: string; note: string }) { return <article className="rounded-2xl border border-[#dbe3ee] bg-white px-4 py-3.5 shadow-sm"><div className="flex items-center justify-between gap-3"><p className="text-[8px] font-black uppercase tracking-[.08em] text-[#7c899b]">{label}</p><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf6f5] text-[#0f766e]"><Icon className="h-3.5 w-3.5" /></span></div><p className="mt-2.5 truncate text-[20px] font-semibold tabular-nums text-[#14213c]" title={value}>{value}</p>{note ? <p className="mt-1 min-h-[14px] text-[8.5px] font-medium text-[#8490a1]">{note}</p> : null}</article>; }
function periodHref(period: (typeof PERIODS)[number]["value"], insurerId: string | null) { const params = new URLSearchParams(); params.set("period", period); if (insurerId) params.set("insurer", insurerId); return `/accounts?${params.toString()}`; }
function currency(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function integer(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
