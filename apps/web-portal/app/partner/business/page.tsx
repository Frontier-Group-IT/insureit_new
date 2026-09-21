import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  FileText,
  Filter,
  Layers3,
  Repeat2,
  ShieldAlert,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import {
  getPartnerWebBusinessPerformance,
  listPartnerWebPolicies,
  type PartnerPolicyRow,
} from "@/lib/partner-web";
import { getInsurerLogo } from "@/lib/insurer-logo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BusinessSearchParams = { from?: string; to?: string };
type InsightTone = "blue" | "green" | "purple" | "orange";
type InsightIcon = typeof BarChart3;

type MixRow = {
  label: string;
  policies: number;
  premium: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function currency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function shortMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(year, month - 1, 1));
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function validIsoDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function numeric(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function businessType(policy: PartnerPolicyRow) {
  return String(policy.business_type ?? "").trim().toLowerCase();
}

function isRenewal(policy: PartnerPolicyRow) {
  return businessType(policy).includes("renew");
}

function isNewBusiness(policy: PartnerPolicyRow) {
  const value = businessType(policy);
  return value.includes("new") || value.includes("fresh");
}

function policyDate(policy: PartnerPolicyRow) {
  return policy.issuance_date || policy.start_date || null;
}

function percentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function policyEndOffsetDays(policy: PartnerPolicyRow, referenceEpoch: number) {
  const endDate = policy.end_date?.slice(0, 10);
  if (!endDate || !validIsoDate(endDate)) return null;
  const endEpoch = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(endEpoch)) return null;
  return Math.floor((endEpoch - referenceEpoch) / DAY_MS);
}

