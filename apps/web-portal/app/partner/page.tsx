import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BadgePercent,
  Ellipsis,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import {
  getPartnerWebBusinessPerformance,
  getPartnerWebBusinessRange,
  getPartnerWebClaimSummary,
  getPartnerWebHome,
  getPartnerWebNetwork,
  getPartnerWebPayoutSummary,
  getPartnerWebRenewalSummary,
  getPartnerWebSession,
} from "@/lib/partner-web";
import { getPartnerExternalRenewalSummary } from "@/lib/partner-external-renewals";
import { getPartnerWebActiveScheme } from "@/lib/partner-schemes";
import { PartnerHomeTrendPeriodFilter } from "./partner-home-trend-period-filter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ICON_BASE = "/assets/Custom-Icons/optimized-128";

const homeIcons = {
  premium: `${ICON_BASE}/accounts-finance.png`,
  policies: `${ICON_BASE}/policy.png`,
  customers: `${ICON_BASE}/customers.png`,
  families: `${ICON_BASE}/customers.png`,
  renewals: `${ICON_BASE}/renewal.png`,
  priority: `${ICON_BASE}/tasks-work-queue.png`,
  claims: `${ICON_BASE}/claims.png`,
  claimOutstanding: `${ICON_BASE}/claim-settlement.png`,
  payout: `${ICON_BASE}/accounts-finance.png`,
  intakeAttention: `${ICON_BASE}/policy-intake-review.png`,
  overduePolicies: `${ICON_BASE}/expired-policy.png`,
  workload: `${ICON_BASE}/reports-analytics.png`,
  business: `${ICON_BASE}/reports-analytics.png`,
} as const;

type HomeSearchParams = { trend?: string };
type TrendPeriod = "6m" | "mtd" | "12m";
type TrendPoint = { month: string; premium: number | string; policies: number; label?: string };

const trendPeriodOptions: { value: TrendPeriod; label: string }[] = [
  { value: "6m", label: "Last 6 Months" },
  { value: "mtd", label: "MTD" },
  { value: "12m", label: "Last 12 Months" },
];

function formatIndianCurrency(value: number | string) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatCompactCurrency(value: number | string) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatUpdatedTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
    .format(value)
    .toLowerCase();
}

function formatSchemeDeadline(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: value, time: "" };
  return {
    date: new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(parsed),
    time: new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(parsed),
  };
}

function currentKolkataIsoDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kolkata",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function monthLabel(value: string) {
  const parsed = new Date(`${value}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(parsed);
}

function shiftMonth(value: string, offset: number) {
  const [year, month] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthRange(value: string, today: string) {
  const [year, month] = value.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return {
    from: `${value}-01`,
    to: value === today.slice(0, 7) ? today : end,
  };
}

function mtdWeekRanges(today: string) {
  const month = today.slice(0, 7);
  const currentDay = Math.max(1, Number(today.slice(8, 10)) || 1);
  return Array.from({ length: Math.ceil(currentDay / 7) }, (_, index) => {
    const startDay = index * 7 + 1;
    const endDay = Math.min(currentDay, startDay + 6);
    const pad = (value: number) => String(value).padStart(2, "0");
    return {
      from: `${month}-${pad(startDay)}`,
      to: `${month}-${pad(endDay)}`,
      label: `Week ${index + 1}`,
    };
  });
}

function resolveTrendPeriod(value?: string): TrendPeriod {
  if (value === "mtd" || value === "12m") return value;
  return "6m";
}

function todayHref(kind: "intake_attention" | "renewal" | "claim") {
  if (kind === "intake_attention") return "/partner/policy-intakes";
  if (kind === "renewal") return "/partner/renewals";
  return "/partner/claims";
}

function todayIcon(kind: "intake_attention" | "renewal" | "claim") {
  if (kind === "intake_attention") return homeIcons.intakeAttention;
  if (kind === "renewal") return homeIcons.renewals;
  return homeIcons.claims;
}

function ProfessionalIcon({ src, alt = "", size = 24 }: { src: string; alt?: string; size?: number }) {
  return <Image src={src} alt={alt} width={size} height={size} className="h-auto w-auto object-contain" />;
}

async function getPartnerWebNetPremiumThisMonth() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_web_net_premium_this_month");
  if (error || data === null) throw new Error(error?.message ?? "Partner net premium is unavailable.");
  return data as number | string;
}

async function getPartnerWebClaimOutstanding() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_web_claim_outstanding");
  if (error || data === null) throw new Error(error?.message ?? "Partner claim outstanding is unavailable.");
  return data as number | string;
}

export default async function PartnerHomePage({ searchParams }: { searchParams: Promise<HomeSearchParams> }) {
  const query = await searchParams;
  const trendPeriod = resolveTrendPeriod(query.trend);
  const [
    { identity },
    home,
    externalRenewals,
    netPremiumThisMonth,
    network,
    claims,
    payout,
    businessPerformance,
    claimOutstanding,
    renewalSummary,
    activeScheme,
  ] = await Promise.all([
    getPartnerWebSession(),
    getPartnerWebHome(),
    getPartnerExternalRenewalSummary(),
    getPartnerWebNetPremiumThisMonth(),
    getPartnerWebNetwork(),
    getPartnerWebClaimSummary(),
    getPartnerWebPayoutSummary(),
    getPartnerWebBusinessPerformance(),
    getPartnerWebClaimOutstanding(),
    getPartnerWebRenewalSummary(),
    getPartnerWebActiveScheme(),
  ]);

  const today = currentKolkataIsoDate();
  const monthCount = trendPeriod === "12m" ? 12 : trendPeriod === "mtd" ? 1 : 6;
  const currentMonth = businessPerformance.current_month;
  const selectedStartMonth = shiftMonth(currentMonth, -(monthCount - 1));
  const selectedFrom = `${selectedStartMonth}-01`;
  const periodSummaryPromise = getPartnerWebBusinessRange(selectedFrom, today);
  const twelveMonthTrendPromise: Promise<TrendPoint[]> = trendPeriod === "12m"
    ? Promise.all(
        Array.from({ length: 12 }, (_, index) => shiftMonth(currentMonth, index - 11)).map(async (month) => {
          const range = monthRange(month, today);
          const summary = await getPartnerWebBusinessRange(range.from, range.to);
          return { month, premium: summary.premium, policies: summary.policies };
        }),
      )
    : Promise.resolve([]);
  const mtdWeeklyTrendPromise: Promise<TrendPoint[]> = trendPeriod === "mtd"
    ? Promise.all(
        mtdWeekRanges(today).map(async (range) => {
          const summary = await getPartnerWebBusinessRange(range.from, range.to);
          return {
            month: currentMonth,
            premium: summary.premium,
            policies: summary.policies,
            label: range.label,
          };
        }),
      )
    : Promise.resolve([]);
  const [periodSummary, twelveMonthTrend, mtdWeeklyTrend] = await Promise.all([
    periodSummaryPromise,
    twelveMonthTrendPromise,
    mtdWeeklyTrendPromise,
  ]);
  const trendPoints: TrendPoint[] = trendPeriod === "12m"
    ? twelveMonthTrend
    : trendPeriod === "mtd"
      ? mtdWeeklyTrend
      : businessPerformance.trend.slice(-6);
  const trendPeriodLabel = trendPeriodOptions.find((option) => option.value === trendPeriod)?.label ?? "Last 6 Months";

  const name = identity.display_name?.trim() || "Partner";
  const updatedTime = formatUpdatedTime(new Date());
  const schemeDeadline = activeScheme ? formatSchemeDeadline(activeScheme.ends_at) : null;
  const payoutValue = payout.available ? formatIndianCurrency(payout.paid_amount) : "Restricted";
  const payoutMeta = payout.available ? `${payout.paid_count} paid records` : "Commercial visibility restricted";
  const payoutOutstandingValue = payout.available ? formatIndianCurrency(payout.pending_amount) : "Restricted";
  const payoutOutstandingMeta = payout.available ? `${payout.pending_count} pending records` : "Commercial visibility restricted";
  const selectedPremiumChange = Number(periodSummary.premium_change_percent ?? 0);
  const selectedClaimRatio = periodSummary.policies > 0 ? (periodSummary.claims / periodSummary.policies) * 100 : 0;
  const premiumAtRisk = [
    renewalSummary.due_0_7_premium,
    renewalSummary.due_8_15_premium,
    renewalSummary.due_16_30_premium,
  ].reduce<number>((total, value) => {
    const amount = Number(value ?? 0);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return (
    <PartnerPortalShell title="Home">
      <div className="space-y-2 pb-3">
        <section
          data-partner-home-reference-hero="true"
          className="flex items-center justify-between gap-5 overflow-x-auto border-b border-[#D7DEE8] px-1 py-1 sm:px-0"
        >
          <div className="min-w-0 flex-1">
            <h1 className="whitespace-nowrap text-[24px] font-medium leading-none tracking-[-0.035em] text-[#142746] sm:text-[26px]">Welcome, {name}</h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {activeScheme && schemeDeadline ? (
              <Link
                href="/partner/schemes"
                prefetch={false}
                data-partner-active-scheme="true"
                className="group inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[9.5px] font-semibold text-[#405A7B] transition hover:bg-[#EEF4FC] hover:text-[#1F5EC7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
              >
                <BadgePercent className="h-3.5 w-3.5 shrink-0 text-[#2E6CD5]" aria-hidden="true" />
                <span className="max-w-[220px] truncate font-extrabold text-[#203A61]">{activeScheme.name}</span>
                <span className="text-[#9AA7B8]">·</span>
                <span>Valid till {schemeDeadline.date}</span>
                <span className="text-[#9AA7B8]">·</span>
                <span>{schemeDeadline.time}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#2E6CD5] transition group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            ) : null}
            <span className="whitespace-nowrap text-[10px] font-medium text-[#7A899E]">Updated {updatedTime}</span>
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Families"
            value={network.total_partners}
            meta={network.total_groups > 0 ? `${network.total_groups} group${network.total_groups === 1 ? "" : "s"}` : "Partner family scope"}
            href="/partner/network"
            iconSrc={homeIcons.families}
          />
          <SummaryCard
            label="Customers"
            value={home.business.total_customers}
            meta={`${home.business.customers_this_month} added this month`}
            href="/partner/customers"
            iconSrc={homeIcons.customers}
          />
          <SummaryCard
            label="Policies"
            value={businessPerformance.total_policies}
            meta={`${home.business.active_policies} active`}
            href="/partner/policies"
            iconSrc={homeIcons.policies}
          />
          <SummaryCard
            label="Premium at Risk"
            value={formatIndianCurrency(premiumAtRisk)}
            meta="Renewal premium due in 30 days"
            href="/partner/renewals"
            iconSrc={homeIcons.renewals}
          />
          <SummaryCard
            label="Business"
            value={formatIndianCurrency(netPremiumThisMonth)}
            meta="Net premium this month"
            href="/partner/business"
            iconSrc={homeIcons.business}
          />
        </section>

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Payout"
            value={payoutValue}
            meta={payoutMeta}
            href="/partner/payout"
            iconSrc={homeIcons.payout}
          />
          <SummaryCard
            label="Claim Outstanding"
            value={formatIndianCurrency(claimOutstanding)}
            meta="Outstanding claim amount"
            href="/partner/claims"
            iconSrc={homeIcons.claimOutstanding}
          />
          <SummaryCard
            label="Payout Outstanding"
            value={payoutOutstandingValue}
            meta={payoutOutstandingMeta}
            href="/partner/payout"
            iconSrc={homeIcons.payout}
          />
          <SummaryCard
            label="Renewals Due 30D"
            value={home.business.renewals_30_days}
            meta="Policies due in 30 days"
            href="/partner/renewals"
            iconSrc={homeIcons.renewals}
          />
        </section>

        <section className="grid gap-2 xl:grid-cols-[1.55fr_.75fr]">
          <BusinessTrend trend={trendPoints} period={trendPeriod} periodLabel={trendPeriodLabel} />

          <div className="overflow-hidden rounded-xl border border-[#DCE5F1] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)]">
            <div className="flex items-center gap-2.5 border-b border-[#E6ECF3] px-4 py-3">
              <span className="grid h-6 w-6 place-items-center">
                <ProfessionalIcon src={homeIcons.business} size={20} />
              </span>
              <h2 className="min-w-0 flex-1 text-[14px] font-extrabold tracking-[-0.02em] text-[#142B50]">Business highlights</h2>
              <Ellipsis className="h-4 w-4 text-[#2F70E5]" aria-hidden="true" />
            </div>
            <div className="divide-y divide-[#E8EDF4] px-4">
              <HighlightRow
                label="Premium change"
                value={`${selectedPremiumChange > 0 ? "+" : ""}${selectedPremiumChange.toFixed(1)}%`}
                meta={`vs previous ${trendPeriodLabel.toLowerCase()} period`}
                tone={selectedPremiumChange > 0 ? "positive" : selectedPremiumChange < 0 ? "negative" : "neutral"}
              />
              <HighlightRow
                label="Customer activity"
                value={`${periodSummary.customers} added`}
                meta={`${home.business.total_customers} total customers · ${trendPeriodLabel}`}
              />
              <HighlightRow
                label="Policy base"
                value={`${periodSummary.policies} issued`}
                meta={`${businessPerformance.total_policies} total policies · ${trendPeriodLabel}`}
              />
              <HighlightRow
                label="Claim ratio"
                value={`${selectedClaimRatio.toFixed(1)}%`}
                meta={`${periodSummary.claims} claims / ${periodSummary.policies} policies`}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <DashboardPanel
            iconSrc={homeIcons.priority}
            title="Priority work"
          >
            <div className="space-y-2 px-4 pb-4">
              {home.today.length ? (
                home.today.slice(0, 6).map((item, index) => (
                  <Link
                    key={`${item.kind}-${index}`}
                    href={todayHref(item.kind)}
                    prefetch={false}
                    className="group flex min-h-[62px] items-center gap-3 rounded-lg border border-[#E3EAF4] bg-white px-3.5 py-2.5 shadow-[0_3px_10px_rgba(25,50,90,0.04)] transition hover:border-[#D2DDED] hover:shadow-[0_5px_14px_rgba(25,50,90,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center">
                      <ProfessionalIcon src={todayIcon(item.kind)} size={24} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-extrabold leading-4 text-[#183057]">{item.title}</span>
                      <span className="mt-0.5 block text-[9.5px] font-medium leading-4 text-[#74849C]">{item.subtitle}</span>
                    </span>
                    <span className="grid min-w-6 place-items-center rounded-full bg-[#FFF0F5] px-2 py-1 text-[9px] font-black text-[#E34578]">{item.count}</span>
                    <ArrowRight className="h-4 w-4 text-[#3471E9] transition group-hover:translate-x-0.5" />
                  </Link>
                ))
              ) : (
                <div className="flex min-h-[62px] items-center gap-3 rounded-lg border border-[#E3EAF4] bg-white px-4 text-[#62738D]">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-[10.5px] font-semibold">No priority actions right now.</p>
                </div>
              )}

              <Link
                href="/partner/renewals/external"
                prefetch={false}
                className="group flex min-h-[62px] items-center gap-3 rounded-lg border border-[#E3EAF4] bg-white px-3.5 py-2.5 shadow-[0_3px_10px_rgba(25,50,90,0.04)] transition hover:border-[#D2DDED] hover:shadow-[0_5px_14px_rgba(25,50,90,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center">
                  <ProfessionalIcon src={homeIcons.renewals} size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-extrabold leading-4 text-[#183057]">External Renewal Opportunities</span>
                  <span className="mt-0.5 block text-[9.5px] font-medium leading-4 text-[#74849C]">External policies expiring within 30 days</span>
                </span>
                <span className="text-[18px] font-black tracking-[-0.03em] text-[#102A59]">{externalRenewals.due_30_count}</span>
                <ArrowRight className="h-4 w-4 text-[#3471E9] transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </DashboardPanel>

          <DashboardPanel
            iconSrc={homeIcons.workload}
            title="Operational snapshot"
          >
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <SnapshotCard label="Intakes Attention" value={home.service.intakes_need_attention} href="/partner/policy-intakes" iconSrc={homeIcons.intakeAttention} />
              <SnapshotCard label="Overdue Policies" value={home.business.overdue_policies} href="/partner/renewals" iconSrc={homeIcons.overduePolicies} />
              <SnapshotCard label="Renewals Due 30D" value={home.business.renewals_30_days} href="/partner/renewals" iconSrc={homeIcons.renewals} />
              <SnapshotCard label="Payout Pending Records" value={payout.available ? payout.pending_count : "—"} href="/partner/payout" iconSrc={homeIcons.payout} />
            </div>
          </DashboardPanel>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function SummaryCard({
  label,
  value,
  meta,
  href,
  iconSrc,
}: {
  label: string;
  value: number | string;
  meta: string;
  href: string;
  iconSrc: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex min-h-[82px] items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-[0_4px_14px_rgba(25,50,90,0.05)] transition hover:border-[#D2DDED] hover:shadow-[0_6px_18px_rgba(25,50,90,0.075)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center">
        <ProfessionalIcon src={iconSrc} size={25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-black leading-none tracking-[-0.025em] text-[#142A50]">{value}</span>
        <span className="mt-1.5 block text-[7.5px] font-black uppercase tracking-[0.08em] text-[#50637F]">{label}</span>
        <span className="mt-1 block truncate text-[8px] font-medium text-[#7A899E]">{meta}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#6D7D96] transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function BusinessTrend({ trend, period, periodLabel }: { trend: TrendPoint[]; period: TrendPeriod; periodLabel: string }) {
  const points = trend;
  const maxPremium = Math.max(1, ...points.map((point) => Number(point.premium ?? 0)));
  const maxPolicies = Math.max(1, ...points.map((point) => point.policies));
  const plotLeft = 24;
  const plotRight = 576;
  const plotTop = 28;
  const plotBottom = 150;
  const plotHeight = plotBottom - plotTop;
  const slotWidth = points.length > 1 ? (plotRight - plotLeft) / (points.length - 1) : 0;
  const barWidth = points.length >= 10 ? 26 : points.length >= 7 ? 34 : 44;
  const linePoints = points
    .map((point, index) => {
      const x = points.length > 1 ? plotLeft + index * slotWidth : 300;
      const y = plotBottom - (point.policies / maxPolicies) * plotHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="overflow-visible rounded-xl border border-[#DCE5F1] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#E6ECF3] px-4 py-3">
        <span className="grid h-6 w-6 place-items-center">
          <ProfessionalIcon src={homeIcons.business} size={20} />
        </span>
        <h2 className="min-w-0 flex-1 text-[14px] font-extrabold tracking-[-0.02em] text-[#142B50]">M/M Business Trend</h2>
        <div className="flex items-center gap-3 text-[8.5px] font-semibold text-[#6F8098]">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#A9CFFF]" />Premium</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-[#163968]" />Policies</span>
        </div>
        <PartnerHomeTrendPeriodFilter period={period} label={periodLabel} />
        <Link
          href="/partner/business"
          prefetch={false}
          data-partner-home-reference-cta="true"
          className="inline-flex h-7 shrink-0 items-center justify-center gap-1 bg-[#163968] px-2.5 text-[8.5px] font-semibold text-white shadow-none transition hover:bg-[#102F59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163968]/30"
        >
          <span>View My Business</span>
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {points.length ? (
        <div className="px-1 pb-2 pt-3">
          <svg viewBox="0 0 600 190" className="h-[210px] w-full" role="img" aria-label={`Premium and policy trend for ${periodLabel.toLowerCase()}`}>
            {[0, 1, 2, 3].map((grid) => {
              const y = plotTop + (plotHeight / 3) * grid;
              return <line key={grid} x1="8" x2="592" y1={y} y2={y} stroke="#E7EDF5" strokeWidth="1" />;
            })}
            {points.map((point, index) => {
              const x = points.length > 1 ? plotLeft + index * slotWidth : 300;
              const premium = Number(point.premium ?? 0);
              const barHeight = Math.max(4, (premium / maxPremium) * plotHeight);
              const y = plotBottom - barHeight;
              const policyY = plotBottom - (point.policies / maxPolicies) * plotHeight;

              return (
                <g key={`${point.month}-${index}`}>
                  <rect x={x - barWidth / 2} y={y} width={barWidth} height={barHeight} rx="5" fill={index === points.length - 1 ? "#7CB4FF" : "#C4DEFF"} />
                  <text x={x} y={Math.max(14, y - 7)} textAnchor="middle" fontSize={points.length >= 10 ? "6.5" : "8"} fontWeight="700" fill="#536987">
                    {formatCompactCurrency(point.premium)}
                  </text>
                  <circle cx={x} cy={policyY} r="4" fill="#163968" />
                  <text x={x} y="176" textAnchor="middle" fontSize={points.length >= 10 ? "7" : "9"} fontWeight="700" fill="#536987">{point.label ?? monthLabel(point.month)}</text>
                  <text x={x} y="187" textAnchor="middle" fontSize={points.length >= 10 ? "6" : "7.5"} fontWeight="600" fill="#8391A5">{point.policies} policies</text>
                </g>
              );
            })}

            {points.length > 1 ? <polyline points={linePoints} fill="none" stroke="#163968" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
          </svg>
        </div>
      ) : (
        <div className="grid min-h-[210px] place-items-center px-4 text-[10px] font-semibold text-[#7A899E]">No trend data available.</div>
      )}
    </div>
  );
}

function HighlightRow({
  label,
  value,
  meta,
  tone = "neutral",
}: {
  label: string;
  value: string;
  meta: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const valueTone = tone === "positive" ? "text-[#14915F]" : tone === "negative" ? "text-[#D84A5E]" : "text-[#142A50]";

  return (
    <div className="flex min-h-[54px] items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[9px] font-extrabold text-[#2E4568]">{label}</p>
        <p className="mt-0.5 truncate text-[8px] font-medium text-[#8190A4]">{meta}</p>
      </div>
      <p className={`shrink-0 text-[13px] font-black tracking-[-0.02em] ${valueTone}`}>{value}</p>
    </div>
  );
}

function DashboardPanel({ iconSrc, eyebrow, title, children }: { iconSrc: string; eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#DCE5F1] bg-[#F8FAFD] shadow-[0_4px_14px_rgba(25,50,90,0.05)]">
      <div className="flex items-start gap-2.5 px-4 pb-3 pt-3.5">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center">
          <ProfessionalIcon src={iconSrc} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="text-[8px] font-black uppercase tracking-[0.09em] text-[#6685B4]">{eyebrow}</p> : null}
          <h2 className={`${eyebrow ? "mt-0.5" : ""} text-[15px] font-extrabold tracking-[-0.02em] text-[#142B50]`}>{title}</h2>
        </div>
        <Ellipsis className="h-4 w-4 text-[#2F70E5]" aria-hidden="true" />
      </div>
      {children}
    </div>
  );
}

function SnapshotCard({ label, value, href, iconSrc }: { label: string; value: number | string; href: string; iconSrc: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex min-h-[66px] items-center gap-3 rounded-lg border border-[#E3EAF4] bg-white px-3 py-2.5 shadow-[0_3px_10px_rgba(25,50,90,0.04)] transition hover:border-[#D2DDED] hover:shadow-[0_5px_14px_rgba(25,50,90,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center">
        <ProfessionalIcon src={iconSrc} size={24} />
      </span>
      <span className="min-w-0 flex-1 text-[8px] font-black uppercase tracking-[0.06em] text-[#77869C]">{label}</span>
      <span className="shrink-0 text-[18px] font-black leading-none text-[#142A50]">{value}</span>
    </Link>
  );
}
