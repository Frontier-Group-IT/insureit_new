import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  FileText,
  Layers3,
  Repeat2,
  Target,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import {
  getPartnerWebBusinessPerformance,
  listPartnerWebPolicies,
  type PartnerPolicyRow,
} from "@/lib/partner-web";

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

function aggregateBy(
  rows: PartnerPolicyRow[],
  getLabel: (policy: PartnerPolicyRow) => string,
) {
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
  const newPremium = newPolicies.reduce((sum, policy) => sum + numeric(policy.premium_amount), 0);
  const renewalPremium = renewalPolicies.reduce((sum, policy) => sum + numeric(policy.premium_amount), 0);
  const analysisPremium = analysisPolicies.reduce((sum, policy) => sum + numeric(policy.premium_amount), 0);
  const averagePremium = analysisPolicies.length ? analysisPremium / analysisPolicies.length : 0;

  const customerPolicyCounts = new Map<string, number>();
  for (const policy of analysisPolicies) {
    if (!policy.customer_id) continue;
    customerPolicyCounts.set(policy.customer_id, (customerPolicyCounts.get(policy.customer_id) ?? 0) + 1);
  }
  const customerCounts = [...customerPolicyCounts.values()];
  const uniqueCustomers = customerCounts.length;
  const repeatCustomers = customerCounts.filter((count) => count > 1).length;
  const crossSellCustomers = customerCounts.filter((count) => count === 1).length;
  const repeatCustomerRate = uniqueCustomers ? (repeatCustomers / uniqueCustomers) * 100 : 0;
  const policiesPerCustomer = uniqueCustomers ? analysisPolicies.length / uniqueCustomers : 0;
  const averageCustomerValue = uniqueCustomers ? analysisPremium / uniqueCustomers : 0;
  const unclassifiedPolicies = analysisPolicies.filter((policy) => !policy.business_type || (!policy.policy_product && !policy.policy_type && !policy.business_line)).length;

  const productMix = aggregateBy(
    analysisPolicies,
    (policy) => policy.policy_product || policy.policy_type || policy.business_line || "Other",
  ).slice(0, 6);
  const insurerMix = aggregateBy(
    analysisPolicies,
    (policy) => policy.insurer_name || "Unassigned insurer",
  ).slice(0, 5);

  const monthlySplit = performance.trend.map((item) => {
    const monthPolicies = portfolio.filter((policy) => policyDate(policy)?.slice(0, 7) === item.month);
    return {
      month: item.month,
      newPremium: monthPolicies.filter(isNewBusiness).reduce((sum, policy) => sum + numeric(policy.premium_amount), 0),
      renewalPremium: monthPolicies.filter(isRenewal).reduce((sum, policy) => sum + numeric(policy.premium_amount), 0),
    };
  });
  const maxSplitPremium = Math.max(1, ...monthlySplit.map((item) => item.newPremium + item.renewalPremium));
  const hasBusinessTypeClassification = newPolicies.length + renewalPolicies.length > 0;
  const analysisPeriodLabel = hasRange ? `${query.from} to ${query.to}` : "Last 6 months";

  const metrics = [
    {
      label: "New Business Premium",
      value: currency(newPremium),
      meta: `${newPolicies.length} classified policies · ${analysisPeriodLabel}`,
      tone: "blue" as const,
      icon: BarChart3,
    },
    {
      label: "Renewal Business Premium",
      value: currency(renewalPremium),
      meta: `${renewalPolicies.length} classified policies · ${analysisPeriodLabel}`,
      tone: "green" as const,
      icon: Repeat2,
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

        <section className="grid overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)] sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => <InsightMetricCard key={metric.label} {...metric} />)}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.22fr_.78fr]">
          <div className="rounded-xl border border-[#DCE5F1] bg-white p-4 shadow-[0_4px_14px_rgba(25,50,90,0.05)]">
            <div className="flex items-start gap-2.5 border-b border-[#EDF1F5] pb-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#3156B8]">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-[#142B50]">Top Insurer Contribution</h2>
                <p className="mt-0.5 text-[8.5px] font-medium text-[#8190A5]">Premium contribution by insurer</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {insurerMix.length ? insurerMix.map((item, index) => {
                const percent = analysisPremium > 0 ? Math.min(100, (item.premium / analysisPremium) * 100) : 0;
                return (
                  <div key={item.label} className="grid grid-cols-[22px_minmax(0,1fr)_78px] items-center gap-2 rounded-lg border border-[#E6EBF2] bg-[#FAFBFD] px-2.5 py-2">
                    <span className="text-center text-[8.5px] font-black text-[#526782]">{index + 1}</span>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[9px] font-extrabold text-[#263A58]">{item.label}</p>
                        <p className="text-[8px] font-bold text-[#657792]">{percentage(percent)}</p>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E8EDF3]">
                        <div className="h-full rounded-full bg-[#3D79E8]" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                    <p className="text-right text-[8.5px] font-extrabold text-[#27405F]">{currency(item.premium)}</p>
                  </div>
                );
              }) : <EmptyLine text="No insurer contribution is available for this period." />}
            </div>
          </div>

          <div className="rounded-xl border border-[#D8EADF] bg-gradient-to-br from-[#F8FCFA] to-[#EEF9F5] p-4 shadow-[0_4px_14px_rgba(25,50,90,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#DDF6EC] text-[#21A874]">
                  <Layers3 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.09em] text-[#5C8D79]">Business Mix</p>
                  <h2 className="mt-0.5 text-[15px] font-extrabold tracking-[-0.02em] text-[#142B50]">By product</h2>
                </div>
              </div>
              <span className="rounded-full border border-[#DCE6E1] bg-white px-2.5 py-1 text-[7.5px] font-bold text-[#61728A]">{analysisPeriodLabel}</span>
            </div>

            <div className="mt-3 space-y-2">
              {productMix.length ? productMix.map((item) => {
                const percent = analysisPremium > 0 ? Math.min(100, (item.premium / analysisPremium) * 100) : 0;
                return (
                  <div key={item.label} className="rounded-lg border border-[#E2E9F1] bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(25,50,90,0.03)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-[10px] font-extrabold text-[#203653]">{humanize(item.label)}</p>
                      <p className="shrink-0 text-[8.5px] font-bold text-[#627692]">{percentage(percent)} · {currency(item.premium)} · {item.policies}</p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E8EDF3]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#4D45E5] to-[#1592E7]" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              }) : <EmptyLine text="No product mix is available for this period." />}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <InsightPanel icon={BarChart3} title="New vs Renewal Premium Trend" subtitle="Business-type premium split across the last six months">
            <div className="flex items-center gap-3 text-[8px] font-bold text-[#61728A]">
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#1689EA]" />New Business</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#7145E9]" />Renewal Business</span>
            </div>
            {hasBusinessTypeClassification ? (
              <div className="flex min-h-[155px] items-end gap-1.5 overflow-x-auto border-t border-[#EEF2F6] pt-3">
                {monthlySplit.map((item) => {
                  const total = item.newPremium + item.renewalPremium;
                  const totalHeight = Math.max(total > 0 ? 6 : 0, Math.round((total / maxSplitPremium) * 96));
                  const newHeight = total > 0 ? Math.round((item.newPremium / total) * totalHeight) : 0;
                  const renewalHeight = Math.max(0, totalHeight - newHeight);
                  return (
                    <div key={item.month} className="flex min-w-[50px] flex-1 flex-col items-center">
                      <p className="mb-1 text-center text-[7px] font-extrabold text-[#526B91]">{currency(total)}</p>
                      <div className="flex h-[100px] w-full items-end justify-center px-1">
                        <div className="flex w-full max-w-[28px] flex-col-reverse overflow-hidden rounded-t-md" style={{ height: totalHeight }}>
                          {newHeight > 0 ? <div className="w-full bg-[#1689EA]" style={{ height: newHeight }} /> : null}
                          {renewalHeight > 0 ? <div className="w-full bg-[#7145E9]" style={{ height: renewalHeight }} /> : null}
                        </div>
                      </div>
                      <p className="mt-1 text-[8px] font-extrabold text-[#223755]">{shortMonth(item.month)}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-[155px] place-items-center rounded-lg border border-dashed border-[#D9E2EE] bg-[#FAFBFD] px-4 text-center">
                <div>
                  <Layers3 className="mx-auto h-5 w-5 text-[#8A99AE]" />
                  <p className="mt-2 text-[10px] font-extrabold text-[#31445F]">Business-type split is not available yet</p>
                  <p className="mt-1 text-[8px] font-medium text-[#7D8CA1]">The chart will populate when policies are classified as new/fresh or renewal business.</p>
                </div>
              </div>
            )}
          </InsightPanel>

          <InsightPanel icon={UsersRound} title="Customer Value & Portfolio Quality" subtitle="Indicators for sustainable growth">
            <QualityRow label="Average Customer Value" value={currency(averageCustomerValue)} />
            <QualityRow label="Policies per Customer" value={policiesPerCustomer.toFixed(1)} />
            <QualityRow label="Repeat Customer Rate" value={percentage(repeatCustomerRate)} />
          </InsightPanel>

          <InsightPanel icon={Target} title="Opportunity Snapshot" subtitle="Actionable portfolio opportunities">
            <OpportunityRow label="Cross-sell Opportunity" value={`${crossSellCustomers} customers`} meta="Have only one recorded policy" href="/partner/customers" />
            <OpportunityRow label="Repeat Customers" value={`${repeatCustomers} customers`} meta="Already hold multiple recorded policies" href="/partner/customers" />
            <OpportunityRow label="Unclassified Portfolio" value={`${unclassifiedPolicies} policies`} meta="Missing business or product classification" href="/partner/policies" />
          </InsightPanel>
        </section>

        <section className="rounded-xl border border-[#DCE5F1] bg-white p-4 shadow-[0_4px_14px_rgba(25,50,90,0.04)]">
          <PartnerSectionHeading eyebrow="Workspaces" title="Continue working" />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Action href="/partner/customers" title="Customer Book" subtitle="Open scoped customers" />
            <Action href="/partner/policies" title="Policy Register" subtitle="Review policy portfolio" />
            <Action href="/partner/renewals" title="Renewal Pipeline" subtitle="Open due and overdue business" />
          </div>
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
    <div className="flex min-h-[98px] items-center gap-3 border-b border-[#E8EDF3] px-4 py-3 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(n+3)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${insightToneClasses[tone]}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[8px] font-black uppercase tracking-[0.06em] text-[#50637F]">{label}</p>
        <p className="mt-1 truncate text-[17px] font-black leading-none tracking-[-0.025em] text-[#142A50]">{value}</p>
        <p className="mt-1.5 truncate text-[8px] font-medium text-[#7A899E]">{meta}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#6D7D96]" />
    </div>
  );
}

function InsightPanel({ icon: Icon, title, subtitle, children }: { icon: InsightIcon; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#DCE5F1] bg-white p-4 shadow-[0_4px_14px_rgba(25,50,90,0.04)]">
      <div className="flex items-start gap-2.5 border-b border-[#EDF1F5] pb-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#3156B8]">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-[12px] font-extrabold text-[#183057]">{title}</h2>
          <p className="mt-0.5 text-[8.5px] font-medium text-[#8190A5]">{subtitle}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function QualityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[50px] items-center justify-between gap-3 rounded-lg border border-[#E6EBF2] bg-[#FAFBFD] px-3 py-2.5">
      <p className="text-[9px] font-bold text-[#52637C]">{label}</p>
      <p className="text-[13px] font-black tracking-[-0.02em] text-[#183057]">{value}</p>
    </div>
  );
}

function OpportunityRow({ label, value, meta, href }: { label: string; value: string; meta: string; href: string }) {
  return (
    <Link href={href} prefetch={false} className="group flex min-h-[54px] items-center gap-3 rounded-lg border border-[#E6EBF2] bg-[#FAFBFD] px-3 py-2.5 transition hover:border-[#CAD6E5] hover:bg-white">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#3156B8]"><Target className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-extrabold text-[#263A58]">{label}</span>
        <span className="mt-0.5 block truncate text-[8px] font-medium text-[#8190A5]">{meta}</span>
      </span>
      <span className="shrink-0 text-[10px] font-black text-[#183057]">{value}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#4F78C8] transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-[#DCE4EE] bg-[#FAFBFD] px-3 py-6 text-center text-[9px] font-medium text-[#7D8CA1]">{text}</p>;
}

function Action({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} prefetch={false} className="group flex min-h-[58px] items-center justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-[#FAFBFD] px-3 py-2.5 transition hover:border-[#CAD6E5] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20">
      <span>
        <span className="block break-words text-[10.5px] font-extrabold leading-4 text-[#172846]">{title}</span>
        <span className="mt-0.5 block break-words text-[9px] font-medium leading-4 text-[#74839A]">{subtitle}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
    </Link>
  );
}