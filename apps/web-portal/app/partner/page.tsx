import Image from "next/image";
import Link from "next/link";
import {
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
import { PartnerBusinessTrend, type TrendPeriod, type TrendPoint } from "./partner-business-trend";

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
  const currentMonth = businessPerformance.current_month;
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
  const [twelveMonthTrend, mtdWeeklyTrend] = await Promise.all([
    twelveMonthTrendPromise,
    mtdWeeklyTrendPromise,
  ]);
  const trendPoints: TrendPoint[] = trendPeriod === "12m"
    ? twelveMonthTrend
    : trendPeriod === "mtd"
      ? mtdWeeklyTrend
      : businessPerformance.trend.slice(-6);
  const trendPeriodLabel = trendPeriodOptions.find((option) => option.value === trendPeriod)?.label ?? "Last 6 Months";

  const name = identity.actor_kind === "intermediary"
    ? identity.associate_name?.trim() || identity.display_name?.trim() || "Partner"
    : identity.display_name?.trim() || "Partner";
  const updatedTime = formatUpdatedTime(new Date());
  const schemeDeadline = activeScheme ? formatSchemeDeadline(activeScheme.ends_at) : null;
  const payoutValue = payout.available ? formatIndianCurrency(payout.paid_amount) : "Restricted";
  const payoutMeta = payout.available ? `${payout.paid_count} paid records` : "Commercial visibility restricted";
  const payoutOutstandingValue = payout.available ? formatIndianCurrency(payout.pending_amount) : "Restricted";
  const payoutOutstandingMeta = payout.available ? `${payout.pending_count} pending records` : "Commercial visibility restricted";
  const premiumAtRisk = [
    renewalSummary.due_0_7_premium,
    renewalSummary.due_8_15_premium,
    renewalSummary.due_16_30_premium,
  ].reduce<number>((total, value) => {
    const amount = Number(value ?? 0);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const partnerFamilyCount = network.scope_mode === "self"
    ? network.partners.length
    : network.partners.filter((row) => !(row as typeof row & { parent_partner_id?: string | null }).parent_partner_id).length;

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
                className="partner-active-scheme group relative inline-flex items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl px-3 py-2 text-[9.5px] font-semibold transition focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className="partner-active-scheme__shimmer pointer-events-none absolute inset-y-[-35%] left-0 w-16 rotate-12"
                />
                <BadgePercent className="partner-active-scheme__icon relative h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="partner-active-scheme__name relative max-w-[220px] truncate font-extrabold">{activeScheme.name}</span>
                <span className="partner-active-scheme__separator relative">·</span>
                <span className="relative">Valid till {schemeDeadline.date}</span>
                <span className="partner-active-scheme__separator relative">·</span>
                <span className="relative">{schemeDeadline.time}</span>
                <ArrowRight className="partner-active-scheme__arrow relative h-3.5 w-3.5 shrink-0 transition duration-300 group-hover:translate-x-1.5" aria-hidden="true" />
              </Link>
            ) : null}
            <span className="hidden whitespace-nowrap text-[10px] font-medium text-[#7A899E]">Updated {updatedTime}</span>
          </div>
        </section>

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Families"
            value={partnerFamilyCount}
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

        <section>
          <PartnerBusinessTrend
            trend={trendPoints}
            period={trendPeriod}
            periodLabel={trendPeriodLabel}
            iconSrc={homeIcons.business}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <DashboardPanel
            iconSrc={homeIcons.priority}
            title="Priority work"
          >
            <div className="space-y-2 px-4 pb-4">
              {home.today.length
                ? home.today.slice(0, 6).map((item, index) => (
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
                : null}

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
              <SnapshotCard label="Follow-ups Due" value={externalRenewals.follow_up_due_count} href="/partner/renewals/external?mode=follow_up&follow_up=due" iconSrc={homeIcons.priority} />
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