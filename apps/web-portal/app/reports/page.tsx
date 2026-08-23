import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ArrowRight, CalendarRange, FileDown } from "lucide-react";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { loadManagementPack } from "@/lib/reports/management-pack";
import { loadPolicyBusinessReport, reportScopeLabel } from "@/lib/reports/policy-business";

type Query = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Query> };

const BUSINESS_QUERY_KEYS = ["period", "from", "to", "insurer", "rm", "intermediary", "page"];

export default async function ReportsOverviewPage({ searchParams }: Props) {
  const profile = await requireCapability("view_reports");
  if (!profile) return null;
  const query = await searchParams;
  const commercialAccess = canAccessPolicyCommercials(profile);

  if (BUSINESS_QUERY_KEYS.some((key) => query[key] !== undefined)) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
      else if (typeof value === "string") params.set(key, value);
    }
    redirect(`/reports/business${params.size ? `?${params.toString()}` : ""}`);
  }

  let loadError = false;
  let pack: Awaited<ReturnType<typeof loadManagementPack>> | null = null;
  let ytdBusiness: Awaited<ReturnType<typeof loadPolicyBusinessReport>>["report"] | null = null;

  try {
    const [managementPack, businessPayload] = await Promise.all([
      loadManagementPack(profile, {}),
      loadPolicyBusinessReport(profile, { period: "ytd", page: "1" }),
    ]);
    pack = managementPack;
    ytdBusiness = businessPayload.report;
  } catch (error) {
    loadError = true;
    console.error("Reports overview load failed", error);
  }

  const monthLabel = pack ? formatMonth(pack.filters.month) : "Current month";
  const scopeLabel = pack ? reportScopeLabel(pack.scopeMode) : "Accessible portfolio";
  const trend = (ytdBusiness?.trend ?? []).slice(-6);
  const maxTrendPremium = Math.max(...trend.map((row) => row.gross_premium), 1);
  const topInsurers = (ytdBusiness?.insurers ?? []).slice(0, 5);
  const renewals = (pack?.renewals.register.rows ?? []).filter((row) => row.days_to_expiry >= 0).slice(0, 5);

  return (
    <AppShell title="Reports">
      <div className="reports-v2-page report-page-shell mx-auto max-w-[1560px] space-y-4 pb-8">
        <section className="r2-panel r2-header">
          <div className="r2-header__top">
            <div>
              <h1 className="r2-title">Reports</h1>
              <div className="r2-meta mt-2">
                <span>{monthLabel} · month to date</span>
                <span>•</span>
                <span>{scopeLabel}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/reports/management-pack/archive" className="r2-action"><Archive className="h-3.5 w-3.5" /> Archive</Link>
              <Link href={pack ? `/reports/export/management-pack?month=${pack.filters.month}` : "/reports/management-pack"} className="r2-action"><FileDown className="h-3.5 w-3.5" /> Export</Link>
              <Link href="/reports/management-pack" className="r2-action r2-action--primary"><CalendarRange className="h-3.5 w-3.5" /> Month End</Link>
            </div>
          </div>
        </section>

        {loadError || !pack ? (
          <section className="r2-panel px-5 py-8 text-center text-[11px] font-semibold text-[#b42318]">Reporting service unavailable</section>
        ) : (
          <>
            <section className="r2-panel r2-kpis" aria-label="Broker performance summary">
              <Kpi label="Gross Premium" value={money(pack.business.summary.gross_premium)} note="Month to date" />
              <Kpi label="Policies" value={number(pack.business.summary.policy_count)} note="Month to date" />
              <Kpi label={commercialAccess ? "Projected PayIn" : "Commercials"} value={commercialAccess ? money(pack.finance.summary.projected_payin) : "Restricted"} note={commercialAccess ? "Expectation only" : "Authorized users only"} />
              <Kpi label="Open Claims" value={number(pack.claims.summary.open_claim_count)} note="Current open book" />
              <Kpi label="Renewals · 30 Days" value={number(pack.renewals.summary.due_30_count)} note={money(pack.renewals.summary.premium_due_30)} />
            </section>

            {commercialAccess ? (
              <section className="r2-panel px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><h2 className="text-[13px] font-semibold text-[#17365D]">Commercial & Reconciliation Foundation</h2><p className="mt-1 text-[9.5px] text-[#667085]">Projected insurer pay-in and agreed partner payout are now separate from real billing. Reconciliation will compare insurer-reported actuals against these projections.</p></div>
                  <div className="flex flex-wrap gap-2"><Link href="/policies/commercial-review" className="r2-action">Commercial Review</Link><Link href="/reports/finance" className="r2-action r2-action--primary">Commercial Report</Link></div>
                </div>
              </section>
            ) : null}

            <section className="r2-main-grid">
              <article className="r2-panel overflow-hidden">
                <div className="r2-section-head"><h2>Premium & Policy Trend</h2><Link href="/reports/business" className="r2-section-link">Business <ArrowRight className="ml-1 inline h-3 w-3" /></Link></div>
                <div className="r2-trend">
                  {trend.length ? trend.map((row) => (
                    <div key={row.month} className="r2-trend-row">
                      <span className="r2-trend-month">{shortMonth(row.month)}</span>
                      <span className="r2-trend-track"><span className="r2-trend-bar block" style={{ width: `${Math.max(2, (row.gross_premium / maxTrendPremium) * 100)}%` }} /></span>
                      <span className="r2-trend-value">{compactMoney(row.gross_premium)}</span>
                      <span className="r2-trend-count">{number(row.policy_count)}</span>
                    </div>
                  )) : <div className="r2-empty">No year-to-date business trend available</div>}
                </div>
              </article>

              <article className="r2-panel overflow-hidden">
                <div className="r2-section-head"><h2>Attention</h2><Link href="/reports/readiness" className="r2-section-link">Data Quality <ArrowRight className="ml-1 inline h-3 w-3" /></Link></div>
                <div className="r2-attention-list">
                  <Attention label="Renewals due within 30 days" value={pack.renewals.summary.due_30_count} tone="warn" />
                  {commercialAccess ? <Attention label="Pending partner payout" value={pack.finance.summary.pending_payout_count} tone="warn" /> : null}
                  <Attention label="Expired compliance documents" value={pack.operations.summary.expired_document_count} tone="danger" />
                  <Attention label="Missing compliance fields" value={pack.operations.summary.missing_compliance_fields} tone="danger" />
                  <Attention label="Open intermediary onboarding" value={pack.distribution.summary.onboarding_open_count} />
                </div>
              </article>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <article className="r2-panel overflow-hidden">
                <div className="r2-section-head"><h2>Insurer Business · YTD</h2><Link href="/reports/business" className="r2-section-link">View business</Link></div>
                {topInsurers.length ? (
                  <div className="r2-table-wrap"><table className="r2-table"><thead><tr><th>Insurer</th><th className="r2-num">Policies</th><th className="r2-num">Premium</th><th className="r2-num">Share</th></tr></thead><tbody>
                    {topInsurers.map((row) => <tr key={`${row.id}-${row.name}`}><td><strong>{row.name || "Unassigned"}</strong></td><td className="r2-num">{number(row.policy_count)}</td><td className="r2-num">{compactMoney(row.gross_premium)}</td><td className="r2-num">{row.share_percent.toFixed(1)}%</td></tr>)}
                  </tbody></table></div>
                ) : <div className="r2-empty">No insurer business available</div>}
              </article>

              <article className="r2-panel overflow-hidden">
                <div className="r2-section-head"><h2>Upcoming Renewals</h2><Link href="/reports/renewals" className="r2-section-link">View portfolio</Link></div>
                {renewals.length ? (
                  <div className="r2-table-wrap"><table className="r2-table"><thead><tr><th>Customer</th><th>Vehicle</th><th>Insurer</th><th className="r2-num">Days</th><th className="r2-num">Premium</th></tr></thead><tbody>
                    {renewals.map((row) => <tr key={row.id}><td><strong>{row.customer_name}</strong></td><td>{row.vehicle_no || "—"}</td><td>{row.insurer_name || "—"}</td><td className="r2-num">{number(row.days_to_expiry)}</td><td className="r2-num">{compactMoney(row.gross_premium)}</td></tr>)}
                  </tbody></table></div>
                ) : <div className="r2-empty">No upcoming renewals in the current horizon</div>}
              </article>
            </section>

            <section className="r2-panel overflow-hidden">
              <div className="r2-section-head"><h2>Broker Position</h2></div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5">
                <Position label="Producing Intermediaries" value={pack.distribution.summary.producing_intermediary_count} href="/reports/distribution" />
                {commercialAccess ? <Position label="Projected PayIn" value={money(pack.finance.summary.projected_payin)} href="/reports/finance" /> : <Position label="Commercials" value="Restricted" href="/reports" />}
                {commercialAccess ? <Position label="Partner Payout" value={money(pack.finance.summary.gross_payout)} href="/reports/finance" /> : <Position label="Commercial access" value="Restricted" href="/reports" />}
                <Position label="Claims Estimated Loss" value={money(pack.claims.summary.estimated_loss)} href="/reports/claims" />
                <Position label="Premium at Renewal Risk" value={money(pack.renewals.summary.premium_at_risk)} href="/reports/renewals" />
              </div>
              <div className="r2-month-end">
                <div className="r2-month-end__copy"><strong>Month-end reporting</strong><span>Review the live pack, freeze the eligible month, or open a previous frozen snapshot.</span></div>
                <div className="flex flex-wrap gap-2"><Link href="/reports/management-pack" className="r2-action">Management Pack</Link><Link href="/reports/management-pack/archive" className="r2-action">Frozen Packs</Link></div>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="r2-kpi"><div className="r2-kpi__label">{label}</div><div className="r2-kpi__value">{value}</div><div className="r2-kpi__note">{note}</div></div>;
}

function Attention({ label, value, tone }: { label: string; value: number; tone?: "warn" | "danger" }) {
  return <div className={`r2-attention-row ${tone ? `r2-attention-row--${tone}` : ""}`}><span className="r2-attention-label">{label}</span><span className="r2-attention-value">{number(value)}</span></div>;
}

function Position({ label, value, href }: { label: string; value: string | number; href: string }) {
  return <Link href={href} className="group border-b border-r border-[#e8ecf1] px-4 py-4 transition hover:bg-[#fafbfd]"><div className="text-[9.5px] font-semibold text-[#667085]">{label}</div><div className="mt-2 flex items-center justify-between gap-2 text-[14px] font-bold tabular-nums text-[#26364f]"><span>{value}</span><ArrowRight className="h-3.5 w-3.5 text-[#98a2b3] transition group-hover:translate-x-0.5" /></div></Link>;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function compactMoney(value: number) {
  const absolute = Math.abs(value || 0);
  if (absolute >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (absolute >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  if (absolute >= 1_000) return `₹${(value / 1_000).toFixed(1)} K`;
  return money(value);
}

function number(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
function formatMonth(value: string) { const [year, month] = value.split("-").map(Number); return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(Date.UTC(year, month - 1, 1))); }
function shortMonth(value: string) { const date = /^\d{4}-\d{2}/.test(value) ? new Date(`${value.slice(0, 7)}-01T00:00:00Z`) : null; return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(date) : value; }
