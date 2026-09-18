import { redirect } from "next/navigation";
import { Building2, CalendarRange, HandCoins, ReceiptIndianRupee, TrendingUp, WalletCards } from "lucide-react";
import { AppShell } from "@/components/shell";
import { loadAccountsDashboard, resolveAccountsDashboardFilters, type AccountsDashboardQuery } from "@/lib/accounts-dashboard";
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
import { AccountsControls } from "./accounts-controls";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<AccountsDashboardQuery> };

export default async function AccountsPage({ searchParams }: Props) {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const query = await searchParams;
  const resolvedFilters = resolveAccountsDashboardFilters(query);
  const [data, misResult] = await Promise.all([
    loadAccountsDashboard(profile, query),
    loadBusinessMisRows(profile, resolvedFilters).then((rows) => ({ rows, failed: false })).catch(() => ({ rows: [] as BusinessMisCell[][], failed: true })),
  ]);
  const { filters } = data;
  const misRows = misResult.rows;
  const misLoadFailed = misResult.failed;

  const exportParams = new URLSearchParams({ period: filters.period, from: filters.fromDate, to: filters.toDate });
  if (filters.insurerId) exportParams.set("insurer", filters.insurerId);
  const exportHref = `/accounts/business-mis-export?${exportParams.toString()}`;

  return <AppShell title="Accounts Dashboard"><div className="mx-auto max-w-[1560px] space-y-2 pb-4">
    <section className="rounded-2xl border border-[#dbe3ee] bg-white px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0"><h1 className="truncate text-[15px] font-semibold leading-5 text-[#17365D]">Accounts Dashboard</h1><p className="text-[8px] font-medium text-[#7c899b]">{data.periodLabel}</p></div>
        <AccountsControls period={filters.period} fromDate={filters.fromDate} toDate={filters.toDate} insurerId={filters.insurerId} insurers={data.insurers} exportHref={exportHref} />
      </div>
    </section>

    {data.warnings.length ? <section className="rounded-xl border border-[#f1d7a7] bg-[#fffaf0] px-3 py-1.5 text-[8.5px] font-semibold text-[#8a5a13]">{data.warnings.join(" ")}</section> : null}

    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard icon={CalendarRange} label="Policies" value={integer(data.policyCount)} />
      <KpiCard icon={ReceiptIndianRupee} label="Net premium" value={currency(data.netPremium)} />
      <KpiCard icon={WalletCards} label="Projected net pay-in" value={currency(data.projectedNetPayin)} />
      <KpiCard icon={HandCoins} label="Projected net payout" value={currency(data.projectedNetPayout)} />
      <KpiCard icon={TrendingUp} label="Projected retention" value={currency(data.projectedRetention)} />
    </section>

    <BusinessMisTable rows={misRows} loadFailed={misLoadFailed} />

  </div></AppShell>;
}

function BusinessMisTable({ rows, loadFailed }: { rows: BusinessMisCell[][]; loadFailed: boolean }) {
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

function KpiCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) { return <article className="flex min-h-[58px] items-center justify-between gap-3 rounded-xl border border-[#dbe3ee] bg-white px-3 py-2 shadow-sm"><div className="min-w-0"><p className="truncate text-[7.5px] font-black uppercase tracking-[.07em] text-[#7c899b]">{label}</p><p className="mt-1 truncate text-[17px] font-semibold leading-5 tabular-nums text-[#14213c]" title={value}>{value}</p></div><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#edf6f5] text-[#0f766e]"><Icon className="h-3.5 w-3.5" /></span></article>; }
function currency(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function integer(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
