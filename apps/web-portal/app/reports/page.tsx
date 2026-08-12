import Link from "next/link";
import { Download, ExternalLink, Filter, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import {
  loadPolicyBusinessReport,
  reportScopeLabel,
  type PolicyBusinessQuery,
  type PolicyBusinessReport,
} from "@/lib/reports/policy-business";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PERIODS = [
  { key: "90d", label: "Last 90 days" },
  { key: "mtd", label: "Month to date" },
  { key: "ytd", label: "Year to date" },
  { key: "all", label: "All time" },
] as const;

type PageProps = { searchParams: Promise<PolicyBusinessQuery> };

export default async function ReportsPage({ searchParams }: PageProps) {
  const profile = await requireCapability("view_reports");
  const query = await searchParams;

  let payload: Awaited<ReturnType<typeof loadPolicyBusinessReport>> | null = null;
  let loadError = false;
  try {
    payload = await loadPolicyBusinessReport(profile, query);
  } catch (error) {
    console.error("[reports] policy business report failed", error instanceof Error ? error.message : "unknown error");
    loadError = true;
  }

  const report = payload?.report ?? emptyReport();
  const filters = payload?.filters;
  const scopeLabel = reportScopeLabel(payload?.scopeMode ?? "none");
  const pageCount = Math.max(1, Math.ceil(report.register.total_count / Math.max(report.register.page_size, 1)));
  const exportHref = filters ? buildHref("/reports/export/policy-business", {
    period: "custom",
    from: filters.fromDate ?? undefined,
    to: filters.toDate ?? undefined,
    insurer: filters.insurerId ?? undefined,
    rm: filters.rmName ?? undefined,
    intermediary: filters.intermediaryCode ?? undefined,
  }) : "#";

  return (
    <AppShell title="Reports">
      <div className="mx-auto max-w-[1560px] space-y-4 pb-8">
        <header className="portal-card overflow-hidden">
          <div className="border-b border-[#e8ecf2] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#5265d8]">Business reporting</p>
                <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.025em] text-[#13203b] sm:text-[30px]">Policy production & portfolio</h1>
                <p className="mt-2 max-w-3xl text-[11px] leading-5 text-[#66758a] sm:text-[12px]">
                  Live policy production, premium composition and ownership performance. Every figure is calculated from the policy register inside your authorised business scope.
                </p>
              </div>
              <div className="grid min-w-[280px] grid-cols-2 gap-2 text-[10px] sm:min-w-[360px]">
                <HeaderFact label="Data scope" value={scopeLabel} />
                <HeaderFact label="As of" value={asOfLabel()} />
              </div>
            </div>
          </div>

          <div className="px-5 py-4 sm:px-6">
            <div className="flex flex-wrap gap-2">
              {PERIODS.map((period) => (
                <Link
                  key={period.key}
                  href={`/reports?period=${period.key}`}
                  className={`rounded-lg border px-3 py-2 text-[10px] font-bold transition ${filters?.period === period.key ? "border-[#223a78] bg-[#223a78] text-white" : "border-[#dfe5ee] bg-white text-[#506077] hover:border-[#bfc9db] hover:text-[#23365f]"}`}
                >
                  {period.label}
                </Link>
              ))}
            </div>

            <form action="/reports" method="get" className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[150px_150px_minmax(180px,1fr)_minmax(170px,1fr)_minmax(190px,1fr)_auto_auto]">
              <input type="hidden" name="period" value="custom" />
              <FilterField label="From">
                <input name="from" type="date" defaultValue={filters?.fromDate ?? ""} className={inputClass} />
              </FilterField>
              <FilterField label="To">
                <input name="to" type="date" defaultValue={filters?.toDate ?? ""} className={inputClass} />
              </FilterField>
              <FilterField label="Insurance company">
                <select name="insurer" defaultValue={filters?.insurerId ?? ""} className={inputClass}>
                  <option value="">All insurers</option>
                  {report.filters.insurers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </FilterField>
              <FilterField label="Relationship manager">
                <select name="rm" defaultValue={filters?.rmName ?? ""} className={inputClass}>
                  <option value="">All RMs</option>
                  {report.filters.rms.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </FilterField>
              <FilterField label="Partner / intermediary">
                <select name="intermediary" defaultValue={filters?.intermediaryCode ?? ""} className={inputClass}>
                  <option value="">All intermediaries</option>
                  {report.filters.intermediaries.map((item) => (
                    <option key={item.code} value={item.code}>{item.name}{item.name !== item.code ? ` · ${item.code}` : ""}</option>
                  ))}
                </select>
              </FilterField>
              <button type="submit" className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#172a5c] px-4 text-[10.5px] font-bold text-white transition hover:bg-[#213a78]">
                <Filter className="h-3.5 w-3.5" /> Apply
              </button>
              <Link href="/reports" className="mt-auto inline-flex h-10 items-center justify-center rounded-lg border border-[#dfe5ee] bg-white px-4 text-[10.5px] font-bold text-[#526174] transition hover:border-[#c8d1df] hover:bg-[#f8fafc]">
                Reset
              </Link>
            </form>
          </div>
        </header>

        {loadError ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <p className="text-[12px] font-bold text-red-700">The reporting service is temporarily unavailable.</p>
            <p className="mt-1 text-[10.5px] text-red-600/80">No figures are being estimated or substituted. Refresh the page after a moment.</p>
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Policy business summary">
          <Metric label="Policies" value={formatInteger(report.summary.policy_count)} detail={`${formatInteger(report.summary.active_policy_count)} active`} />
          <Metric label="Gross premium" value={formatCurrency(report.summary.gross_premium)} detail={`${formatInteger(report.summary.insurer_count)} insurers`} />
          <Metric label="Net premium" value={formatCurrency(report.summary.net_premium)} detail="Before GST / tax" />
          <Metric label="Average premium" value={formatCurrency(report.summary.average_premium)} detail="Per policy" />
          <Metric label="Intermediaries" value={formatInteger(report.summary.intermediary_count)} detail="Contributing to selected business" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
          <article className="portal-card p-5 sm:p-6">
            <SectionHeading title="Premium production trend" description="Gross written premium by business month for the selected period." />
            <PremiumTrend rows={report.trend} />
          </article>
          <article className="portal-card p-5 sm:p-6">
            <SectionHeading title="Premium composition" description="Core premium components from structured policy premium details." />
            <PremiumComposition report={report} />
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="portal-card overflow-hidden">
            <div className="border-b border-[#e9edf3] px-5 py-4">
              <SectionHeading title="Insurance company contribution" description="Policy volume and gross premium share by insurer." />
            </div>
            <InsurerTable rows={report.insurers} />
          </article>
          <article className="portal-card overflow-hidden">
            <div className="border-b border-[#e9edf3] px-5 py-4">
              <SectionHeading title="RM production" description="Business contribution by relationship manager within the authorised scope." />
            </div>
            <RmTable rows={report.rms} />
          </article>
        </section>

        <section className="portal-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[#e9edf3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SectionHeading title="Policy business register" description={`${formatInteger(report.register.total_count)} policies match the selected filters.`} />
            </div>
            <a
              href={exportHref}
              aria-disabled={loadError}
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-[10px] font-bold ${loadError ? "pointer-events-none border-[#e5e8ee] bg-[#f5f6f8] text-[#a3adbb]" : "border-[#cad4e4] bg-white text-[#263b69] transition hover:border-[#9eacc3] hover:bg-[#f8fafc]"}`}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </a>
          </div>

          <PolicyRegister rows={report.register.rows} />

          <div className="flex flex-col gap-3 border-t border-[#e9edf3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-semibold text-[#6f7d90]">
              {registerRange(report.register.page, report.register.page_size, report.register.total_count)}
            </p>
            <div className="flex items-center gap-2">
              <PaginationLink disabled={report.register.page <= 1} href={filters ? pageHref(filters, report.register.page - 1) : "#"}>Previous</PaginationLink>
              <span className="min-w-16 text-center text-[10px] font-bold text-[#34445f]">{report.register.page} / {pageCount}</span>
              <PaginationLink disabled={report.register.page >= pageCount} href={filters ? pageHref(filters, report.register.page + 1) : "#"}>Next</PaginationLink>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-[#dfe5ee] bg-white px-3 text-[10.5px] font-semibold text-[#26364f] outline-none transition focus:border-[#7788bd] focus:ring-2 focus:ring-[#dfe5ff]";

function HeaderFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#e3e8ef] bg-[#f8fafc] px-3 py-2.5"><p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#8995a6]">{label}</p><p className="mt-1 truncate text-[10.5px] font-bold text-[#2d3e5b]">{value}</p></div>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[8.5px] font-black uppercase tracking-[0.08em] text-[#7b8799]">{label}</span>{children}</label>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="portal-card px-4 py-4 sm:px-5">
      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#7c899b]">{label}</p>
      <p className="mt-2 text-[23px] font-semibold tracking-[-0.03em] text-[#14213c]">{value}</p>
      <p className="mt-2 border-t border-[#edf0f4] pt-2 text-[9.5px] font-medium text-[#78869a]">{detail}</p>
    </article>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div><h2 className="text-[14px] font-bold text-[#1b2943]">{title}</h2><p className="mt-1 text-[9.8px] leading-4 text-[#7a8798]">{description}</p></div>;
}

function PremiumTrend({ rows }: { rows: PolicyBusinessReport["trend"] }) {
  if (!rows.length) return <EmptyBlock text="No policy production falls inside the selected period." />;
  const max = Math.max(...rows.map((row) => row.gross_premium), 1);
  return (
    <div className="mt-5 space-y-3">
      {rows.map((row) => (
        <div key={row.month} className="grid grid-cols-[78px_minmax(0,1fr)_100px] items-center gap-3">
          <div><p className="text-[10px] font-bold text-[#35445d]">{formatMonth(row.month)}</p><p className="text-[8.5px] text-[#8a96a7]">{formatInteger(row.policy_count)} policies</p></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#edf1f6]"><div className="h-full rounded-full bg-[#3559a8]" style={{ width: `${Math.max((row.gross_premium / max) * 100, 2)}%` }} /></div>
          <p className="text-right text-[10px] font-bold tabular-nums text-[#23334f]">{formatCurrency(row.gross_premium)}</p>
        </div>
      ))}
    </div>
  );
}

function PremiumComposition({ report }: { report: PolicyBusinessReport }) {
  const total = report.summary.net_premium || 1;
  const rows = [
    { label: "Own damage", value: report.summary.od_premium },
    { label: "Third party", value: report.summary.tp_premium },
    { label: "CPA", value: report.summary.cpa_amount },
  ];
  return (
    <div className="mt-5 space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-end justify-between gap-3"><p className="text-[10.5px] font-semibold text-[#536174]">{row.label}</p><p className="text-[13px] font-bold tabular-nums text-[#21324f]">{formatCurrency(row.value)}</p></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf1f6]"><div className="h-full rounded-full bg-[#516dab]" style={{ width: `${Math.min((row.value / total) * 100, 100)}%` }} /></div>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2 border-t border-[#e9edf3] pt-4">
        <HeaderFact label="Net premium" value={formatCurrency(report.summary.net_premium)} />
        <HeaderFact label="Gross premium" value={formatCurrency(report.summary.gross_premium)} />
      </div>
    </div>
  );
}

function InsurerTable({ rows }: { rows: PolicyBusinessReport["insurers"] }) {
  if (!rows.length) return <EmptyBlock text="No insurer contribution is available for the selected period." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead><tr className="bg-[#f8fafc] text-[8.5px] font-black uppercase tracking-[0.08em] text-[#7c899b]"><th className="px-5 py-3">Insurance company</th><th className="px-3 py-3 text-right">Policies</th><th className="px-3 py-3 text-right">Gross premium</th><th className="px-5 py-3 text-right">Share</th></tr></thead>
        <tbody className="divide-y divide-[#edf0f4]">
          {rows.map((row) => <tr key={row.id} className="text-[10.5px]"><td className="px-5 py-3.5 font-semibold text-[#283851]">{row.name}</td><td className="px-3 py-3.5 text-right font-semibold tabular-nums text-[#536174]">{formatInteger(row.policy_count)}</td><td className="px-3 py-3.5 text-right font-bold tabular-nums text-[#283851]">{formatCurrency(row.gross_premium)}</td><td className="px-5 py-3.5 text-right font-semibold tabular-nums text-[#536174]">{formatPercent(row.share_percent)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function RmTable({ rows }: { rows: PolicyBusinessReport["rms"] }) {
  if (!rows.length) return <EmptyBlock text="No RM-attributed business is available for the selected period." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead><tr className="bg-[#f8fafc] text-[8.5px] font-black uppercase tracking-[0.08em] text-[#7c899b]"><th className="px-5 py-3">Relationship manager</th><th className="px-3 py-3 text-right">Policies</th><th className="px-3 py-3 text-right">Partners</th><th className="px-5 py-3 text-right">Gross premium</th></tr></thead>
        <tbody className="divide-y divide-[#edf0f4]">
          {rows.map((row) => <tr key={row.name} className="text-[10.5px]"><td className="px-5 py-3.5 font-semibold text-[#283851]">{row.name}</td><td className="px-3 py-3.5 text-right font-semibold tabular-nums text-[#536174]">{formatInteger(row.policy_count)}</td><td className="px-3 py-3.5 text-right font-semibold tabular-nums text-[#536174]">{formatInteger(row.intermediary_count)}</td><td className="px-5 py-3.5 text-right font-bold tabular-nums text-[#283851]">{formatCurrency(row.gross_premium)}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function PolicyRegister({ rows }: { rows: PolicyBusinessReport["register"]["rows"] }) {
  if (!rows.length) return <EmptyBlock text="No policy records match the selected filters." />;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <thead><tr className="bg-[#f8fafc] text-[8.2px] font-black uppercase tracking-[0.07em] text-[#7c899b]"><th className="px-5 py-3">Business date</th><th className="px-3 py-3">Policy</th><th className="px-3 py-3">Customer / vehicle</th><th className="px-3 py-3">Insurer</th><th className="px-3 py-3">RM / intermediary</th><th className="px-3 py-3 text-right">OD</th><th className="px-3 py-3 text-right">TP</th><th className="px-3 py-3 text-right">Gross</th><th className="px-5 py-3 text-center">Open</th></tr></thead>
          <tbody className="divide-y divide-[#edf0f4]">
            {rows.map((row) => (
              <tr key={row.id} className="text-[10px] transition hover:bg-[#fbfcfe]">
                <td className="px-5 py-3.5 font-semibold text-[#4b5a70]">{formatDate(row.business_date)}</td>
                <td className="px-3 py-3.5"><p className="font-bold text-[#24344f]">{row.policy_no}</p><p className="mt-0.5 text-[8.8px] text-[#8490a1]">{row.policy_type} · {row.status}</p></td>
                <td className="px-3 py-3.5"><p className="max-w-[200px] truncate font-semibold text-[#34445d]" title={row.customer_name}>{row.customer_name}</p><p className="mt-0.5 text-[8.8px] text-[#8490a1]">{row.vehicle_no}</p></td>
                <td className="px-3 py-3.5"><p className="max-w-[190px] truncate font-semibold text-[#4b5a70]" title={row.insurer_name}>{row.insurer_name}</p></td>
                <td className="px-3 py-3.5"><p className="font-semibold text-[#4b5a70]">{row.rm_name ?? "Unassigned"}</p><p className="mt-0.5 text-[8.8px] text-[#8490a1]">{row.intermediary_code ?? "—"}</p></td>
                <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-[#536174]">{formatCurrency(row.od_premium)}</td>
                <td className="px-3 py-3.5 text-right font-semibold tabular-nums text-[#536174]">{formatCurrency(row.tp_premium)}</td>
                <td className="px-3 py-3.5 text-right font-bold tabular-nums text-[#24344f]">{formatCurrency(row.gross_premium)}</td>
                <td className="px-5 py-3.5 text-center"><Link href={`/policies/${row.id}`} aria-label={`Open policy ${row.policy_no}`} className="inline-grid h-8 w-8 place-items-center rounded-lg border border-[#d9e1ec] text-[#425b8f] transition hover:border-[#aebbd0] hover:bg-[#f5f8fc]"><ExternalLink className="h-3.5 w-3.5" /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-[#edf0f4] md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold text-[#24344f]">{row.policy_no}</p><p className="mt-1 text-[9px] text-[#8490a1]">{formatDate(row.business_date)} · {row.vehicle_no}</p></div><Link href={`/policies/${row.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d9e1ec] px-2.5 text-[9.5px] font-bold text-[#425b8f]">Open <ExternalLink className="h-3 w-3" /></Link></div>
            <p className="mt-3 text-[10px] font-semibold text-[#40506a]">{row.customer_name}</p><p className="mt-1 text-[9px] text-[#758398]">{row.insurer_name}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#f8fafc] p-3 text-center"><MiniAmount label="OD" value={row.od_premium} /><MiniAmount label="TP" value={row.tp_premium} /><MiniAmount label="Gross" value={row.gross_premium} /></div>
          </article>
        ))}
      </div>
    </>
  );
}

function MiniAmount({ label, value }: { label: string; value: number }) { return <div><p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8a96a7]">{label}</p><p className="mt-1 text-[10px] font-bold text-[#293a56]">{formatCurrency(value)}</p></div>; }
function EmptyBlock({ text }: { text: string }) { return <div className="px-5 py-10 text-center"><RefreshCw className="mx-auto h-5 w-5 text-[#a7b0bd]" /><p className="mt-2 text-[10px] font-semibold text-[#7a8798]">{text}</p></div>; }
function PaginationLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) { return disabled ? <span className="rounded-lg border border-[#e8ebf0] bg-[#f6f7f9] px-3 py-2 text-[9.5px] font-bold text-[#b3bbc6]">{children}</span> : <Link href={href} className="rounded-lg border border-[#d9e1ec] bg-white px-3 py-2 text-[9.5px] font-bold text-[#405476] transition hover:border-[#b7c1d0] hover:bg-[#f8fafc]">{children}</Link>; }

function pageHref(filters: NonNullable<Awaited<ReturnType<typeof loadPolicyBusinessReport>>["filters"]>, page: number) {
  return buildHref("/reports", { period: "custom", from: filters.fromDate ?? undefined, to: filters.toDate ?? undefined, insurer: filters.insurerId ?? undefined, rm: filters.rmName ?? undefined, intermediary: filters.intermediaryCode ?? undefined, page: String(Math.max(page, 1)) });
}
function buildHref(path: string, params: Record<string, string | undefined>) { const search = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (value) search.set(key, value); }); const suffix = search.toString(); return suffix ? `${path}?${suffix}` : path; }
function registerRange(page: number, pageSize: number, total: number) { if (!total) return "Showing 0 of 0"; const start = (page - 1) * pageSize + 1; const end = Math.min(page * pageSize, total); return `Showing ${formatInteger(start)}–${formatInteger(end)} of ${formatInteger(total)}`; }
function formatCurrency(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function formatInteger(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
function formatPercent(value: number) { return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value || 0)}%`; }
function formatDate(value: string) { if (!value) return "—"; return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`)); }
function formatMonth(value: string) { if (!value) return "—"; return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`)); }
function asOfLabel() { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date()); }
function emptyReport(): PolicyBusinessReport { return { summary: { policy_count: 0, active_policy_count: 0, gross_premium: 0, net_premium: 0, od_premium: 0, tp_premium: 0, cpa_amount: 0, average_premium: 0, insurer_count: 0, intermediary_count: 0 }, trend: [], insurers: [], rms: [], filters: { insurers: [], rms: [], intermediaries: [] }, register: { rows: [], total_count: 0, page: 1, page_size: 25 } }; }
