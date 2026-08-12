import Link from "next/link";
import { ExternalLink, Filter } from "lucide-react";
import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import {
  loadDistributionReport,
  type DistributionFilters,
  type DistributionQuery,
  type DistributionReport,
} from "@/lib/reports/distribution";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERIODS = [
  { key: "90d", label: "Last 90 days" },
  { key: "mtd", label: "Month to date" },
  { key: "ytd", label: "Year to date" },
  { key: "all", label: "All time" },
] as const;

type PageProps = { searchParams: Promise<DistributionQuery> };

export default async function DistributionReportsPage({ searchParams }: PageProps) {
  const profile = await requireCapability("view_reports");
  const query = await searchParams;

  let payload: Awaited<ReturnType<typeof loadDistributionReport>> | null = null;
  let loadError = false;
  try {
    payload = await loadDistributionReport(profile, query);
  } catch (error) {
    console.error("[reports] distribution report failed", error instanceof Error ? error.message : "unknown error");
    loadError = true;
  }

  const report = payload?.report ?? emptyReport();
  const filters = payload?.filters ?? fallbackFilters();
  const intermediaryPages = Math.max(1, Math.ceil(report.intermediaries.total_count / Math.max(report.intermediaries.page_size, 1)));
  const onboardingPages = Math.max(1, Math.ceil(report.onboarding.total_count / Math.max(report.onboarding.page_size, 1)));

  return (
    <AppShell title="Reports">
      <div className="mx-auto max-w-[1560px] space-y-4 pb-8">
        <header className="portal-card overflow-hidden">
          <div className="border-b border-[#e8ecf2] px-5 py-5 sm:px-6">
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[#13203b] sm:text-[30px]">Distribution performance</h1>
            <ReportTabs />
          </div>

          <div className="px-5 py-4 sm:px-6">
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((period) => (
                <Link
                  key={period.key}
                  href={`/reports/distribution?period=${period.key}`}
                  className={`rounded-lg border px-3 py-2 text-[10px] font-bold transition ${filters.period === period.key ? "border-[#223a78] bg-[#223a78] text-white" : "border-[#dfe5ee] bg-white text-[#506077] hover:border-[#bfc9db] hover:text-[#23365f]"}`}
                >
                  {period.label}
                </Link>
              ))}
            </div>

            <form action="/reports/distribution" method="get" className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[150px_150px_minmax(190px,1fr)_150px_170px_auto_auto]">
              <input type="hidden" name="period" value="custom" />
              <FilterField label="From"><input name="from" type="date" defaultValue={filters.fromDate ?? ""} className={inputClass} /></FilterField>
              <FilterField label="To"><input name="to" type="date" defaultValue={filters.toDate ?? ""} className={inputClass} /></FilterField>
              <FilterField label="Relationship manager">
                <select name="rm" defaultValue={filters.rmEmployeeId ?? ""} className={inputClass}>
                  <option value="">All RMs</option>
                  {report.filters.rms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </FilterField>
              <FilterField label="Type">
                <select name="type" defaultValue={filters.intermediaryType ?? ""} className={inputClass}>
                  <option value="">All types</option>
                  <option value="partner">Partner</option>
                  <option value="posp">POSP</option>
                  <option value="misp">MISP</option>
                </select>
              </FilterField>
              <FilterField label="Account status">
                <select name="status" defaultValue={filters.accountStatus ?? ""} className={inputClass}>
                  <option value="">All statuses</option>
                  {report.filters.account_statuses.map((status) => <option key={status} value={status}>{labelize(status)}</option>)}
                </select>
              </FilterField>
              <button type="submit" className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#172a5c] px-4 text-[10.5px] font-bold text-white transition hover:bg-[#213a78]">
                <Filter className="h-3.5 w-3.5" /> Apply
              </button>
              <Link href="/reports/distribution" className="mt-auto inline-flex h-10 items-center justify-center rounded-lg border border-[#dfe5ee] bg-white px-4 text-[10.5px] font-bold text-[#526174] transition hover:border-[#c8d1df] hover:bg-[#f8fafc]">Reset</Link>
            </form>
          </div>
        </header>

        {loadError ? <ErrorBanner /> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Intermediaries" value={formatInteger(report.summary.intermediary_count)} />
          <Metric label="Active" value={formatInteger(report.summary.active_intermediary_count)} />
          <Metric label="Producing" value={formatInteger(report.summary.producing_intermediary_count)} />
          <Metric label="Policies" value={formatInteger(report.summary.policy_count)} />
          <Metric label="Gross premium" value={formatCurrency(report.summary.gross_premium)} />
          <Metric label="Open onboarding" value={formatInteger(report.summary.onboarding_open_count)} />
        </section>

        <section className="portal-card overflow-hidden">
          <SectionHeader title="RM performance" />
          <RmPerformance rows={report.rms} />
        </section>

        <section className="portal-card overflow-hidden">
          <SectionHeader title="Intermediary business" />
          <IntermediaryTable rows={report.intermediaries.rows} />
          <Pagination
            page={report.intermediaries.page}
            pageCount={intermediaryPages}
            total={report.intermediaries.total_count}
            pageSize={report.intermediaries.page_size}
            previousHref={distributionHref(filters, Math.max(1, report.intermediaries.page - 1), report.onboarding.page)}
            nextHref={distributionHref(filters, report.intermediaries.page + 1, report.onboarding.page)}
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-8">
          <PipelineMetric label="Open" value={report.onboarding_summary.open} />
          <PipelineMetric label="Compliance" value={report.onboarding_summary.compliance} />
          <PipelineMetric label="Training" value={report.onboarding_summary.training} />
          <PipelineMetric label="Exam" value={report.onboarding_summary.exam} />
          <PipelineMetric label="Agreement" value={report.onboarding_summary.agreement} />
          <PipelineMetric label="IIB" value={report.onboarding_summary.iib} />
          <PipelineMetric label="Completed" value={report.onboarding_summary.completed} />
          <PipelineMetric label="Rejected" value={report.onboarding_summary.rejected} />
        </section>

        <section className="portal-card overflow-hidden">
          <SectionHeader title="Onboarding pipeline" />
          <OnboardingTable rows={report.onboarding.rows} />
          <Pagination
            page={report.onboarding.page}
            pageCount={onboardingPages}
            total={report.onboarding.total_count}
            pageSize={report.onboarding.page_size}
            previousHref={distributionHref(filters, report.intermediaries.page, Math.max(1, report.onboarding.page - 1))}
            nextHref={distributionHref(filters, report.intermediaries.page, report.onboarding.page + 1)}
          />
        </section>
      </div>
    </AppShell>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-[#dfe5ee] bg-white px-3 text-[10.5px] font-semibold text-[#26364f] outline-none transition focus:border-[#7788bd] focus:ring-2 focus:ring-[#dfe5ff]";

function ReportTabs() {
  return (
    <nav className="mt-4 flex flex-wrap gap-2">
      <Link href="/reports" className="rounded-lg border border-[#dfe5ee] bg-white px-3 py-2 text-[10px] font-bold text-[#506077]">Business</Link>
      <Link href="/reports/distribution" className="rounded-lg border border-[#223a78] bg-[#223a78] px-3 py-2 text-[10px] font-bold text-white">Distribution</Link>
    </nav>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[8.5px] font-black uppercase tracking-[0.08em] text-[#7b8799]">{label}</span>{children}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="portal-card px-4 py-4 sm:px-5"><p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#7c899b]">{label}</p><p className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-[#14213c]">{value}</p></article>;
}

function PipelineMetric({ label, value }: { label: string; value: number }) {
  return <article className="rounded-xl border border-[#e2e7ee] bg-white px-4 py-3"><p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8994a5]">{label}</p><p className="mt-1.5 text-[18px] font-semibold text-[#1e2d49]">{formatInteger(value)}</p></article>;
}

function SectionHeader({ title }: { title: string }) {
  return <div className="border-b border-[#e9edf3] px-5 py-4"><h2 className="text-[14px] font-bold text-[#1b2943]">{title}</h2></div>;
}

function RmPerformance({ rows }: { rows: DistributionReport["rms"] }) {
  if (!rows.length) return <EmptyRow />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <thead><tr className="bg-[#f8fafc] text-[8.5px] font-black uppercase tracking-[0.07em] text-[#7c899b]"><th className="px-5 py-3">Relationship manager</th><th className="px-3 py-3 text-right">Intermediaries</th><th className="px-3 py-3 text-right">Active</th><th className="px-3 py-3 text-right">Producing</th><th className="px-3 py-3 text-right">Policies</th><th className="px-3 py-3 text-right">Customers</th><th className="px-5 py-3 text-right">Gross premium</th></tr></thead>
        <tbody className="divide-y divide-[#edf0f4]">
          {rows.map((row) => <tr key={`${row.employee_id ?? "none"}-${row.name}`} className="text-[10.5px]"><td className="px-5 py-3.5 font-semibold text-[#283851]">{row.name}</td><td className="px-3 py-3.5 text-right tabular-nums text-[#536174]">{formatInteger(row.intermediary_count)}</td><td className="px-3 py-3.5 text-right tabular-nums text-[#536174]">{formatInteger(row.active_intermediary_count)}</td><td className="px-3 py-3.5 text-right tabular-nums text-[#536174]">{formatInteger(row.producing_intermediary_count)}</td><td className="px-3 py-3.5 text-right tabular-nums text-[#536174]">{formatInteger(row.policy_count)}</td><td className="px-3 py-3.5 text-right tabular-nums text-[#536174]">{formatInteger(row.customer_count)}</td><td className="px-5 py-3.5 text-right font-bold tabular-nums text-[#283851]">{formatCurrency(row.gross_premium)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function IntermediaryTable({ rows }: { rows: DistributionReport["intermediaries"]["rows"] }) {
  if (!rows.length) return <EmptyRow />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] border-collapse text-left">
        <thead><tr className="bg-[#f8fafc] text-[8.2px] font-black uppercase tracking-[0.07em] text-[#7c899b]"><th className="px-5 py-3">Intermediary</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">RM</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Policies</th><th className="px-3 py-3 text-right">Customers</th><th className="px-3 py-3 text-right">Gross premium</th><th className="px-3 py-3">Last business</th><th className="px-5 py-3 text-center">Open</th></tr></thead>
        <tbody className="divide-y divide-[#edf0f4]">
          {rows.map((row) => (
            <tr key={row.id} className="text-[10px] transition hover:bg-[#fbfcfe]">
              <td className="px-5 py-3.5"><p className="font-bold text-[#24344f]">{row.name}</p><p className="mt-0.5 text-[8.8px] text-[#8490a1]">{row.code ?? "—"}</p></td>
              <td className="px-3 py-3.5 font-semibold uppercase text-[#536174]">{row.type}</td>
              <td className="px-3 py-3.5 font-semibold text-[#536174]">{row.rm_name}</td>
              <td className="px-3 py-3.5"><StatusPill value={row.account_status} /></td>
              <td className="px-3 py-3.5 text-right tabular-nums text-[#536174]">{formatInteger(row.policy_count)}</td>
              <td className="px-3 py-3.5 text-right tabular-nums text-[#536174]">{formatInteger(row.customer_count)}</td>
              <td className="px-3 py-3.5 text-right font-bold tabular-nums text-[#24344f]">{formatCurrency(row.gross_premium)}</td>
              <td className="px-3 py-3.5 font-semibold text-[#536174]">{formatDate(row.last_business_date)}</td>
              <td className="px-5 py-3.5 text-center">{row.application_id ? <Link href={`/intermediaries/applications/${row.application_id}`} className="inline-grid h-8 w-8 place-items-center rounded-lg border border-[#d9e1ec] text-[#425b8f]"><ExternalLink className="h-3.5 w-3.5" /></Link> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OnboardingTable({ rows }: { rows: DistributionReport["onboarding"]["rows"] }) {
  if (!rows.length) return <EmptyRow />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1220px] border-collapse text-left">
        <thead><tr className="bg-[#f8fafc] text-[8.2px] font-black uppercase tracking-[0.07em] text-[#7c899b]"><th className="px-5 py-3">Applicant</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">RM</th><th className="px-3 py-3">Stage</th><th className="px-3 py-3 text-right">Age</th><th className="px-3 py-3">Training</th><th className="px-3 py-3">Exam</th><th className="px-3 py-3">Agreement</th><th className="px-3 py-3">IIB</th><th className="px-5 py-3 text-center">Open</th></tr></thead>
        <tbody className="divide-y divide-[#edf0f4]">
          {rows.map((row) => (
            <tr key={row.id} className="text-[10px] transition hover:bg-[#fbfcfe]">
              <td className="px-5 py-3.5"><p className="font-bold text-[#24344f]">{row.name}</p><p className="mt-0.5 text-[8.8px] text-[#8490a1]">{row.application_reference ?? "—"}</p></td>
              <td className="px-3 py-3.5 font-semibold uppercase text-[#536174]">{row.type}</td>
              <td className="px-3 py-3.5 font-semibold text-[#536174]">{row.rm_name}</td>
              <td className="px-3 py-3.5"><StagePill value={row.stage} /></td>
              <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-[#536174]">{formatInteger(row.age_days)}d</td>
              <td className="px-3 py-3.5 text-[#536174]">{labelize(row.training_status ?? "—")}</td>
              <td className="px-3 py-3.5 text-[#536174]">{labelize(row.exam_status ?? "—")}</td>
              <td className="px-3 py-3.5 text-[#536174]">{labelize(row.agreement_status ?? "—")}</td>
              <td className="px-3 py-3.5 text-[#536174]">{labelize(row.iib_registration_status ?? "—")}</td>
              <td className="px-5 py-3.5 text-center"><Link href={`/intermediaries/applications/${row.id}`} className="inline-grid h-8 w-8 place-items-center rounded-lg border border-[#d9e1ec] text-[#425b8f]"><ExternalLink className="h-3.5 w-3.5" /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const active = value === "active";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[8.5px] font-bold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{labelize(value)}</span>;
}

function StagePill({ value }: { value: string }) {
  return <span className="inline-flex rounded-full border border-[#dce3ee] bg-[#f7f9fc] px-2 py-1 text-[8.5px] font-bold text-[#4f5f78]">{value}</span>;
}

function Pagination({ page, pageCount, total, pageSize, previousHref, nextHref }: { page: number; pageCount: number; total: number; pageSize: number; previousHref: string; nextHref: string }) {
  return (
    <div className="flex flex-col gap-3 border-t border-[#e9edf3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[10px] font-semibold text-[#6f7d90]">{rangeLabel(page, pageSize, total)}</p>
      <div className="flex items-center gap-2">
        <PageLink href={previousHref} disabled={page <= 1}>Previous</PageLink>
        <span className="min-w-16 text-center text-[10px] font-bold text-[#34445f]">{page} / {pageCount}</span>
        <PageLink href={nextHref} disabled={page >= pageCount}>Next</PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  return disabled ? <span className="rounded-lg border border-[#e8ebf0] bg-[#f6f7f9] px-3 py-2 text-[9.5px] font-bold text-[#b3bbc6]">{children}</span> : <Link href={href} className="rounded-lg border border-[#d9e1ec] bg-white px-3 py-2 text-[9.5px] font-bold text-[#405476]">{children}</Link>;
}

function ErrorBanner() { return <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-[11px] font-bold text-red-700">Reporting service unavailable.</section>; }
function EmptyRow() { return <div className="px-5 py-10 text-center text-[10px] font-semibold text-[#7a8798]">No data</div>; }

function distributionHref(filters: DistributionFilters, page: number, onboardingPage: number) {
  const search = new URLSearchParams();
  search.set("period", "custom");
  if (filters.fromDate) search.set("from", filters.fromDate);
  if (filters.toDate) search.set("to", filters.toDate);
  if (filters.rmEmployeeId) search.set("rm", filters.rmEmployeeId);
  if (filters.intermediaryType) search.set("type", filters.intermediaryType);
  if (filters.accountStatus) search.set("status", filters.accountStatus);
  if (page > 1) search.set("page", String(page));
  if (onboardingPage > 1) search.set("onboardingPage", String(onboardingPage));
  return `/reports/distribution?${search.toString()}`;
}

function rangeLabel(page: number, pageSize: number, total: number) { if (!total) return "0 / 0"; const start = (page - 1) * pageSize + 1; const end = Math.min(page * pageSize, total); return `${formatInteger(start)}–${formatInteger(end)} / ${formatInteger(total)}`; }
function formatCurrency(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function formatInteger(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
function formatDate(value: string | null) { if (!value) return "—"; return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value.slice(0, 10)}T00:00:00+05:30`)); }
function labelize(value: string) { if (value === "—") return value; return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase()); }
function fallbackFilters(): DistributionFilters { return { period: "90d", fromDate: null, toDate: null, rmEmployeeId: null, intermediaryType: null, accountStatus: null, page: 1, onboardingPage: 1 }; }
function emptyReport(): DistributionReport { return { summary: { intermediary_count: 0, active_intermediary_count: 0, partner_count: 0, posp_count: 0, misp_count: 0, producing_intermediary_count: 0, policy_count: 0, customer_count: 0, gross_premium: 0, onboarding_open_count: 0 }, rms: [], intermediaries: { rows: [], total_count: 0, page: 1, page_size: 25 }, onboarding_summary: { total: 0, open: 0, compliance: 0, training: 0, exam: 0, agreement: 0, iib: 0, completed: 0, rejected: 0 }, onboarding: { rows: [], total_count: 0, page: 1, page_size: 25 }, filters: { rms: [], types: ["partner", "posp", "misp"], account_statuses: ["active", "under_onboarding", "inactive", "suspended", "terminated", "rejected"] } }; }
