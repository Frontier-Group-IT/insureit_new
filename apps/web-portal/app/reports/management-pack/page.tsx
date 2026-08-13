import Link from "next/link";
import { Archive, LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/shell";
import { ReportApplyButton, ReportExportLink, ReportFilterField, ReportPageShell, ReportResetLink, reportInputClass } from "@/components/reports/report-page-shell";
import { requireCapability } from "@/lib/master-data-server";
import { loadManagementPack, type ManagementPackQuery } from "@/lib/reports/management-pack";
import { findManagementPackSnapshotForMonth, isManagementPackCloseEligible, loadManagementPackSnapshot } from "@/lib/reports/management-pack-archive";
import { captureManagementPackSnapshotAction } from "./actions";
import { ManagementPackPrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageQuery = ManagementPackQuery & { snapshot?: string; archive_error?: string };
type Props = { searchParams: Promise<PageQuery> };

export default async function ManagementPackPage({ searchParams }: Props) {
  const profile = await requireCapability("view_reports");
  if (!profile) return null;
  const query = await searchParams;
  const archived = query.snapshot ? await loadManagementPackSnapshot(profile.id, query.snapshot) : null;
  const pack = archived?.pack ?? await loadManagementPack(profile, query);
  const existingSnapshot = archived ?? await findManagementPackSnapshotForMonth(profile.id, pack.filters.month);
  const canCapture = !archived && !existingSnapshot && isManagementPackCloseEligible(pack.filters.month);
  const monthLabel = formatMonth(pack.filters.month);
  const exportHref = archived
    ? `/reports/export/management-pack?snapshot=${encodeURIComponent(archived.id)}`
    : `/reports/export/management-pack?month=${encodeURIComponent(pack.filters.month)}`;
  const archiveError = typeof query.archive_error === "string" ? query.archive_error.slice(0, 180) : null;

  return (
    <AppShell title="Reports">
      <ReportPageShell
        title="Month-End Management Pack"
        titleAccessory={archived ? <span className="rounded-md border border-[#cad4e4] bg-[#f7f9fc] px-2 py-1 text-[8.5px] font-black uppercase tracking-[.08em] text-[#42516b]">Frozen</span> : null}
        className="print:max-w-none print:space-y-3 print:pb-0"
        headerClassName="print:border-0 print:shadow-none"
        controlsClassName="print:px-0 print:py-2"
        actions={<div className="flex flex-wrap gap-2 print:hidden">
          <Link href="/reports/management-pack/archive" className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#cad4e4] bg-white px-3 text-[10px] font-bold text-[#263b69]"><Archive className="h-3.5 w-3.5" />Archive</Link>
          {canCapture ? <form action={captureManagementPackSnapshotAction}><input type="hidden" name="month" value={pack.filters.month} /><button className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#172a5c] px-3 text-[10px] font-bold text-white"><LockKeyhole className="h-3.5 w-3.5" />Close Month</button></form> : null}
          {existingSnapshot && !archived ? <Link href={`/reports/management-pack?snapshot=${encodeURIComponent(existingSnapshot.id)}`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#cad4e4] bg-white px-3 text-[10px] font-bold text-[#263b69]"><LockKeyhole className="h-3.5 w-3.5" />Frozen Pack</Link> : null}
          <ReportExportLink href={exportHref} />
          <ManagementPackPrintButton />
        </div>}
        controls={<>
          {archived ? <div className="flex flex-wrap items-end gap-2 print:hidden"><ReportResetLink href={`/reports/management-pack?month=${encodeURIComponent(pack.filters.month)}`} label="Live View" /><span className="pb-2 text-[9.5px] font-semibold text-[#68778c]">Captured {formatTimestamp(archived.capturedAt)}</span></div> : <form action="/reports/management-pack" method="get" className="flex flex-wrap items-end gap-2 print:hidden"><ReportFilterField label="Month"><input name="month" type="month" max={pack.filters.currentMonth} defaultValue={pack.filters.month} className={`${reportInputClass} min-w-[190px]`} /></ReportFilterField><ReportApplyButton /><ReportResetLink href="/reports/management-pack" label="Current month" /></form>}
          <div className={`${archived ? "mt-2" : "mt-3"} flex items-center justify-between gap-3 text-[10px] font-semibold text-[#66748a] print:mt-0`}><span>{monthLabel}</span><span>{formatDate(pack.filters.fromDate)} — {formatDate(pack.filters.toDate)}</span></div>
        </>}
      >
        {archiveError ? <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-[10px] font-semibold text-red-700">{archiveError}</div> : null}

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
          <article className="portal-card overflow-hidden print:break-inside-avoid"><Header title={archived ? "Renewal exposure" : "Current renewal exposure"} /><div className="grid gap-3 p-5 sm:grid-cols-3"><Mini label="Due ≤ 30d" value={integer(pack.renewals.summary.due_30_count)} /><Mini label="Due ≤ 90d" value={integer(pack.renewals.summary.due_90_count)} /><Mini label="Premium at risk" value={currency(pack.renewals.summary.premium_at_risk)} /></div><RenewalTable rows={pack.renewals.buckets} /></article>
          <article className="portal-card overflow-hidden print:break-inside-avoid"><Header title={archived ? "Operations exposure" : "Current operations exposure"} /><div className="grid gap-3 p-5 sm:grid-cols-3"><Mini label="Vehicles" value={integer(pack.operations.summary.vehicle_count)} /><Mini label="AuthBridge unverified" value={integer(pack.operations.summary.authbridge_unverified_count)} /><Mini label="Missing fields" value={integer(pack.operations.summary.missing_compliance_fields)} /><Mini label="Expired documents" value={integer(pack.operations.summary.expired_document_count)} /><Mini label="Due ≤ 90d" value={integer(pack.operations.summary.due_document_count)} /><Mini label="Customer doc exceptions" value={integer(pack.operations.customer_documents.customers_with_exceptions)} /></div><OperationsTable rows={pack.operations.compliance} /></article>
        </section>

        {pack.governance ? <section className="portal-card overflow-hidden print:break-inside-avoid"><Header title="Governance" /><div className="grid gap-3 p-5 sm:grid-cols-3 xl:grid-cols-6"><Mini label="Active profiles" value={integer(pack.governance.summary.active_profile_count)} /><Mini label="Inactive profiles" value={integer(pack.governance.summary.inactive_profile_count)} /><Mini label="Employee overrides" value={integer(pack.governance.summary.active_employee_override_count)} /><Mini label="Role overrides" value={integer(pack.governance.summary.role_override_count)} /><Mini label="Permission changes" value={integer(pack.governance.summary.permission_change_count)} /><Mini label="Audit events" value={integer(pack.governance.summary.audit_event_count)} /></div></section> : null}
      </ReportPageShell>
    </AppShell>
  );
}

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
function formatTimestamp(value: string) { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
