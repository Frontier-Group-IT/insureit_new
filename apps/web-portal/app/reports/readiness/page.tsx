import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/shell";
import { ReportApplyButton, ReportEmptyState, ReportExportLink, ReportFilterField, ReportPageShell, ReportResetLink, reportInputClass } from "@/components/reports/report-page-shell";
import { requireCapability } from "@/lib/master-data-server";
import { emptyReadinessReport, loadReportingReadiness, resolveReportingReadinessFilters, type ReportingReadinessQuery, type ReadinessDomain } from "@/lib/reports/readiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<ReportingReadinessQuery> };

export default async function ReportingReadinessPage({ searchParams }: Props) {
  const profile = await requireCapability("view_reports");
  if (!profile) return null;
  const query = await searchParams;
  let payload: Awaited<ReturnType<typeof loadReportingReadiness>> | null = null;
  let loadError = false;
  try {
    payload = await loadReportingReadiness(profile, query);
  } catch (error) {
    console.error("[reports] reporting readiness failed", error instanceof Error ? error.message : "unknown error");
    loadError = true;
  }
  const filters = payload?.filters ?? resolveReportingReadinessFilters(query);
  const report = payload?.report ?? emptyReadinessReport(filters.page, 25);
  const exportHref = `/reports/export/readiness?domain=${encodeURIComponent(filters.domain)}`;
  const totalPages = Math.max(1, Math.ceil(report.register.total_count / report.register.page_size));

  return (
    <AppShell title="Reports">
      <ReportPageShell
        title="Reporting readiness"
        loadError={loadError}
        actions={<ReportExportLink href={exportHref} />}
        controls={
          <form action="/reports/readiness" method="get" className="flex flex-wrap items-end gap-2">
            <ReportFilterField label="Domain">
              <select name="domain" defaultValue={filters.domain} className={`${reportInputClass} min-w-[210px]`}>
                <option value="all">All exceptions</option>
                <option value="vehicle">Vehicles</option>
                <option value="policy_finance">Policy & Finance</option>
                <option value="claim">Claims</option>
                <option value="customer">Customer documents</option>
              </select>
            </ReportFilterField>
            <ReportApplyButton />
            <ReportResetLink href="/reports/readiness" />
          </form>
        }
      >
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Exception records" value={integer(report.summary.exception_records)} />
          <Metric label="Critical" value={integer(report.summary.critical_records)} />
          <Metric label="Workflow backlog" value={integer(report.summary.workflow_backlog)} />
          <Metric label="Missing compliance" value={integer(report.summary.missing_compliance_fields)} />
          <Metric label="AuthBridge unverified" value={integer(report.summary.authbridge_unverified)} />
          <Metric label="Pending claim docs" value={integer(report.summary.claim_pending_documents)} />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <article className="portal-card overflow-hidden"><Header title="Vehicle readiness" /><div className="grid grid-cols-2 gap-3 p-5"><Mini label="Vehicles with gaps" value={integer(report.summary.vehicle_records)} /><Mini label="Missing dates" value={integer(report.summary.missing_compliance_fields)} /><Mini label="Expired" value={integer(report.summary.expired_compliance_fields)} /><Mini label="Due ≤ 30d" value={integer(report.summary.due_30_compliance_fields)} /><Mini label="RC unverified" value={integer(report.summary.authbridge_unverified)} /><Mini label="Registration pending" value={integer(report.summary.registration_pending)} /></div></article>
          <article className="portal-card overflow-hidden"><Header title="Policy & Finance readiness" /><div className="grid grid-cols-2 gap-3 p-5"><Mini label="Records with issues" value={integer(report.summary.policy_finance_records)} /><Mini label="Missing PayIn" value={integer(report.summary.finance_missing_payin)} /><Mini label="Billing incomplete" value={integer(report.summary.billing_incomplete)} /><Mini label="Unbilled" value={integer(report.summary.unbilled)} /><Mini label="Pending payout" value={integer(report.summary.pending_payout)} /><Mini label="Negative retention" value={integer(report.summary.negative_retention)} /></div></article>
          <article className="portal-card overflow-hidden"><Header title="Master & document readiness" /><div className="grid grid-cols-2 gap-3 p-5"><Mini label="Missing insurer" value={integer(report.summary.policy_missing_insurer)} /><Mini label="Missing premium" value={integer(report.summary.policy_missing_premium)} /><Mini label="RM unassigned" value={integer(report.summary.policy_unassigned_rm)} /><Mini label="Claim doc exceptions" value={integer(report.summary.claim_records)} /><Mini label="Customer doc exceptions" value={integer(report.summary.customer_records)} /><Mini label="Rejected docs" value={integer(report.summary.claim_rejected_documents + report.summary.customer_rejected_documents)} /></div></article>
        </section>

        <section className="portal-card overflow-hidden">
          <div className="border-b border-[#e9edf3] px-5 py-4 sm:px-6"><h2 className="text-[14px] font-bold text-[#1b2943]">Exceptions by domain</h2></div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {report.domains.map((item) => <Link key={item.domain} href={`/reports/readiness?domain=${encodeURIComponent(item.domain)}`} className="rounded-xl border border-[#e2e7ee] bg-white px-4 py-4 transition hover:border-[#b7c4d8]"><p className="text-[9px] font-black uppercase tracking-[.08em] text-[#7c899b]">{item.label}</p><div className="mt-2 flex items-end justify-between"><span className="text-[22px] font-semibold text-[#14213c]">{integer(item.exception_records)}</span><ArrowRight className="h-4 w-4 text-[#73819a]" /></div></Link>)}
          </div>
        </section>

        <section className="portal-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#e9edf3] px-5 py-4 sm:px-6"><h2 className="text-[14px] font-bold text-[#1b2943]">Exception register</h2><span className="text-[9.5px] font-bold text-[#748096]">{integer(report.register.total_count)} records</span></div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full text-left"><thead><tr className="border-b border-[#eef1f5] bg-[#fafbfc] text-[8.5px] font-black uppercase tracking-[.06em] text-[#7c8798]"><th className="px-5 py-3">Severity</th><th className="px-4 py-3">Domain</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Exceptions</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
              <tbody>{report.register.rows.map((row) => <tr key={`${row.domain}-${row.entity_id}`} className="border-b border-[#f0f2f5] align-top text-[10px] text-[#34435c] last:border-0"><td className="px-5 py-4"><Severity value={row.severity} /></td><td className="px-4 py-4 font-bold">{domainLabel(row.domain)}</td><td className="px-4 py-4"><p className="font-bold text-[#1e2d49]">{row.primary_label}</p></td><td className="px-4 py-4">{row.secondary_label}</td><td className="max-w-[520px] px-4 py-4"><div className="flex flex-wrap gap-1.5">{row.issue_labels.map((label) => <span key={label} className="rounded-md border border-[#e2e7ee] bg-[#f8fafc] px-2 py-1 text-[9px] font-semibold text-[#536176]">{label}</span>)}</div></td><td className="px-5 py-4 text-right"><Link href={row.action_path} className="inline-flex items-center gap-1.5 font-bold text-[#264a91]">Open <ArrowRight className="h-3.5 w-3.5" /></Link></td></tr>)}</tbody>
            </table>
          </div>
          <div className="divide-y divide-[#edf0f4] lg:hidden">{report.register.rows.map((row) => <div key={`${row.domain}-${row.entity_id}`} className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.06em] text-[#7b8799]">{domainLabel(row.domain)}</p><p className="mt-1 text-[12px] font-bold text-[#1e2d49]">{row.primary_label}</p><p className="mt-0.5 text-[10px] text-[#647086]">{row.secondary_label}</p></div><Severity value={row.severity} /></div><div className="flex flex-wrap gap-1.5">{row.issue_labels.map((label) => <span key={label} className="rounded-md border border-[#e2e7ee] bg-[#f8fafc] px-2 py-1 text-[9px] font-semibold text-[#536176]">{label}</span>)}</div><Link href={row.action_path} className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#264a91]">Open record <ArrowRight className="h-3.5 w-3.5" /></Link></div>)}</div>
          {report.register.rows.length === 0 ? <ReportEmptyState message="No exceptions in this view." /> : null}
          {totalPages > 1 ? <div className="flex items-center justify-between border-t border-[#edf0f4] px-5 py-4"><span className="text-[9.5px] font-semibold text-[#7a8798]">Page {report.register.page} of {totalPages}</span><div className="flex gap-2">{report.register.page > 1 ? <Link href={pageHref(filters.domain, report.register.page - 1)} className={pageButton}>Previous</Link> : null}{report.register.page < totalPages ? <Link href={pageHref(filters.domain, report.register.page + 1)} className={pageButton}>Next</Link> : null}</div></div> : null}
        </section>
      </ReportPageShell>
    </AppShell>
  );
}

const pageButton = "inline-flex h-9 items-center rounded-lg border border-[#dfe5ee] bg-white px-3 text-[9.5px] font-bold text-[#506077]";
function Metric({ label, value }: { label: string; value: string }) { return <article className="portal-card px-4 py-4"><p className="text-[8.5px] font-black uppercase tracking-[.08em] text-[#7c899b]">{label}</p><p className="mt-2 text-[20px] font-semibold text-[#14213c]">{value}</p></article>; }
function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#e2e7ee] bg-white px-4 py-3"><p className="text-[8px] font-black uppercase tracking-[.08em] text-[#8994a5]">{label}</p><p className="mt-1.5 text-[17px] font-semibold text-[#1e2d49]">{value}</p></div>; }
function Header({ title }: { title: string }) { return <div className="border-b border-[#e9edf3] px-5 py-4"><h2 className="text-[14px] font-bold text-[#1b2943]">{title}</h2></div>; }
function Severity({ value }: { value: "critical" | "warning" | "attention" }) { const classes=value==="critical"?"border-red-200 bg-red-50 text-red-700":value==="warning"?"border-amber-200 bg-amber-50 text-amber-700":"border-slate-200 bg-slate-50 text-slate-600"; return <span className={`inline-flex rounded-md border px-2 py-1 text-[8.5px] font-black uppercase tracking-[.05em] ${classes}`}>{value}</span>; }
function domainLabel(domain: Exclude<ReadinessDomain,"all">) { if(domain==="policy_finance")return "Policy & Finance"; if(domain==="claim")return "Claims"; if(domain==="customer")return "Customer documents"; return "Vehicles"; }
function pageHref(domain: ReadinessDomain, page: number) { const params=new URLSearchParams(); if(domain!=="all")params.set("domain",domain); params.set("page",String(page)); return `/reports/readiness?${params.toString()}`; }
function integer(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
