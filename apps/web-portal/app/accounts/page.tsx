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

    <section className="rounded-2xl border border-[#dbe3ee] bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[8px] font-black uppercase tracking-[.1em] text-[#0f766e]">New Accounts workflow</p><h2 className="mt-1 text-[14px] font-semibold text-[#17365D]">Workbook → Validation → Confirm Import → MIS</h2><p className="mt-1 text-[9px] text-[#7c899b]">This workflow is self-contained. Legacy reconciliation, billing and receivable pages remain available only under Other Recon.</p></div><span className="rounded-full border border-[#dce4ee] bg-[#f8fafc] px-2.5 py-1 text-[8px] font-bold text-[#667085]">Excel-first architecture</span></div><div className="mt-3 grid gap-2 lg:grid-cols-4"><WorkflowStep number="01" title="Download workbook" value="Pay-In + Pay-Out" note="System IDs and projected commercial values are filled by INSUREIT." /><WorkflowStep number="02" title="Upload transactions" value="Accounts entries only" note="Bill, TDS, receipts and payout payments are entered in Excel." /><WorkflowStep number="03" title="Validation preview" value="Errors blocked" note="System values, access scope, duplicates and transaction rules are checked." /><WorkflowStep number="04" title="Confirm Import" value="Coming next" note="Will post through existing Accounts ledgers and payment functions after the required allocation extension is verified." muted /></div></section>

    <ReconciliationTools period={filters.period} fromDate={filters.fromDate} toDate={filters.toDate} insurerId={filters.insurerId} />
  </div></AppShell>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1 block text-[8px] font-black uppercase tracking-[.08em] text-[#7c899b]">{label}</span>{children}</label>; }
function KpiCard({ icon: Icon, label, value, note }: { icon: typeof Building2; label: string; value: string; note: string }) { return <article className="rounded-2xl border border-[#dbe3ee] bg-white px-4 py-3.5 shadow-sm"><div className="flex items-center justify-between gap-3"><p className="text-[8px] font-black uppercase tracking-[.08em] text-[#7c899b]">{label}</p><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf6f5] text-[#0f766e]"><Icon className="h-3.5 w-3.5" /></span></div><p className="mt-2.5 truncate text-[20px] font-semibold tabular-nums text-[#14213c]" title={value}>{value}</p><p className="mt-1 min-h-[14px] text-[8.5px] font-medium text-[#8490a1]">{note}</p></article>; }
function WorkflowStep({ number, title, value, note, muted = false }: { number: string; title: string; value: string; note: string; muted?: boolean }) { return <article className={`rounded-xl border border-[#e2e8f0] p-3 ${muted ? "bg-[#f8fafc] opacity-70" : "bg-[#fbfcfe]"}`}><span className="rounded-md bg-[#e8f5f3] px-2 py-1 text-[8px] font-black text-[#0f766e]">{number}</span><p className="mt-2 text-[10px] font-bold text-[#17365D]">{title}</p><p className="mt-1 text-[12px] font-semibold text-[#14213c]">{value}</p><p className="mt-1 min-h-[28px] text-[8.5px] leading-4 text-[#7c899b]">{note}</p></article>; }
function periodHref(period: (typeof PERIODS)[number]["value"], insurerId: string | null) { const params = new URLSearchParams(); params.set("period", period); if (insurerId) params.set("insurer", insurerId); return `/accounts?${params.toString()}`; }
function currency(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function integer(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
