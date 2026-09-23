import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  Download,
  Filter,
  Info,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { getInsurerLogo } from "@/lib/insurer-logo";
import { requireCapability } from "@/lib/master-data-server";
import { loadManagementPack } from "@/lib/reports/management-pack";
import { loadPolicyBusinessNetReport } from "@/lib/reports/policy-business";

export default async function ReportsOverviewPage() {
  const profile = await requireCapability("view_reports");
  if (!profile) return null;

  const commercialAccess = canAccessPolicyCommercials(profile);
  let loadError = false;
  let pack: Awaited<ReturnType<typeof loadManagementPack>> | null = null;
  let ytdBusiness: Awaited<ReturnType<typeof loadPolicyBusinessNetReport>>["report"] | null = null;

  try {
    const [managementPack, businessPayload] = await Promise.all([
      loadManagementPack(profile, {}),
      loadPolicyBusinessNetReport(profile, { period: "ytd", page: "1" }),
    ]);
    pack = managementPack;
    ytdBusiness = businessPayload.report;
  } catch (error) {
    loadError = true;
    console.error("Reports overview load failed", error);
  }

  const trend = (ytdBusiness?.trend ?? []).slice(-6);
  const topInsurers = (ytdBusiness?.insurers ?? []).slice(0, 5);
  const recentRecords = (ytdBusiness?.register.rows ?? []).slice(0, 5);
  const premiumDelta = trendDelta(trend.map((row) => row.net_premium));
  const policyDelta = trendDelta(trend.map((row) => row.policy_count));
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
            <button type="button" className="ov-control"><CalendarDays className="h-3.5 w-3.5" /><span>MTD</span><ChevronDown className="h-3 w-3" /></button>
            <button type="button" className="ov-control"><Building2 className="h-3.5 w-3.5" /><span>All Business</span><ChevronDown className="h-3 w-3" /></button>
            <Link prefetch={false} href="/reports/business" className="ov-control ov-control--filter"><Filter className="h-3.5 w-3.5" /><span>Filters</span><span className="ov-filter-count">2</span></Link>
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
              <article className="ov-card ov-section">
                <div className="ov-section-head">
                  <h2>Business Trend</h2>
                  <button type="button" className="ov-mini-select">Last 6 months <ChevronDown className="h-3 w-3" /></button>
                </div>
                <BusinessTrendChart trend={trend} />
              </article>

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

function BusinessTrendChart({ trend }: { trend: Array<{ month: string; policy_count: number; net_premium: number }> }) {
  if (!trend.length) return <div className="r2-empty">No year-to-date business trend available</div>;
  const width = 720;
  const height = 220;
  const pad = { left: 48, right: 46, top: 28, bottom: 38 };
  const premiumMax = Math.max(...trend.map((row) => row.net_premium), 1);
  const policyMax = Math.max(...trend.map((row) => row.policy_count), 1);
  const x = (index: number) => pad.left + (trend.length === 1 ? 0 : index * ((width - pad.left - pad.right) / (trend.length - 1)));
  const yPremium = (value: number) => height - pad.bottom - (value / premiumMax) * (height - pad.top - pad.bottom);
  const yPolicy = (value: number) => height - pad.bottom - (value / policyMax) * (height - pad.top - pad.bottom);
  const premiumPoints = trend.map((row, index) => `${x(index)},${yPremium(row.net_premium)}`).join(" ");
  const policyPoints = trend.map((row, index) => `${x(index)},${yPolicy(row.policy_count)}`).join(" ");

  return (
    <div className="ov-chart">
      <div className="ov-chart-legend"><span><i className="ov-dot ov-dot--blue" />Net Premium (₹ Lakh)</span><span><i className="ov-dot ov-dot--slate" />Policies (Count)</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Six month net premium and policy count trend">
        {[0, .25, .5, .75, 1].map((tick) => {
          const y = pad.top + tick * (height - pad.top - pad.bottom);
          return <line key={tick} x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="ov-grid-line" />;
        })}
        <polyline points={premiumPoints} fill="none" className="ov-line ov-line--premium" />
        <polyline points={policyPoints} fill="none" className="ov-line ov-line--policies" />
        {trend.map((row, index) => (
          <g key={row.month}>
            <circle cx={x(index)} cy={yPremium(row.net_premium)} r="3.5" className="ov-point ov-point--premium" />
            <circle cx={x(index)} cy={yPolicy(row.policy_count)} r="3" className="ov-point ov-point--policies" />
            <text x={x(index)} y={height - 13} textAnchor="middle" className="ov-axis-label">{monthYear(row.month)}</text>
          </g>
        ))}
        <text x="8" y="16" className="ov-axis-label">{compactMoney(premiumMax)}</text>
        <text x={width - 5} y="16" textAnchor="end" className="ov-axis-label">{number(policyMax)}</text>
      </svg>
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
