import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Clock3,
  Download,
  Info,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { getInsurerLogo } from "@/lib/insurer-logo";
import { requireCapability } from "@/lib/master-data-server";
import { ReportOverviewPeriodControl } from "@/components/reports/report-overview-period-control";
import { ReportOverviewBusinessControl, ReportOverviewBusinessTrend, type OverviewBusinessScope, type OverviewTrendPeriod, type OverviewTrendPoint } from "@/components/reports/report-overview-business-controls";
import { loadManagementPack, resolveManagementPackFilters, type ManagementPackPeriod } from "@/lib/reports/management-pack";
import { loadPolicyBusinessNetReport } from "@/lib/reports/policy-business";

type Query = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Query> };

export default async function ReportsOverviewPage({ searchParams }: Props) {
  const profile = await requireCapability("view_reports");
  if (!profile) return null;

  const query = await searchParams;
  const requestedPeriod = periodValue(single(query.period));
  const requestedFrom = single(query.from);
  const requestedTo = single(query.to);
  const businessScope = businessScopeValue(single(query.business_scope));
  const businessFilter = businessScopeFilter(businessScope);
  const trendPeriod = trendPeriodValue(single(query.trend_period));
  const trendRange = resolveTrendRange(trendPeriod);
  const overviewQuery = { period: requestedPeriod, from: requestedFrom, to: requestedTo, ...businessFilter };
  const overviewFilters = resolveManagementPackFilters(overviewQuery);

  const commercialAccess = canAccessPolicyCommercials(profile);
  let loadError = false;
  let pack: Awaited<ReturnType<typeof loadManagementPack>> | null = null;
  let overviewBusiness: Awaited<ReturnType<typeof loadPolicyBusinessNetReport>>["report"] | null = null;
  let trendBusiness: Awaited<ReturnType<typeof loadPolicyBusinessNetReport>>["report"] | null = null;

  try {
    const [managementPack, businessPayload, trendPayload] = await Promise.all([
      loadManagementPack(profile, overviewQuery),
      loadPolicyBusinessNetReport(profile, {
        period: "custom",
        from: overviewFilters.fromDate,
        to: overviewFilters.toDate,
        ...businessFilter,
        page: "1",
      }),
      loadPolicyBusinessNetReport(profile, {
        period: "custom",
        from: trendRange.from,
        to: trendRange.to,
        ...businessFilter,
        page: "1",
        pageSize: "5000",
      }),
    ]);
    pack = managementPack;
    overviewBusiness = businessPayload.report;
    trendBusiness = trendPayload.report;
  } catch (error) {
    loadError = true;
    console.error("Reports overview load failed", error);
  }

  const overviewTrend = overviewBusiness?.trend ?? [];
  const trendPoints = trendBusiness ? buildOverviewTrendPoints(trendBusiness, trendPeriod, trendRange.from, trendRange.to) : [];
  const topInsurers = (overviewBusiness?.insurers ?? []).slice(0, 5);
  const recentRecords = (overviewBusiness?.register.rows ?? []).slice(0, 5);
  const premiumDelta = trendDelta(overviewTrend.map((row) => row.net_premium));
  const policyDelta = trendDelta(overviewTrend.map((row) => row.policy_count));
  const riskByInsurer = pack ? buildRiskByInsurer(pack.renewals.insurers, pack.claims.insurers) : [];

  return (
    <AppShell title="Reports">
      <style>{`.reports-nav-shell{display:none!important}`}</style>
      <div className="reports-v2-page reports-overview-reference report-page-shell mx-auto max-w-[1560px] pb-8">
        <header className="ov-topbar">
          <div className="ov-heading">
            <h1>Reports</h1>
            <span>Updated {indiaTime()}</span>
          </div>
          <div className="ov-toolbar">
            <ReportOverviewPeriodControl period={overviewFilters.period} fromDate={overviewFilters.fromDate} toDate={overviewFilters.toDate} />
            <ReportOverviewBusinessControl value={businessScope} />
            <Link prefetch={false} href={pack ? `/reports/export/management-pack?month=${pack.filters.month}` : "/reports"} className="ov-control ov-control--primary"><Download className="h-3.5 w-3.5" /><span>Export</span></Link>
          </div>
        </header>

        <nav className="ov-tabs" aria-label="Report workspaces">
          <Link prefetch={false} href="/reports" className="ov-tab ov-tab--active">Overview</Link>
          <Link prefetch={false} href="/reports/business" className="ov-tab">Business</Link>
          <Link prefetch={false} href="/reports/renewals" className="ov-tab">Portfolio</Link>
          <Link prefetch={false} href="/reports/operations" className="ov-tab">Operations</Link>
        </nav>

        {loadError || !pack ? (
          <section className="ov-card px-5 py-10 text-center text-[11px] font-semibold text-[#b42318]">Reporting service unavailable</section>
        ) : (
          <>
            <section className="ov-card ov-kpis" aria-label="Overview key performance indicators">
              <Kpi label="Net Premium" value={compactMoney(pack.business.summary.net_premium)} delta={premiumDelta} />
              <Kpi label="Policies" value={number(pack.business.summary.policy_count)} delta={policyDelta} />
              <Kpi label={commercialAccess ? "PayIn" : "Commercials"} value={commercialAccess ? compactMoney(pack.finance.summary.payin_after_tds) : "Restricted"} note={commercialAccess ? "Less TDS" : "Authorized users only"} />
              <Kpi label="Payout" value={commercialAccess ? compactMoney(pack.finance.summary.gross_payout) : "Restricted"} note={commercialAccess ? "Month to date" : "Authorized users only"} />
              <Kpi label="Open Claims" value={number(pack.claims.summary.open_claim_count)} note={`${number(pack.claims.summary.claims_with_pending_documents)} documents pending`} noteTone={pack.claims.summary.claims_with_pending_documents > 0 ? "danger" : undefined} />
              <Kpi label="Renewals 30d" value={number(pack.renewals.summary.due_30_count)} note={`${compactMoney(pack.renewals.summary.premium_due_30)} premium at risk`} />
            </section>

            <section className="ov-grid ov-grid--top">
              <ReportOverviewBusinessTrend period={trendPeriod} points={trendPoints} />

              <article className="ov-card ov-section">
                <div className="ov-section-head">
                  <h2>Attention</h2>
                  <Link prefetch={false} href="/reports/readiness" className="ov-view-link">View all <ArrowRight className="h-3 w-3" /></Link>
                </div>
                <div className="ov-attention">
                  <AttentionItem icon="danger" value={pack.renewals.summary.due_30_count} title="Renewals due" detail={`${compactMoney(pack.renewals.summary.premium_due_30)} premium at risk · Next 30 days`} href="/reports/renewals" />
                  <AttentionItem icon="clock" value={pack.claims.summary.claims_with_pending_documents} title="Claim documents pending" detail={`Across open claims · Avg age ${number(pack.claims.summary.average_open_age_days)} days`} href="/reports/claims" />
                  <AttentionItem icon="warn" value={commercialAccess ? (pack.finance.summary.missing_payin_count ?? 0) : 0} title="Missing PayIn" detail={commercialAccess ? "Policies issued but PayIn not recorded" : "Commercial access restricted"} href={commercialAccess ? "/reports/finance" : "/reports"} />
                  <AttentionItem icon="danger" value={pack.operations.summary.expired_document_count + pack.operations.summary.missing_compliance_fields} title="Compliance exceptions" detail="KYC / documents / underwriting" href="/reports/operations" />
                </div>
              </article>
            </section>

            <section className="ov-grid ov-grid--bottom">
              <article className="ov-card ov-section">
                <div className="ov-section-head">
                  <h2>Business Mix</h2>
                  <button type="button" className="ov-mini-select">By Insurer <ChevronDown className="h-3 w-3" /></button>
                </div>
                <BusinessMix insurers={topInsurers} />
              </article>

              <article className="ov-card ov-section">
                <div className="ov-section-head">
                  <h2>Portfolio Risk</h2>
                  <button type="button" className="ov-mini-select">By Insurer <ChevronDown className="h-3 w-3" /></button>
                </div>
                <PortfolioRisk rows={riskByInsurer} />
              </article>
            </section>

            <section className="ov-card ov-section ov-recent">
              <div className="ov-section-head">
                <h2>Recent / filtered records</h2>
                <Link prefetch={false} href="/reports/business" className="ov-view-link">View all <ArrowRight className="h-3 w-3" /></Link>
              </div>
              {recentRecords.length ? (
                <div className="ov-table-wrap">
                  <table className="ov-table">
                    <thead><tr><th>Customer</th><th>Policy</th><th>Insurer</th><th>Status</th><th className="ov-num">Premium (₹)</th><th aria-label="Open" /></tr></thead>
                    <tbody>
                      {recentRecords.map((row) => {
                        const logo = getInsurerLogo(row.insurer_name);
                        return (
                          <tr key={row.id}>
                            <td><strong>{row.customer_name || "—"}</strong></td>
                            <td>{row.policy_no || "—"}</td>
                            <td>
                              <span className="ov-insurer-cell">
                                {logo ? <Image src={logo} alt="" width={18} height={18} className="ov-insurer-logo" /> : null}
                                {row.insurer_name || "—"}
                              </span>
                            </td>
                            <td><span className={statusClass(row.status)}>{friendlyStatus(row.status)}</span></td>
                            <td className="ov-num">{money(row.net_premium)}</td>
                            <td className="ov-arrow-cell"><Link prefetch={false} href={`/policies/${row.id}`} aria-label={`Open policy ${row.policy_no}`}><ArrowRight className="h-3.5 w-3.5" /></Link></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <div className="r2-empty">No recent policy records available</div>}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, delta, note, noteTone }: { label: string; value: string; delta?: number | null; note?: string; noteTone?: "danger" }) {
  return (
    <div className="ov-kpi">
      <div className="ov-kpi-label">{label}<Info className="h-3 w-3" /></div>
      <div className="ov-kpi-value">{value}</div>
      {delta != null ? (
        <div className={`ov-kpi-note ${delta >= 0 ? "ov-positive" : "ov-negative"}`}><span>{delta >= 0 ? "▲" : "▼"} {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%</span><span className="ov-note-muted">vs. last month</span></div>
      ) : (
        <div className={`ov-kpi-note ${noteTone === "danger" ? "ov-negative" : ""}`}>{note || "Month to date"}</div>
      )}
    </div>
  );
}

function AttentionItem({ icon, value, title, detail, href }: { icon: "danger" | "clock" | "warn"; value: number; title: string; detail: string; href: string }) {
  const Icon = icon === "clock" ? Clock3 : icon === "warn" ? TriangleAlert : AlertCircle;
  return (
    <Link prefetch={false} href={href} className="ov-attention-row">
      <span className={`ov-attention-icon ov-attention-icon--${icon}`}><Icon className="h-3.5 w-3.5" /></span>
      <span className="ov-attention-copy"><strong>{number(value)} {title}</strong><small>{detail}</small></span>
      <ArrowRight className="h-3.5 w-3.5 text-[#7b8ba3]" />
    </Link>
  );
}

function BusinessMix({ insurers }: { insurers: Array<{ id: string; name: string; policy_count: number; net_premium: number; share_percent: number }> }) {
  if (!insurers.length) return <div className="r2-empty">No insurer business available</div>;
  const max = Math.max(...insurers.map((row) => row.net_premium), 1);
  return (
    <div className="ov-mix">
      <div className="ov-mix-head"><span>#</span><span>Insurer</span><span>Net Premium (₹ L)</span><span>Share</span></div>
      {insurers.map((row, index) => {
        const logo = getInsurerLogo(row.name);
        return (
          <div className="ov-mix-row" key={`${row.id}-${row.name}`}>
            <span>{index + 1}</span>
            <span className="ov-mix-insurer">
              {logo ? <Image src={logo} alt="" width={18} height={18} className="ov-insurer-logo" /> : null}
              <strong>{row.name || "Unassigned"}</strong>
            </span>
            <span className="ov-mix-bar-wrap"><i style={{ width: `${Math.max(4, (row.net_premium / max) * 100)}%` }} /><em>{lakh(row.net_premium)}</em></span>
            <span>{row.share_percent.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

type RiskRow = { name: string; renewal: number; claims: number };
function PortfolioRisk({ rows }: { rows: RiskRow[] }) {
  if (!rows.length) return <div className="r2-empty">No portfolio risk data available</div>;
  const max = Math.max(...rows.flatMap((row) => [row.renewal, row.claims]), 1);
  return (
    <div className="ov-risk">
      <div className="ov-chart-legend"><span><i className="ov-dot ov-dot--blue" />Renewals at Risk (₹ L)</span><span><i className="ov-dot ov-dot--light" />Claims Exposure (₹ L)</span></div>
      <div className="ov-risk-plot">
        {rows.map((row) => (
          <div className="ov-risk-group" key={row.name}>
            <div className="ov-risk-bars">
              <span className="ov-risk-bar ov-risk-bar--renewal" style={{ height: `${Math.max(3, (row.renewal / max) * 100)}%` }} title={compactMoney(row.renewal)} />
              <span className="ov-risk-bar ov-risk-bar--claims" style={{ height: `${Math.max(3, (row.claims / max) * 100)}%` }} title={compactMoney(row.claims)} />
            </div>
            <span className="ov-risk-label">{shortName(row.name)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildRiskByInsurer(
  renewals: Array<{ insurer_name: string; premium_at_risk: number }>,
  claims: Array<{ insurer_name: string; estimated_loss: number }>,
): RiskRow[] {
  const rows = new Map<string, RiskRow>();
  for (const row of renewals) {
    const name = row.insurer_name || "Unassigned";
    const current = rows.get(name) ?? { name, renewal: 0, claims: 0 };
    current.renewal += row.premium_at_risk || 0;
    rows.set(name, current);
  }
  for (const row of claims) {
    const name = row.insurer_name || "Unassigned";
    const current = rows.get(name) ?? { name, renewal: 0, claims: 0 };
    current.claims += row.estimated_loss || 0;
    rows.set(name, current);
  }
  return [...rows.values()].sort((a, b) => (b.renewal + b.claims) - (a.renewal + a.claims)).slice(0, 6);
}

function trendDelta(values: number[]) {
  if (values.length < 2) return null;
  const current = values[values.length - 1] ?? 0;
  const previous = values[values.length - 2] ?? 0;
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function statusClass(status: string) {
  const key = status.toLowerCase();
  if (key.includes("active") || key.includes("issued")) return "ov-status ov-status--green";
  if (key.includes("payment") || key.includes("pending")) return "ov-status ov-status--amber";
  if (key.includes("review")) return "ov-status ov-status--blue";
  return "ov-status";
}

function friendlyStatus(status: string) {
  const value = status?.trim();
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function indiaTime() {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date());
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
function lakh(value: number) { return (value / 100_000).toFixed(1); }
function number(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
function monthYear(value: string) {
  const date = /^\d{4}-\d{2}/.test(value) ? new Date(`${value.slice(0, 7)}-01T00:00:00Z`) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(date) : value;
}
function shortName(value: string) {
  const words = value.trim().split(/\s+/);
  return words.slice(0, 2).join(" ").slice(0, 16) || "—";
}

function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function periodValue(value: string | undefined): ManagementPackPeriod {
  return value === "last_month" || value === "last_6_months" || value === "custom" ? value : "mtd";
}

function businessScopeValue(value: string | undefined): OverviewBusinessScope {
  return value === "motor" || value === "non_motor" || value === "life" || value === "health" ? value : "all";
}
function businessScopeFilter(value: OverviewBusinessScope): { business?: string; category?: string } {
  if (value === "motor") return { business: "Motor" };
  if (value === "non_motor") return { business: "Non Motor" };
  if (value === "life") return { business: "Non Motor", category: "Life" };
  if (value === "health") return { business: "Non Motor", category: "Health" };
  return {};
}
function trendPeriodValue(value: string | undefined): OverviewTrendPeriod {
  return value === "mtd" || value === "last_month" || value === "year" ? value : "last_6_months";
}
function resolveTrendRange(period: OverviewTrendPeriod) {
  const today = indiaDateString(new Date());
  const currentMonth = today.slice(0, 7);
  if (period === "mtd") return { from: `${currentMonth}-01`, to: today };
  if (period === "last_month") {
    const month = shiftMonthValue(currentMonth, -1);
    return { from: `${month}-01`, to: lastDayOfMonthValue(month) };
  }
  if (period === "year") {
    const month = shiftMonthValue(currentMonth, -11);
    return { from: `${month}-01`, to: today };
  }
  const month = shiftMonthValue(currentMonth, -5);
  return { from: `${month}-01`, to: today };
}
function buildOverviewTrendPoints(
  report: Awaited<ReturnType<typeof loadPolicyBusinessNetReport>>["report"],
  period: OverviewTrendPeriod,
  fromDate: string,
  toDate: string,
): OverviewTrendPoint[] {
  if (period === "mtd" || period === "last_month") {
    const daily = new Map<string, { policyCount: number; netPremium: number }>();
    for (const row of report.register.rows) {
      if (!row.business_date) continue;
      const current = daily.get(row.business_date) ?? { policyCount: 0, netPremium: 0 };
      current.policyCount += 1;
      current.netPremium += row.net_premium || 0;
      daily.set(row.business_date, current);
    }
    const dates = dateRange(fromDate, toDate);
    const labelEvery = Math.max(1, Math.ceil(dates.length / 7));
    return dates.map((date, index) => {
      const value = daily.get(date) ?? { policyCount: 0, netPremium: 0 };
      return {
        key: date,
        label: formatTrendDate(date),
        axisLabel: index % labelEvery === 0 || index === dates.length - 1 ? formatTrendDate(date) : "",
        policyCount: value.policyCount,
        netPremium: value.netPremium,
      };
    });
  }
  return report.trend.map((row) => ({
    key: row.month,
    label: monthYear(row.month),
    axisLabel: monthYear(row.month),
    policyCount: row.policy_count,
    netPremium: row.net_premium,
  }));
}
function dateRange(from: string, to: string) {
  const values: string[] = [];
  const current = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (current <= end && values.length < 370) {
    values.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return values;
}
function formatTrendDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
function indiaDateString(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function shiftMonthValue(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function lastDayOfMonthValue(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 0));
  return `${year}-${String(monthNumber).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
