import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/shell";
import { ReportQueryShortcuts } from "@/components/reports/report-query-shortcuts";
import { ReportApplyButton, ReportEmptyState, ReportExportLink, ReportFilterField, ReportPageShell, ReportResetLink, reportInputClass } from "@/components/reports/report-page-shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { loadFinanceReport, type FinanceFilters, type FinanceQuery, type FinanceReport } from "@/lib/reports/finance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERIODS = [
  { value: "90d", label: "Last 90 days" },
  { value: "mtd", label: "Month to date" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
] as const;

type Props = { searchParams: Promise<FinanceQuery> };

export default async function FinanceReportsPage({ searchParams }: Props) {
  const profile = await requireCapability("view_reports");
  if(profile.role==="backoffice_executive")redirect("/access-denied");
  if (!canAccessPolicyCommercials(profile)) {
    return (
      <AppShell title="Reports">
        <div className="mx-auto max-w-[900px] rounded-2xl border border-[#D9E2F0] bg-white px-5 py-8 shadow-sm">
          <h1 className="text-[16px] font-semibold text-[#17365D]">Commercial performance</h1>
          <div className="mt-4 rounded-xl border border-dashed border-[#D7DDE6] bg-[#F8FAFC] px-4 py-5 text-[10px] font-semibold text-[#667085]">Commercial details restricted</div>
        </div>
      </AppShell>
    );
  }

  const query = await searchParams;
  let payload: Awaited<ReturnType<typeof loadFinanceReport>> | null = null;
  let loadError = false;
  try {
    payload = await loadFinanceReport(profile, query);
  } catch (error) {
    console.error("[reports] commercial report failed", error instanceof Error ? error.message : "unknown error");
    loadError = true;
  }

  const report = payload?.report ?? emptyReport();
  const filters = payload?.filters ?? fallbackFilters();
  const pages = Math.max(1, Math.ceil(report.register.total_count / Math.max(report.register.page_size, 1)));
  const exportHref = href("/reports/export/finance", filters, undefined);
  const projectedMargin = report.summary.projected_payin - report.summary.gross_payout;

  return (
    <AppShell title="Reports">
      <ReportPageShell
        title="Commercial performance"
        loadError={loadError}
        actions={<div className="flex flex-wrap gap-2"><Link href="/policies/commercial-review" className="rounded-lg border border-[#D9E2F0] bg-white px-3 py-2 text-[9px] font-bold text-[#315B9A]">Commercial Review</Link><ReportExportLink href={exportHref} /></div>}
        controls={<>
          <ReportQueryShortcuts label="Period" param="period" activeValue={filters.period} options={PERIODS} />
          <form action="/reports/finance" method="get" className="grid gap-2 md:grid-cols-2 xl:grid-cols-[145px_145px_minmax(180px,1fr)_minmax(160px,1fr)_minmax(180px,1fr)_auto_auto]">
            <input type="hidden" name="period" value="custom" />
            <ReportFilterField label="From"><input name="from" type="date" defaultValue={filters.fromDate ?? ""} className={reportInputClass} /></ReportFilterField>
            <ReportFilterField label="To"><input name="to" type="date" defaultValue={filters.toDate ?? ""} className={reportInputClass} /></ReportFilterField>
            <ReportFilterField label="Insurance company"><select name="insurer" defaultValue={filters.insurerId ?? ""} className={reportInputClass}><option value="">All insurers</option>{report.filters.insurers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></ReportFilterField>
            <ReportFilterField label="Relationship manager"><select name="rm" defaultValue={filters.rmEmployeeId ?? ""} className={reportInputClass}><option value="">All RMs</option>{report.filters.rms.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></ReportFilterField>
            <ReportFilterField label="Partner / intermediary"><select name="intermediary" defaultValue={filters.intermediaryCode ?? ""} className={reportInputClass}><option value="">All intermediaries</option>{report.filters.intermediaries.map((x) => <option key={x.code} value={x.code}>{x.name} · {x.code}</option>)}</select></ReportFilterField>
            <ReportApplyButton />
            <ReportResetLink href="/reports/finance" />
          </form>
        </>}
      >
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Policies" value={integer(report.summary.policy_count)} />
          <Metric label="Gross premium" value={currency(report.summary.gross_premium)} />
          <Metric label="Projected insurer pay-in" value={currency(report.summary.projected_payin)} />
          <Metric label="Partner payout" value={currency(report.summary.gross_payout)} />
          <Metric label="Projected margin" value={currency(projectedMargin)} />
        </section>

        <section className="rounded-xl border border-[#DCE6F2] bg-[#F8FAFD] px-4 py-3 text-[9.5px] leading-5 text-[#667085]">
          Projected insurer pay-in is a commercial expectation, not billed or reconciled insurer income. Partner payout is the actual agreed payout commercial and remains independent of insurer settlement. Actual insurer pay-in will be introduced through the reconciliation workflow.
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="portal-card overflow-hidden"><Header title="Insurance company commercials" /><InsurerTable rows={report.insurers} /></article>
          <article className="portal-card overflow-hidden"><Header title="RM commercials" /><RmTable rows={report.rms} /></article>
        </section>

        <section className="portal-card overflow-hidden">
          <div className="border-b border-[#e9edf3] px-5 py-4"><h2 className="text-[14px] font-bold text-[#1b2943]">Policy commercial register</h2></div>
          <Register rows={report.register.rows} />
          <Pagination page={report.register.page} pages={pages} total={report.register.total_count} prev={href("/reports/finance", filters, Math.max(1, report.register.page - 1))} next={href("/reports/finance", filters, report.register.page + 1)} />
        </section>
      </ReportPageShell>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="portal-card px-4 py-4"><p className="text-[8.5px] font-black uppercase tracking-[.08em] text-[#7c899b]">{label}</p><p className="mt-2 text-[20px] font-semibold text-[#14213c]">{value}</p></article>;
}
function Header({ title }: { title: string }) { return <div className="border-b border-[#e9edf3] px-5 py-4"><h2 className="text-[14px] font-bold text-[#1b2943]">{title}</h2></div>; }
function Empty() { return <ReportEmptyState />; }

function InsurerTable({ rows }: { rows: FinanceReport["insurers"] }) {
  if (!rows.length) return <Empty />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead><tr className="bg-[#f8fafc] text-[8px] font-black uppercase tracking-[.07em] text-[#7c899b]"><th className="px-5 py-3 text-left">Insurer</th><th className="px-3 py-3 text-right">Policies</th><th className="px-3 py-3 text-right">Projected Pay-in</th><th className="px-3 py-3 text-right">Partner Payout</th><th className="px-5 py-3 text-right">Projected Margin</th></tr></thead><tbody className="divide-y divide-[#edf0f4]">{rows.map((x, i) => <tr key={`${x.id ?? "none"}-${i}`} className="text-[10px]"><td className="px-5 py-3.5 font-semibold">{x.insurer_name}</td><td className="px-3 py-3.5 text-right">{integer(x.policy_count)}</td><td className="px-3 py-3.5 text-right">{currency(x.projected_payin)}</td><td className="px-3 py-3.5 text-right">{currency(x.gross_payout)}</td><td className="px-5 py-3.5 text-right font-bold">{currency(x.projected_payin - x.gross_payout)}</td></tr>)}</tbody></table></div>;
}

function RmTable({ rows }: { rows: FinanceReport["rms"] }) {
  if (!rows.length) return <Empty />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[700px]"><thead><tr className="bg-[#f8fafc] text-[8px] font-black uppercase tracking-[.07em] text-[#7c899b]"><th className="px-5 py-3 text-left">RM</th><th className="px-3 py-3 text-right">Policies</th><th className="px-3 py-3 text-right">Projected Pay-in</th><th className="px-3 py-3 text-right">Partner Payout</th><th className="px-5 py-3 text-right">Projected Margin</th></tr></thead><tbody className="divide-y divide-[#edf0f4]">{rows.map((x) => <tr key={x.rm_name} className="text-[10px]"><td className="px-5 py-3.5 font-semibold">{x.rm_name}</td><td className="px-3 py-3.5 text-right">{integer(x.policy_count)}</td><td className="px-3 py-3.5 text-right">{currency(x.projected_payin)}</td><td className="px-3 py-3.5 text-right">{currency(x.gross_payout)}</td><td className="px-5 py-3.5 text-right font-bold">{currency(x.projected_payin - x.gross_payout)}</td></tr>)}</tbody></table></div>;
}

function Register({ rows }: { rows: FinanceReport["register"]["rows"] }) {
  if (!rows.length) return <Empty />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[1160px]"><thead><tr className="bg-[#f8fafc] text-[8px] font-black uppercase tracking-[.07em] text-[#7c899b]"><th className="px-5 py-3 text-left">Business date</th><th className="px-3 py-3 text-left">Policy</th><th className="px-3 py-3 text-left">Customer / vehicle</th><th className="px-3 py-3 text-left">Insurer</th><th className="px-3 py-3 text-left">RM / intermediary</th><th className="px-3 py-3 text-right">Gross Premium</th><th className="px-3 py-3 text-right">Projected Pay-in</th><th className="px-3 py-3 text-right">Partner Payout</th><th className="px-3 py-3 text-right">Projected Margin</th><th className="px-5 py-3 text-center">Open</th></tr></thead><tbody className="divide-y divide-[#edf0f4]">{rows.map((x) => <tr key={x.id} className="text-[9.5px] hover:bg-[#fbfcfe]"><td className="px-5 py-3.5 font-semibold">{date(x.business_date)}</td><td className="px-3 py-3.5"><p className="font-bold">{x.policy_no}</p><p className="text-[8px] text-[#8490a1]">{x.policy_type}</p></td><td className="px-3 py-3.5"><p className="font-semibold">{x.customer_name}</p><p className="text-[8px] text-[#8490a1]">{x.vehicle_no}</p></td><td className="px-3 py-3.5">{x.insurer_name}</td><td className="px-3 py-3.5"><p className="font-semibold">{x.rm_name ?? "Unassigned"}</p><p className="text-[8px] text-[#8490a1]">{x.intermediary_code ?? "—"}</p></td><td className="px-3 py-3.5 text-right">{currency(x.gross_premium)}</td><td className="px-3 py-3.5 text-right">{currency(x.projected_payin)}</td><td className="px-3 py-3.5 text-right">{currency(x.gross_payout)}</td><td className="px-3 py-3.5 text-right font-bold">{currency(x.projected_payin - x.gross_payout)}</td><td className="px-5 py-3.5 text-center"><Link href={`/policies/${x.id}`} className="inline-grid h-8 w-8 place-items-center rounded-lg border border-[#d9e1ec] text-[#425b8f]"><ExternalLink className="h-3.5 w-3.5" /></Link></td></tr>)}</tbody></table></div>;
}

function Pagination({ page, pages, total, prev, next }: { page: number; pages: number; total: number; prev: string; next: string }) {
  return <div className="flex items-center justify-between border-t border-[#edf0f4] px-5 py-3 text-[9.5px] text-[#738095]"><span>{integer(total)} records</span><div className="flex items-center gap-2"><Link href={page <= 1 ? "#" : prev} className={`rounded-md border px-3 py-1.5 font-bold ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>Previous</Link><span>{page} / {pages}</span><Link href={page >= pages ? "#" : next} className={`rounded-md border px-3 py-1.5 font-bold ${page >= pages ? "pointer-events-none opacity-40" : ""}`}>Next</Link></div></div>;
}

function href(path: string, f: FinanceFilters, page?: number) {
  const q = new URLSearchParams();
  q.set("period", "custom");
  if (f.fromDate) q.set("from", f.fromDate);
  if (f.toDate) q.set("to", f.toDate);
  if (f.insurerId) q.set("insurer", f.insurerId);
  if (f.rmEmployeeId) q.set("rm", f.rmEmployeeId);
  if (f.intermediaryCode) q.set("intermediary", f.intermediaryCode);
  if (page) q.set("page", String(page));
  return `${path}?${q.toString()}`;
}

function emptyReport(): FinanceReport {
  return {
    summary: { policy_count: 0, gross_premium: 0, projected_payin: 0, payin_after_tds: 0, billed_amount: 0, gross_payout: 0, retention_amount: 0, unbilled_count: 0, billing_incomplete_count: 0, billed_count: 0, pending_payout_count: 0 },
    insurers: [], rms: [], billing: [],
    register: { rows: [], total_count: 0, page: 1, page_size: 50 },
    filters: { insurers: [], rms: [], intermediaries: [], billing_statuses: [] },
  };
}
function fallbackFilters(): FinanceFilters { return { period: "90d", fromDate: null, toDate: null, insurerId: null, rmEmployeeId: null, intermediaryCode: null, billingStatus: null, page: 1 }; }
function currency(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function integer(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
function date(value: string | null) { if (!value) return "—"; const d = new Date(`${value}T00:00:00Z`); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d); }