async function loadPortfolioPolicies() {
  const pageSize = 200;
  const rows: PartnerPolicyRow[] = [];

  for (let offset = 0; offset < 5000; offset += pageSize) {
    const batch = await listPartnerWebPolicies({ limit: pageSize, offset, lifecycle: "all" });
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

function aggregateBy(rows: PartnerPolicyRow[], getLabel: (policy: PartnerPolicyRow) => string) {
  const grouped = new Map<string, MixRow>();

  for (const policy of rows) {
    const label = getLabel(policy).trim() || "Other";
    const current = grouped.get(label) ?? { label, policies: 0, premium: 0 };
    current.policies += 1;
    current.premium += numeric(policy.premium_amount);
    grouped.set(label, current);
  }

  return [...grouped.values()].sort((a, b) => b.premium - a.premium || b.policies - a.policies);
}

export default async function PartnerBusinessPage({ searchParams }: { searchParams: Promise<BusinessSearchParams> }) {
  const query = await searchParams;
  const hasRange = validIsoDate(query.from) && validIsoDate(query.to) && String(query.from) <= String(query.to);
  const [performance, portfolio] = await Promise.all([
    getPartnerWebBusinessPerformance(),
    loadPortfolioPolicies(),
  ]);

  const trendMonths = new Set(performance.trend.map((item) => item.month));
  const analysisPolicies = portfolio.filter((policy) => {
    const date = policyDate(policy);
    if (!date) return false;
    if (hasRange) {
      const day = date.slice(0, 10);
      return day >= String(query.from) && day <= String(query.to);
    }
    return trendMonths.has(date.slice(0, 7));
  });

  const newPolicies = analysisPolicies.filter(isNewBusiness);
  const renewalPolicies = analysisPolicies.filter(isRenewal);
  const analysisPremium = analysisPolicies.reduce((sum, policy) => sum + numeric(policy.premium_amount), 0);
  const averagePremium = analysisPolicies.length ? analysisPremium / analysisPolicies.length : 0;

  // Preserve the existing KPI calculation logic exactly: repeat-customer metrics use only canonical customer IDs.
  const customerPolicyCounts = new Map<string, number>();
  for (const policy of analysisPolicies) {
    if (!policy.customer_id) continue;
    customerPolicyCounts.set(policy.customer_id, (customerPolicyCounts.get(policy.customer_id) ?? 0) + 1);
  }
  const customerCounts = [...customerPolicyCounts.values()];
  const uniqueCustomers = customerCounts.length;
  const repeatCustomers = customerCounts.filter((count) => count > 1).length;
  const repeatCustomerRate = uniqueCustomers ? (repeatCustomers / uniqueCustomers) * 100 : 0;

  const unclassifiedPolicies = analysisPolicies.filter(
    (policy) => !policy.business_type || (!policy.policy_product && !policy.policy_type && !policy.business_line),
  ).length;

  const productMix = aggregateBy(
    analysisPolicies,
    (policy) => policy.policy_product || policy.policy_type || policy.business_line || "Other",
  ).slice(0, 5);
  const insurerMix = aggregateBy(analysisPolicies, (policy) => policy.insurer_name || "Unassigned insurer").slice(0, 5);

  // Renewal premium is intentionally treated as NIL until a canonical renewal-premium concept is introduced.
  const monthlyPremiumTrend = performance.trend.map((item) => {
    const monthPolicies = portfolio.filter((policy) => policyDate(policy)?.slice(0, 7) === item.month);
    return {
      month: item.month,
      businessPremium: monthPolicies.reduce((sum, policy) => sum + numeric(policy.premium_amount), 0),
      renewalPremium: 0,
    };
  });
  const maxTrendPremium = Math.max(1, ...monthlyPremiumTrend.map((item) => item.businessPremium));
  const analysisPeriodLabel = hasRange ? `${query.from} to ${query.to}` : "Last 6 months";

  const generatedDay = performance.generated_at?.slice(0, 10);
  const referenceDay = validIsoDate(generatedDay) ? String(generatedDay) : new Date().toISOString().slice(0, 10);
  const referenceEpoch = Date.parse(`${referenceDay}T00:00:00Z`);
  const renewalWindows = portfolio.map((policy) => ({ policy, days: policyEndOffsetDays(policy, referenceEpoch) }));
  const due7 = renewalWindows.filter(({ days }) => days !== null && days >= 0 && days <= 7).map(({ policy }) => policy);
  const due15 = renewalWindows.filter(({ days }) => days !== null && days >= 8 && days <= 15).map(({ policy }) => policy);
  const due30 = renewalWindows.filter(({ days }) => days !== null && days >= 16 && days <= 30).map(({ policy }) => policy);
  const premiumAtRiskRows = [...due7, ...due15, ...due30];
  const expiredRows = renewalWindows
    .filter(({ policy, days }) => policy.lifecycle_status === "expired" || (days !== null && days < 0))
    .map(({ policy }) => policy);
  const premiumAtRisk = premiumAtRiskRows.reduce((sum, policy) => sum + numeric(policy.premium_amount), 0);
  const expiredPremiumExposure = expiredRows.reduce((sum, policy) => sum + numeric(policy.premium_amount), 0);

  const due7Premium = due7.reduce((sum, policy) => sum + numeric(policy.premium_amount), 0);
  const due15Premium = due15.reduce((sum, policy) => sum + numeric(policy.premium_amount), 0);
  const due30Premium = due30.reduce((sum, policy) => sum + numeric(policy.premium_amount), 0);
  const classifiedPolicies = Math.max(0, analysisPolicies.length - unclassifiedPolicies);

  const metrics = [
    {
      label: "Business Premium",
      value: currency(analysisPremium),
      meta: `${analysisPolicies.length} recorded policies · ${analysisPeriodLabel}`,
      tone: "blue" as const,
      icon: BarChart3,
    },
    {
      label: "Average Premium per Policy",
      value: currency(averagePremium),
      meta: `${analysisPolicies.length} recorded policies in period`,
      tone: "purple" as const,
      icon: CircleDollarSign,
    },
    {
      label: "Repeat Customer Rate",
      value: percentage(repeatCustomerRate),
      meta: `${repeatCustomers} repeat of ${uniqueCustomers} policy customers`,
      tone: "orange" as const,
      icon: UsersRound,
    },
  ];

  return (
    <PartnerPortalShell title="My Business">
      <div className="space-y-4 pb-3">
        <section className="px-1 py-1">
          <h1 className="text-[20px] font-extrabold leading-tight tracking-[-0.03em] text-[#142B50]">Business performance</h1>
        </section>

        <section className="grid overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)] md:grid-cols-3">
          {metrics.map((metric) => <InsightMetricCard key={metric.label} {...metric} />)}
        </section>

        <ContributionPanel icon={TrendingUp} title="Top Insurer Contribution" subtitle="Premium contribution by insurer" rows={insurerMix} totalPremium={analysisPremium} />

        <section className="grid gap-3 xl:grid-cols-[1.15fr_.88fr_1fr]">
          <InsightPanel icon={BarChart3} title="Business Premium Trend" subtitle="Monthly business premium; renewal premium is currently treated as nil">
            <div className="flex items-center gap-3 text-[8px] font-bold text-[#61728A]">
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#1689EA]" />Business Premium</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#7145E9]" />Renewal Premium · ₹0</span>
            </div>
            <div className="flex min-h-[175px] items-end gap-1 overflow-x-auto border-t border-[#EEF2F6] pt-3">
              {monthlyPremiumTrend.map((item) => {
                const totalHeight = Math.max(item.businessPremium > 0 ? 6 : 0, Math.round((item.businessPremium / maxTrendPremium) * 108));
                return (
                  <div key={item.month} className="flex min-w-[42px] flex-1 flex-col items-center">
                    <div className="flex h-[118px] w-full items-end justify-center px-1">
                      <div className="w-full max-w-[28px] overflow-hidden rounded-t-md bg-[#1689EA]" style={{ height: totalHeight }} />
                    </div>
                    <p className="mt-1 text-[8px] font-extrabold text-[#223755]">{shortMonth(item.month)}</p>
                  </div>
                );
              })}
            </div>
          </InsightPanel>

          <section className="rounded-xl border border-[#D8EADF] bg-white p-3.5 shadow-[0_4px_14px_rgba(25,50,90,0.04)]">
            <div className="flex items-start justify-between gap-2 border-b border-[#EDF1F5] pb-3">
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#DDF6EC] text-[#21A874]"><Layers3 className="h-4 w-4" /></span>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.09em] text-[#5C8D79]">Business Mix</p>
                  <h2 className="mt-0.5 text-[13px] font-extrabold text-[#142B50]">By product</h2>
                </div>
              </div>
              <span className="rounded-full border border-[#DCE6E1] px-2 py-1 text-[7px] font-bold text-[#61728A]">{analysisPeriodLabel}</span>
            </div>
            <div className="mt-3 space-y-2">
              {productMix.length ? productMix.map((item) => {
                const percent = analysisPremium > 0 ? Math.min(100, (item.premium / analysisPremium) * 100) : 0;
                return (
                  <div key={item.label} className="rounded-lg border border-[#E2E9F1] bg-[#FAFBFD] px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-[9px] font-extrabold text-[#203653]">{humanize(item.label)}</p>
                      <p className="shrink-0 text-[8px] font-bold text-[#627692]">{percentage(percent)} · {currency(item.premium)}</p>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E8EDF3]"><div className="h-full rounded-full bg-[#3D79E8]" style={{ width: `${percent}%` }} /></div>
                  </div>
                );
              }) : <EmptyLine text="No product mix is available for this period." />}
            </div>
          </section>

          <InsightPanel icon={ShieldAlert} title="Renewal Risk & Lost Business" subtitle="Track renewal exposure and expired premium">
            <div className="grid grid-cols-2 gap-2">
              <RiskSummary label="Upcoming Premium at Risk" value={currency(premiumAtRisk)} count={`${premiumAtRiskRows.length} policies`} tone="amber" />
              <RiskSummary label="Expired Premium Exposure" value={currency(expiredPremiumExposure)} count={`${expiredRows.length} policies`} tone="red" />
            </div>
            <p className="pt-1 text-[8px] font-extrabold text-[#52637C]">Due in next</p>
            <div className="grid grid-cols-3 gap-2">
              <WindowCard label="7 days" value={currency(due7Premium)} count={`${due7.length} policies`} tone="red" />
              <WindowCard label="15 days" value={currency(due15Premium)} count={`${due15.length} policies`} tone="amber" />
              <WindowCard label="30 days" value={currency(due30Premium)} count={`${due30.length} policies`} tone="green" />
            </div>
          </InsightPanel>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1fr_1.1fr]">
          <section className="rounded-xl border border-[#DCE5F1] bg-white p-3.5 shadow-[0_4px_14px_rgba(25,50,90,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EEF4FF] text-[#3156B8]"><Filter className="h-4 w-4" /></span>
                <div>
                  <h2 className="text-[12px] font-extrabold text-[#183057]">Business Activity Funnel</h2>
                  <p className="mt-0.5 text-[8.5px] font-medium text-[#8190A5]">Real portfolio counts from the selected period</p>
                </div>
              </div>
              <span className="rounded-full border border-[#DCE5F1] px-2.5 py-1 text-[7px] font-bold text-[#61728A]">{analysisPeriodLabel}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-lg border border-[#E4EAF2] sm:grid-cols-5">
              <FunnelStage label="Recorded" value={analysisPolicies.length} meta="policies" />
              <FunnelStage label="Classified" value={classifiedPolicies} meta="policies" />
              <FunnelStage label="New Business" value={newPolicies.length} meta="policies" accent="blue" />
              <FunnelStage label="Renewal" value={renewalPolicies.length} meta="policies" accent="green" />
              <FunnelStage label="Repeat" value={repeatCustomers} meta="customers" accent="purple" />
            </div>
          </section>

          <section className="rounded-xl border border-[#DCE5F1] bg-white p-3.5 shadow-[0_4px_14px_rgba(25,50,90,0.04)]">
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EEF4FF] text-[#3156B8]"><Layers3 className="h-4 w-4" /></span>
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#71819A]">Workspaces</p>
                <h2 className="mt-0.5 text-[13px] font-extrabold text-[#183057]">Continue working</h2>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Action href="/partner/customers" title="Customer Book" subtitle="Open scoped customers" icon={UsersRound} />
              <Action href="/partner/policies" title="Policy Register" subtitle="Review policy portfolio" icon={FileText} />
              <Action href="/partner/renewals" title="Renewal Pipeline" subtitle="Open due and overdue business" icon={Repeat2} />
            </div>
          </section>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

const insightToneClasses: Record<InsightTone, string> = {
  blue: "bg-[#E9F2FF] text-[#2B73E8]",
  green: "bg-[#DFF7EC] text-[#20A978]",
  purple: "bg-[#EEE7FF] text-[#794EE1]",
  orange: "bg-[#FFF0DA] text-[#F09A1E]",
};

function InsightMetricCard({ label, value, meta, tone, icon: Icon }: { label: string; value: number | string; meta: string; tone: InsightTone; icon: InsightIcon }) {
  return (
    <div className="flex min-h-[98px] items-center gap-3 border-b border-[#E8EDF3] px-4 py-3 md:border-b-0 md:border-r md:last:border-r-0">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${insightToneClasses[tone]}`}><Icon className="h-4.5 w-4.5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[8px] font-black uppercase tracking-[0.06em] text-[#50637F]">{label}</p>
        <p className="mt-1 truncate text-[17px] font-black leading-none tracking-[-0.025em] text-[#142A50]">{value}</p>
        <p className="mt-1.5 truncate text-[8px] font-medium text-[#7A899E]">{meta}</p>
      </div>
    </div>
  );
}

function ContributionPanel({ icon: Icon, title, subtitle, rows, totalPremium }: { icon: InsightIcon; title: string; subtitle: string; rows: MixRow[]; totalPremium: number }) {
  return (
    <section className="rounded-xl border border-[#DCE5F1] bg-white p-3.5 shadow-[0_4px_14px_rgba(25,50,90,0.04)]">
      <div className="flex items-start gap-2.5 border-b border-[#EDF1F5] pb-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-4 w-4" /></span>
        <div><h2 className="text-[12px] font-extrabold text-[#183057]">{title}</h2><p className="mt-0.5 text-[8.5px] font-medium text-[#8190A5]">{subtitle}</p></div>
      </div>
      <div className="mt-3 grid gap-1.5 xl:grid-cols-2">
        {rows.length ? rows.map((item, index) => {
          const percent = totalPremium > 0 ? Math.min(100, (item.premium / totalPremium) * 100) : 0;
          const insurerLogo = getInsurerLogo(item.label);
          return (
            <div key={`${item.label}-${index}`} className="grid grid-cols-[32px_minmax(0,1fr)_82px] items-center gap-2 rounded-lg border border-[#E6EBF2] bg-[#FAFBFD] px-2.5 py-2">
              <span className="flex h-8 w-8 items-center justify-center">
                {insurerLogo ? (
                  <Image
                    src={insurerLogo}
                    alt={`${item.label} logo`}
                    width={30}
                    height={30}
                    className="max-h-7 max-w-[32px] object-contain"
                  />
                ) : null}
              </span>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[8.5px] font-extrabold text-[#263A58]">{item.label}</p>
                  <p className="text-[7.5px] font-bold text-[#657792]">{percentage(percent)}</p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E8EDF3]"><div className="h-full rounded-full bg-[#3D79E8]" style={{ width: `${percent}%` }} /></div>
              </div>
              <p className="text-right text-[8px] font-extrabold text-[#27405F]">{currency(item.premium)}</p>
            </div>
          );
        }) : <EmptyLine text={`No ${title.toLowerCase()} is available for this period.`} />}
      </div>
    </section>
  );
}

function InsightPanel({ icon: Icon, title, subtitle, children }: { icon: InsightIcon; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#DCE5F1] bg-white p-3.5 shadow-[0_4px_14px_rgba(25,50,90,0.04)]">
      <div className="flex items-start gap-2.5 border-b border-[#EDF1F5] pb-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-4 w-4" /></span>
        <div><h2 className="text-[12px] font-extrabold text-[#183057]">{title}</h2><p className="mt-0.5 text-[8.5px] font-medium text-[#8190A5]">{subtitle}</p></div>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function RiskSummary({ label, value, count, tone }: { label: string; value: string; count: string; tone: "amber" | "red" }) {
  const classes = tone === "amber" ? "bg-[#FFF9EE] text-[#E59B25]" : "bg-[#FFF2F4] text-[#EB4E68]";
  return (
    <div className="rounded-lg border border-[#E7EBF1] bg-[#FAFBFD] px-2.5 py-2.5">
      <div className="flex items-start gap-2"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${classes}`}><AlertTriangle className="h-3.5 w-3.5" /></span><div><p className="text-[7px] font-bold text-[#687A91]">{label}</p><p className="mt-1 text-[12px] font-black text-[#183057]">{value}</p><p className="mt-0.5 text-[7px] font-medium text-[#8190A5]">{count}</p></div></div>
    </div>
  );
}

function WindowCard({ label, value, count, tone }: { label: string; value: string; count: string; tone: "red" | "amber" | "green" }) {
  const classes = tone === "red" ? "border-[#F7D9DF] bg-[#FFF2F4]" : tone === "amber" ? "border-[#F5E3C3] bg-[#FFF8EC]" : "border-[#D7EEE4] bg-[#EFFAF5]";
  return <div className={`rounded-lg border px-2 py-2 ${classes}`}><p className="text-[7.5px] font-extrabold text-[#52637C]">{label}</p><p className="mt-1 text-[10px] font-black text-[#183057]">{value}</p><p className="mt-0.5 text-[7px] font-medium text-[#7D8CA1]">{count}</p></div>;
}

function FunnelStage({ label, value, meta, accent = "neutral" }: { label: string; value: number; meta: string; accent?: "neutral" | "blue" | "green" | "purple" }) {
  const accentClasses = accent === "blue" ? "bg-[#EDF4FF]" : accent === "green" ? "bg-[#ECF9F3]" : accent === "purple" ? "bg-[#F3EFFF]" : "bg-[#FAFBFD]";
  return <div className={`min-h-[70px] border-r border-[#E4EAF2] px-3 py-2.5 last:border-r-0 ${accentClasses}`}><p className="text-[7.5px] font-bold text-[#71819A]">{label}</p><p className="mt-1 text-[15px] font-black text-[#183057]">{value}</p><p className="text-[7px] font-medium text-[#8190A5]">{meta}</p></div>;
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-[#DCE4EE] bg-[#FAFBFD] px-3 py-6 text-center text-[9px] font-medium text-[#7D8CA1]">{text}</p>;
}

function Action({ href, title, subtitle, icon: Icon }: { href: string; title: string; subtitle: string; icon: InsightIcon }) {
  return (
    <Link href={href} prefetch={false} className="group flex min-h-[58px] items-center gap-2.5 rounded-lg border border-[#E2E8F0] bg-[#FAFBFD] px-3 py-2.5 transition hover:border-[#CAD6E5] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-extrabold text-[#172846]">{title}</span><span className="mt-0.5 block truncate text-[7.5px] font-medium text-[#74839A]">{subtitle}</span></span>
      <ArrowRight className="h-3.5 w-3.5 text-[#8090A8] transition group-hover:translate-x-0.5" />
    </Link>
  );
}
