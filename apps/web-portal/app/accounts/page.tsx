import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CalendarRange, Download, HandCoins, Landmark, ReceiptIndianRupee, TrendingUp, WalletCards } from "lucide-react";
import { AppShell } from "@/components/shell";
import { loadAccountsDashboard, type AccountsDashboardQuery } from "@/lib/accounts-dashboard";
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
  const exportParams = new URLSearchParams({ period: filters.period, from: filters.fromDate, to: filters.toDate });
  if (filters.insurerId) exportParams.set("insurer", filters.insurerId);
  const exportHref = `/accounts/business-mis-export?${exportParams.toString()}`;

  return <AppShell title="Accounts Dashboard"><div className="mx-auto max-w-[1560px] space-y-3 pb-6">
    <section className="rounded-2xl border border-[#dbe3ee] bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e8f5f3] text-[#0f766e]"><Landmark className="h-4 w-4" /></span><div><h1 className="text-[17px] font-semibold text-[#17365D]">Accounts Dashboard</h1><p className="mt-0.5 text-[9px] font-medium text-[#7c899b]">{data.periodLabel}</p></div></div><div className="flex flex-wrap items-center gap-2"><a href={exportHref} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#17365D] bg-white px-3.5 text-[9px] font-bold text-[#17365D] shadow-sm transition hover:bg-[#f3f7fb]"><Download className="h-3.5 w-3.5" />Export</a><div className="flex rounded-xl border border-[#dce4ee] bg-[#f8fafc] p-1">{PERIODS.map(item => <Link key={item.value} prefetch={false} href={periodHref(item.value, filters.insurerId)} className={`rounded-lg px-3 py-1.5 text-[9px] font-bold ${filters.period === item.value ? "bg-[#17365D] text-white shadow-sm" : "text-[#667085] hover:bg-white hover:text-[#17365D]"}`}>{item.label}</Link>)}</div></div></div>
      <form action="/accounts" className="mt-3 grid gap-2 border-t border-[#edf1f5] pt-3 md:grid-cols-2 xl:grid-cols-[150px_150px_minmax(220px,1fr)_minmax(220px,1fr)_auto]"><input type="hidden" name="period" value={filters.period} /><FilterField label="From"><input name="from" type="date" defaultValue={filters.fromDate} disabled={filters.period !== "custom"} className="h-9 w-full rounded-lg border border-[#dce4ee] bg-white px-2.5 text-[9px] font-semibold text-[#344054] disabled:bg-[#f6f8fb] disabled:text-[#98a2b3]" /></FilterField><FilterField label="To"><input name="to" type="date" defaultValue={filters.toDate} disabled={filters.period !== "custom"} className="h-9 w-full rounded-lg border border-[#dce4ee] bg-white px-2.5 text-[9px] font-semibold text-[#344054] disabled:bg-[#f6f8fb] disabled:text-[#98a2b3]" /></FilterField><FilterField label="Insurer"><select name="insurer" defaultValue={filters.insurerId ?? ""} className="h-9 w-full rounded-lg border border-[#dce4ee] bg-white px-2.5 text-[9px] font-semibold text-[#344054]"><option value="">All insurers</option>{data.insurers.map(insurer => <option key={insurer.id} value={insurer.id}>{insurer.name}</option>)}</select></FilterField><FilterField label="Branch"><select disabled className="h-9 w-full rounded-lg border border-dashed border-[#d8e1eb] bg-[#f7f9fc] px-2.5 text-[9px] font-semibold text-[#98a2b3]"><option>All branches · Coming soon</option></select></FilterField><button className="mt-auto h-9 rounded-lg bg-[#17365D] px-4 text-[9px] font-bold text-white shadow-sm hover:bg-[#234b7a]">Apply</button></form>
    </section>

    {data.warnings.length ? <section className="rounded-xl border border-[#f1d7a7] bg-[#fffaf0] px-3 py-2 text-[9px] font-semibold text-[#8a5a13]">{data.warnings.join(" ")}</section> : null}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><KpiCard icon={CalendarRange} label="Policies" value={integer(data.policyCount)} note="Policies in selected period" /><KpiCard icon={ReceiptIndianRupee} label="Net premium" value={currency(data.netPremium)} note="Premium excluding policy GST" /><KpiCard icon={WalletCards} label="Projected net pay-in" value={currency(data.projectedNetPayin)} note="Projected insurer pay-in after TDS" /><KpiCard icon={HandCoins} label="Projected net payout" value={currency(data.projectedNetPayout)} note={`${integer(data.payoutIntermediaryCount)} intermediaries included`} /><KpiCard icon={TrendingUp} label="Projected retention" value={currency(data.projectedRetention)} note="Projected retained commercial value" /></section>

    <section className="grid gap-3 xl:grid-cols-[minmax(330px,0.78fr)_minmax(720px,1.35fr)]">
      <SummaryCard title="Insurer-wise Summary" count={data.insurerSummary.length}>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-[#f7f9fc]">
              <tr>
                <TableHead>Insurance Company</TableHead>
                <TableHead numeric>Net Premium</TableHead>
                <TableHead numeric>Projected Payin</TableHead>
                <TableHead numeric>Received Payin</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.insurerSummary.length ? data.insurerSummary.map((row) => <tr key={row.insurerId} className="group">
                <TableCell><span className="font-semibold text-[#17365D]">{row.insuranceCompany}</span></TableCell>
                <TableCell numeric>{currency(row.netPremium)}</TableCell>
                <TableCell numeric>{currency(row.projectedPayin)}</TableCell>
                <TableCell numeric emphasis>{currency(row.receivedPayin)}</TableCell>
              </tr>) : <EmptyRow colSpan={4} label="No insurer summary is available for the selected filters." />}
            </tbody>
          </table>
        </div>
      </SummaryCard>

      <SummaryCard title="Intermediary Payout Summary" count={data.intermediaryPayoutSummary.length}>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-[#f7f9fc]">
              <tr>
                <TableHead>Lead Source</TableHead>
                <TableHead>RM Name</TableHead>
                <TableHead>Intermediary Type &amp; Code</TableHead>
                <TableHead numeric>Net Premium</TableHead>
                <TableHead numeric>Calculated Payout</TableHead>
                <TableHead numeric>Released Payout</TableHead>
                <TableHead numeric>Pending Payout</TableHead>
              </tr>
            </thead>
            <tbody>
              {data.intermediaryPayoutSummary.length ? data.intermediaryPayoutSummary.map((row) => <tr key={row.key} className="group">
                <TableCell>{row.leadSource}</TableCell>
                <TableCell>{row.rmName}</TableCell>
                <TableCell><div className="min-w-[150px]"><span className="block font-semibold text-[#17365D]">{row.intermediaryType}</span><span className="mt-0.5 block text-[8px] font-medium text-[#8a96a7]">{row.intermediaryCode}</span></div></TableCell>
                <TableCell numeric>{currency(row.netPremium)}</TableCell>
                <TableCell numeric>{currency(row.calculatedPayout)}</TableCell>
                <TableCell numeric emphasis>{currency(row.releasedPayout)}</TableCell>
                <TableCell numeric pending={row.pendingPayout > 0}>{currency(row.pendingPayout)}</TableCell>
              </tr>) : <EmptyRow colSpan={7} label="No intermediary payout summary is available for the selected filters." />}
            </tbody>
          </table>
        </div>
      </SummaryCard>
    </section>

    <ReconciliationTools period={filters.period} fromDate={filters.fromDate} toDate={filters.toDate} insurerId={filters.insurerId} />
  </div></AppShell>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-[8px] font-black uppercase tracking-[.08em] text-[#7c899b]">{label}</span>{children}</label>; }
function KpiCard({ icon: Icon, label, value, note }: { icon: typeof Building2; label: string; value: string; note: string }) { return <article className="rounded-2xl border border-[#dbe3ee] bg-white px-4 py-3.5 shadow-sm"><div className="flex items-center justify-between gap-3"><p className="text-[8px] font-black uppercase tracking-[.08em] text-[#7c899b]">{label}</p><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf6f5] text-[#0f766e]"><Icon className="h-3.5 w-3.5" /></span></div><p className="mt-2.5 truncate text-[20px] font-semibold tabular-nums text-[#14213c]" title={value}>{value}</p><p className="mt-1 min-h-[14px] text-[8.5px] font-medium text-[#8490a1]">{note}</p></article>; }
function SummaryCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) { return <section className="min-w-0 overflow-hidden rounded-2xl border border-[#dbe3ee] bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-[#edf1f5] px-4 py-3"><div><h2 className="text-[12px] font-semibold text-[#17365D]">{title}</h2><p className="mt-0.5 text-[8px] font-medium text-[#8a96a7]">Current dashboard filters applied</p></div><span className="shrink-0 rounded-full border border-[#dce4ee] bg-[#f8fafc] px-2.5 py-1 text-[8px] font-bold tabular-nums text-[#667085]">{integer(count)} rows</span></div>{children}</section>; }
function TableHead({ children, numeric = false }: { children: React.ReactNode; numeric?: boolean }) { return <th className={`border-b border-[#dfe6ef] px-3 py-2.5 text-[7.5px] font-black uppercase tracking-[.055em] text-[#667085] ${numeric ? "text-right" : "text-left"}`}>{children}</th>; }
function TableCell({ children, numeric = false, emphasis = false, pending = false }: { children: React.ReactNode; numeric?: boolean; emphasis?: boolean; pending?: boolean }) { return <td className={`border-b border-[#edf1f5] px-3 py-2.5 text-[9px] leading-4 group-last:border-b-0 ${numeric ? "whitespace-nowrap text-right font-semibold tabular-nums" : "text-[#475467]"} ${emphasis ? "text-[#0f766e]" : numeric ? "text-[#243b5a]" : ""} ${pending ? "text-[#9a5b12]" : ""}`}>{children}</td>; }
function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) { return <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-[9px] font-medium text-[#98a2b3]">{label}</td></tr>; }
function periodHref(period: (typeof PERIODS)[number]["value"], insurerId: string | null) { const params = new URLSearchParams(); params.set("period", period); if (insurerId) params.set("insurer", insurerId); return `/accounts?${params.toString()}`; }
function currency(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function integer(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
