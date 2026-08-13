import Link from "next/link";
import { Download, Filter } from "lucide-react";
import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { loadManagementPack, type ManagementPackQuery } from "@/lib/reports/management-pack";
import { ManagementPackPrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<ManagementPackQuery> };

export default async function ManagementPackPage({ searchParams }: Props) {
  const profile = await requireCapability("view_reports");
  if (!profile) return null;
  const query = await searchParams;
  const pack = await loadManagementPack(profile, query);
  const monthLabel = formatMonth(pack.filters.month);
  const exportHref = `/reports/export/management-pack?month=${encodeURIComponent(pack.filters.month)}`;

  return (
    <AppShell title="Reports">
      <div className="mx-auto max-w-[1560px] space-y-4 pb-8 print:max-w-none print:space-y-3 print:pb-0">
        <header className="portal-card overflow-hidden print:border-0 print:shadow-none">
          <div className="flex flex-col gap-3 border-b border-[#e8ecf2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[#13203b] sm:text-[30px]">Month-End Management Pack</h1>
              <ReportTabs canViewGovernance={pack.canViewGovernance} />
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <a href={exportHref} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#cad4e4] bg-white px-3 text-[10px] font-bold text-[#263b69]"><Download className="h-3.5 w-3.5" />Export CSV</a>
              <ManagementPackPrintButton />
            </div>
          </div>
          <div className="px-5 py-4 sm:px-6 print:px-0 print:py-2">
            <form action="/reports/management-pack" method="get" className="flex flex-wrap items-end gap-2 print:hidden">
              <label className="block min-w-[190px]"><span className="mb-1 block text-[8.5px] font-black uppercase tracking-[.08em] text-[#7b8799]">Month</span><input name="month" type="month" max={pack.filters.currentMonth} defaultValue={pack.filters.month} className={inputClass} /></label>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#172a5c] px-4 text-[10.5px] font-bold text-white"><Filter className="h-3.5 w-3.5" />Apply</button>
              <Link href="/reports/management-pack" className="inline-flex h-10 items-center justify-center rounded-lg border border-[#dfe5ee] bg-white px-4 text-[10.5px] font-bold text-[#526174]">Current month</Link>
            </form>
            <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-semibold text-[#66748a] print:mt-0">
              <span>{monthLabel}</span>
              <span>{formatDate(pack.filters.fromDate)} — {formatDate(pack.filters.toDate)}</span>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6 print:grid-cols-6">
          <Metric label="Policies" value={integer(pack.business.summary.policy_count)} />
          <Metric label="Gross premium" value={currency(pack.business.summary.gross_premium)} />
          <Metric label="Net premium" value={currency(pack.business.summary.net_premium)} />
          <Metric label="Projected PayIn" value={currency(pack.finance.summary.projected_payin)} />
          <Metric label="Retention" value={currency(pack.finance.summary.retention_amount)} />
          <Metric label="Claims" value={integer(pack.claims.summary.claim_count)} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2 print:grid-cols-2">
          <article className="portal-card overflow-hidden print:break-inside-avoid"><Header title="Business performance" /><div className="grid gap-3 p-5 sm:grid-cols-3"><Mini label="Active policies" value={integer(pack.business.summary.active_policy_count)} /><Mini label="Average premium" value={currency(pack.business.summary.average_premium)} /><Mini label="Intermediaries" value={integer(pack.business.summary.intermediary_count)} /></div><TopBusiness insurers={pack.business.insurers.slice(0, 5)} rms={pack.business.rms.slice(0, 5)} /></article>
          <article className="portal-card overflow-hidden print:break-inside-avoid"><Header title="Distribution" /><div className="grid gap-3 p-5 sm:grid-cols-3"><Mini label="Active intermediaries" value={integer(pack.distribution.summary.active_intermediary_count)} /><Mini label="Producing" value={integer(pack.distribution.summary.producing_intermediary_count)} /><Mini label="Open onboarding" value={integer(pack.distribution.summary.onboarding_open_count)} /></div><DistributionTable rows={pack.distribution.rms.slice(0, 6)} /></article>
        </section>

        <section className="grid gap-4 xl:grid-cols-2 print:grid-cols-2">
          <article className="portal-card overflow-hidden print:break-inside-avoid"><Header title="Finance" /><div className="grid gap-3 p-5 sm:grid-cols-3"><Mini label="PayIn after TDS" value={currency(pack.finance.summary.payin_after_tds)} /><Mini label="Billed" value={currency(pack.finance.summary.billed_amount)} /><Mini label="Partner payout" value={currency(pack.finance.summary.gross_payout)} /><Mini label="Billing incomplete" value={integer(pack.finance.summary.billing_incomplete_count)} /><Mini label="Pending payout" value={integer(pack.finance.summary.pending_payout_count)} /><Mini label="Negative retention" value={integer(pack.finance.summary.negative_retention_count ?? 0)} /></div><FinanceTable rows={pack.finance.insurers.slice(0, 6)} /></article>
          <article className="portal-card overflow-hidden print:break-inside-avoid"><Header title="Claims" /><div className="grid gap-3 p-5 sm:grid-cols-3"><Mini label="Open" value={integer(pack.claims.summary.open_claim_count)} /><Mini label="Settled" value={integer(pack.claims.summary.settled_claim_count)} /><Mini label="Average open age" value={`${integer(pack.claims.summary.average_open_age_days)} d`} /><Mini label="Estimated loss" value={currency(pack.claims.summary.estimated_loss)} /><Mini label="Settlement" value={currency(pack.claims.summary.settlement_amount)} /><Mini label="Document exceptions" value={integer(pack.claims.summary.claims_with_pending_documents + pack.claims.summary.claims_with_rejected_documents)} /></div><ClaimsAging rows={pack.claims.aging} /></article>
        </section>

        <section className="grid gap-4 xl:grid-cols-2 print:grid-cols-2">
          <article className="portal-card overflow-hidden print:break-inside-avoid"><Header title="Current renewal exposure" /><div className="grid gap-3 p-5 sm:grid-cols-3"><Mini label="Due ≤ 30d" value={integer(pack.renewals.summary.due_30_count)} /><Mini label="Due ≤ 90d" value={integer(pack.renewals.summary.due_90_count)} /><Mini label="Premium at risk" value={currency(pack.renewals.summary.premium_at_risk)} /></div><RenewalTable rows={pack.renewals.buckets} /></article>
          <article className="portal-card overflow-hidden print:break-inside-avoid"><Header title="Current operations exposure" /><div className="grid gap-3 p-5 sm:grid-cols-3"><Mini label="Vehicles" value={integer(pack.operations.summary.vehicle_count)} /><Mini label="AuthBridge unverified" value={integer(pack.operations.summary.authbridge_unverified_count)} /><Mini label="Missing fields" value={integer(pack.operations.summary.missing_compliance_fields)} /><Mini label="Expired documents" value={integer(pack.operations.summary.expired_document_count)} /><Mini label="Due ≤ 90d" value={integer(pack.operations.summary.due_document_count)} /><Mini label="Customer doc exceptions" value={integer(pack.operations.customer_documents.customers_with_exceptions)} /></div><OperationsTable rows={pack.operations.compliance} /></article>
        </section>

        {pack.governance ? <section className="portal-card overflow-hidden print:break-inside-avoid"><Header title="Governance" /><div className="grid gap-3 p-5 sm:grid-cols-3 xl:grid-cols-6"><Mini label="Active profiles" value={integer(pack.governance.summary.active_profile_count)} /><Mini label="Inactive profiles" value={integer(pack.governance.summary.inactive_profile_count)} /><Mini label="Employee overrides" value={integer(pack.governance.summary.active_employee_override_count)} /><Mini label="Role overrides" value={integer(pack.governance.summary.role_override_count)} /><Mini label="Permission changes" value={integer(pack.governance.summary.permission_change_count)} /><Mini label="Audit events" value={integer(pack.governance.summary.audit_event_count)} /></div></section> : null}
      </div>
    </AppShell>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-[#dfe5ee] bg-white px-3 text-[10.5px] font-semibold text-[#26364f] outline-none focus:border-[#7788bd] focus:ring-2 focus:ring-[#dfe5ff]";
function ReportTabs({ canViewGovernance }: { canViewGovernance: boolean }) { return <nav className="mt-4 flex flex-wrap gap-2 print:hidden"><Tab href="/reports" label="Business" /><Tab href="/reports/distribution" label="Distribution" /><Tab href="/reports/renewals" label="Renewals" /><Tab href="/reports/claims" label="Claims" /><Tab href="/reports/finance" label="Finance" /><Tab href="/reports/operations" label="Operations" />{canViewGovernance ? <Tab href="/reports/governance" label="Governance" /> : null}<Tab href="/reports/management-pack" label="Management Pack" active /></nav>; }
function Tab({ href, label, active = false }: { href: string; label: string; active?: boolean }) { return <Link href={href} className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${active ? "border-[#223a78] bg-[#223a78] text-white" : "border-[#dfe5ee] bg-white text-[#506077]"}`}>{label}</Link>; }
function Metric({ label, value }: { label: string; value: string }) { return <article className="portal-card px-4 py-4 print:border print:shadow-none"><p className="text-[8.5px] font-black uppercase tracking-[.08em] text-[#7c899b]">{label}</p><p className="mt-2 text-[20px] font-semibold text-[#14213c]">{value}</p></article>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#e2e7ee] bg-white px-4 py-3"><p className="text-[8px] font-black uppercase tracking-[.08em] text-[#8994a5]">{label}</p><p className="mt-1.5 text-[17px] font-semibold text-[#1e2d49]">{value}</p></div>; }
function Header({ title }: { title: string }) { return <div className="border-b border-[#e9edf3] px-5 py-4"><h2 className="text-[14px] font-bold text-[#1b2943]">{title}</h2></div>; }
function TopBusiness({ insurers, rms }: { insurers: Array<{ id: string; name: string; policy_count: number; gross_premium: number }>; rms: Array<{ name: string; policy_count: number; gross_premium: number }> }) { return <div className="grid border-t border-[#edf0f4] lg:grid-cols-2"><SimpleRows title="Insurance company" rows={insurers.map(x => [x.name, `${integer(x.policy_count)} · ${currency(x.gross_premium)}`])} /><SimpleRows title="Relationship manager" rows={rms.map(x => [x.name, `${integer(x.policy_count)} · ${currency(x.gross_premium)}`])} /></div>; }
function DistributionTable({ rows }: { rows: Array<{ name: string; intermediary_count: number; policy_count: number; customer_count: number; gross_premium: number }> }) { return <SimpleRows title="RM performance" rows={rows.map(x => [x.name, `${integer(x.intermediary_count)} partners · ${integer(x.policy_count)} policies · ${currency(x.gross_premium)}`])} />; }
function FinanceTable({ rows }: { rows: Array<{ insurer_name: string; projected_payin: number; billed_amount: number; retention_amount: number }> }) { return <SimpleRows title="Insurer finance" rows={rows.map(x => [x.insurer_name, `${currency(x.projected_payin)} PayIn · ${currency(x.billed_amount)} billed · ${currency(x.retention_amount)} retention`])} />; }
function ClaimsAging({ rows }: { rows: Array<{ label: string; claim_count: number }> }) { return <SimpleRows title="Open claim aging" rows={rows.map(x => [x.label, integer(x.claim_count)])} />; }
function RenewalTable({ rows }: { rows: Array<{ label: string; policy_count: number; gross_premium: number }> }) { return <SimpleRows title="Renewal buckets" rows={rows.map(x => [x.label, `${integer(x.policy_count)} · ${currency(x.gross_premium)}`])} />; }
function OperationsTable({ rows }: { rows: Array<{ label: string; missing_count: number; expired_count: number; due_count: number }> }) { return <SimpleRows title="Compliance documents" rows={rows.map(x => [x.label, `${integer(x.missing_count)} missing · ${integer(x.expired_count)} expired · ${integer(x.due_count)} due`])} />; }
function SimpleRows({ title, rows }: { title: string; rows: Array<[string, string]> }) { return <div className="min-w-0 border-[#edf0f4] p-5 lg:border-r last:border-r-0"><p className="mb-3 text-[8.5px] font-black uppercase tracking-[.08em] text-[#8994a5]">{title}</p>{rows.length ? <div className="space-y-2.5">{rows.map(([label, value]) => <div key={`${title}-${label}`} className="flex items-start justify-between gap-4 border-b border-[#f0f2f5] pb-2.5 last:border-0 last:pb-0"><span className="text-[10px] font-semibold text-[#35445d]">{label}</span><span className="text-right text-[9.5px] font-bold text-[#5a677a]">{value}</span></div>)}</div> : <p className="text-[10px] font-semibold text-[#8b96a6]">No data</p>}</div>; }
function integer(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
function currency(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`)); }
function formatMonth(value: string) { return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value}-01T00:00:00+05:30`)); }
