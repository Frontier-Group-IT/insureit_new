import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  Crown,
  FileText,
  TrendingDown,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerMetricStrip, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerWebBusinessPerformance, getPartnerWebBusinessRange } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BusinessSearchParams = { from?: string; to?: string };

function currency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
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

export default async function PartnerBusinessPage({ searchParams }: { searchParams: Promise<BusinessSearchParams> }) {
  const query = await searchParams;
  const hasRange = validIsoDate(query.from) && validIsoDate(query.to) && String(query.from) <= String(query.to);
  const [performance, range] = await Promise.all([
    getPartnerWebBusinessPerformance(),
    hasRange ? getPartnerWebBusinessRange(String(query.from), String(query.to)) : Promise.resolve(null),
  ]);

  const premiumNow = Number(performance.premium_this_month || 0);
  const premiumLast = Number(performance.premium_last_month || 0);
  const change = Number(performance.premium_change_percent || 0);
  const maxTrend = Math.max(1, ...performance.trend.map((item) => Number(item.premium || 0)));

  const metrics = [
    { label: "Gross Premium", value: currency(premiumNow), meta: monthLabel(performance.current_month), tone: "blue" as const, icon: Crown },
    { label: "Policies", value: performance.policies_this_month, meta: performance.total_policies + " lifetime", tone: "green" as const, icon: FileText },
    { label: "Customers", value: performance.total_customers, meta: "Scoped customer book", tone: "purple" as const, icon: UsersRound },
    { label: "Lifetime Premium", value: currency(performance.lifetime_gross_premium), meta: "Recorded business", tone: "orange" as const, icon: WalletCards },
  ];

  return (
    <PartnerPortalShell title="My Business">
      <div className="space-y-4 pb-3">
        <section className="relative isolate overflow-hidden rounded-xl bg-gradient-to-r from-[#0A2F7A] via-[#0758BE] to-[#4A7BF0] px-5 py-2.5 text-white shadow-[0_6px_18px_rgba(20,61,130,0.12)]">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -left-16 top-0 h-full w-[46%] rounded-r-[48%] bg-[#074BAA]/70" />
            <div className="absolute right-[25%] top-0 h-full w-[24%] bg-gradient-to-r from-transparent via-cyan-300/25 to-transparent" />
            <div className="absolute inset-y-0 right-0 w-[33%] bg-gradient-to-l from-[#7F73F6]/25 to-transparent" />
          </div>

          <div className="relative z-10 flex min-h-[78px] items-center justify-between gap-4">
            <div className="max-w-[43%]">
              <p className="text-[7.5px] font-black uppercase tracking-[0.15em] text-white/72">{humanize(performance.scope_mode)} Scope</p>
              <h1 className="mt-0.5 text-[20px] font-extrabold leading-tight tracking-[-0.03em] text-white">Business performance</h1>
              <p className="mt-0.5 text-[9.5px] font-medium leading-4 text-white/80">Review your business performance at a glance.</p>
            </div>

            <div className="pointer-events-none absolute bottom-0 left-[54%] hidden h-[92px] w-[150px] -translate-x-1/2 items-end justify-center lg:flex" aria-hidden="true">
              <Image
                src="/assets/Custom-Icons/optimized-128/fleet-vehicle.png"
                alt=""
                width={128}
                height={128}
                className="h-[88px] w-[104px] object-contain drop-shadow-[0_9px_14px_rgba(0,22,72,0.3)]"
                priority
              />
            </div>

            <form className="relative z-10 flex flex-wrap items-center gap-1.5 rounded-full border border-[#D5E4F8] bg-[#E2EEFE] p-1.5 pl-2.5 shadow-sm backdrop-blur-sm" action="/partner/business">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F8FBFF] text-[#3156B8]">
                <CalendarRange className="h-3.5 w-3.5" />
              </span>
              <label className="grid gap-0">
                <span className="text-[6.5px] font-black uppercase tracking-[0.08em] text-[#7786A0]">From</span>
                <input name="from" type="date" defaultValue={query.from ?? ""} className="h-5 w-[112px] border-0 bg-transparent px-0 text-[8.5px] font-bold text-[#203653] outline-none" />
              </label>
              <div className="h-6 w-px bg-[#C7D7ED]" />
              <label className="grid gap-0">
                <span className="text-[6.5px] font-black uppercase tracking-[0.08em] text-[#7786A0]">To</span>
                <input name="to" type="date" defaultValue={query.to ?? ""} className="h-5 w-[112px] border-0 bg-transparent px-0 text-[8.5px] font-bold text-[#203653] outline-none" />
              </label>
              <button type="submit" className="inline-flex h-8 items-center rounded-full bg-[#0A3D93] px-3.5 text-[8.5px] font-extrabold text-white transition hover:bg-[#082F72] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                Apply
              </button>
            </form>
          </div>
        </section>

        <section className="grid overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)] sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <BusinessMetricCard key={metric.label} {...metric} />
          ))}
        </section>

        <div className="flex items-center gap-3 rounded-xl border border-[#E5EAF1] bg-white px-4 py-3 shadow-[0_3px_12px_rgba(24,52,90,0.04)]">
          <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-full " + (change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
            {change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-[10.5px] font-extrabold text-[#1A2D4B]">
              {premiumLast > 0 ? Math.abs(change).toFixed(1) + "% " + (change >= 0 ? "higher" : "lower") + " than last month" : "New business baseline"}
            </p>
            <p className="mt-0.5 text-[9.5px] font-medium text-[#8190A5]">Previous month premium: {currency(premiumLast)}</p>
          </div>
        </div>

        {range ? (
          <section className="rounded-xl border border-[#DCE5F1] bg-white p-4 shadow-[0_4px_14px_rgba(25,50,90,0.04)]">
            <PartnerSectionHeading
              eyebrow="Selected Range"
              title={range.from_date + " to " + range.to_date}
              action={<Link href="/partner/business" className="text-[10px] font-bold text-[#3156B8]">Clear range</Link>}
            />
            <div className="mt-3">
              <PartnerMetricStrip
                columns={5}
                items={[
                  { label: "Premium", value: currency(range.premium), meta: Number(range.premium_change_percent || 0).toFixed(1) + "% vs previous" },
                  { label: "Policies", value: range.policies, meta: "Issued in range" },
                  { label: "Customers", value: range.customers, meta: "Customers in range" },
                  { label: "Renewals", value: range.renewals, meta: "Renewal activity" },
                  { label: "Claims", value: range.claims, meta: "Claim activity" },
                ]}
              />
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.18fr_.82fr]">
          <div className="rounded-xl border border-[#DCE5F1] bg-white p-4 shadow-[0_4px_14px_rgba(25,50,90,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.09em] text-[#6685B4]">Business Trend</p>
                <h2 className="mt-0.5 text-[15px] font-extrabold tracking-[-0.02em] text-[#142B50]">Last six months</h2>
              </div>
              <div className="rounded-full border border-[#E0E7F0] bg-[#FAFBFD] px-3 py-1.5 text-[8.5px] font-bold text-[#61728A]">Gross Premium</div>
            </div>

            <div className="mt-3 flex min-h-[205px] items-end gap-2 overflow-x-auto border-t border-[#EEF2F6] pt-3">
              {performance.trend.map((item) => {
                const premium = Number(item.premium || 0);
                const height = Math.max(8, Math.round((premium / maxTrend) * 128));
                return (
                  <div key={item.month} className="flex min-w-[66px] flex-1 flex-col items-center">
                    <p className="mb-1.5 text-center text-[8px] font-extrabold text-[#526B91]">{currency(premium)}</p>
                    <div className="flex h-[132px] w-full items-end justify-center px-2">
                      <div className="w-full max-w-[34px] rounded-t-md bg-gradient-to-t from-[#176FE5] to-[#6A39EE] shadow-[0_5px_10px_rgba(58,86,185,0.16)]" style={{ height }} />
                    </div>
                    <p className="mt-1.5 text-[9px] font-extrabold text-[#223755]">{shortMonth(item.month)}</p>
                    <p className="text-[7.5px] text-[#8190A5]">{item.policies} policies</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[#D8EADF] bg-gradient-to-br from-[#F7FCFA] to-[#EDF9F4] p-4 shadow-[0_4px_14px_rgba(25,50,90,0.05)]">
            <div className="flex items-start gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#DDF6EC] text-[#21A874]">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.09em] text-[#5C8D79]">Business Mix</p>
                <h2 className="mt-0.5 text-[15px] font-extrabold tracking-[-0.02em] text-[#142B50]">Current month</h2>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {performance.business_mix.length ? performance.business_mix.slice(0, 6).map((item) => {
                const premium = Number(item.premium || 0);
                const percent = premiumNow > 0 ? Math.min(100, (premium / premiumNow) * 100) : 0;
                return (
                  <div key={item.label} className="rounded-lg border border-[#E2E9F1] bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(25,50,90,0.03)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="break-words text-[10px] font-extrabold leading-4 text-[#203653]">{humanize(item.label)}</p>
                      <p className="shrink-0 text-[9px] font-bold text-[#627692]">{currency(premium)} · {item.policies}</p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E8EDF3]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#4D45E5] to-[#1592E7]" style={{ width: String(percent) + "%" }} />
                    </div>
                  </div>
                );
              }) : <p className="rounded-lg border border-[#E2E9F1] bg-white py-8 text-center text-[10px] font-medium text-[#74839A]">No business mix recorded for this month.</p>}
            </div>
          </div>
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

type MetricTone = "blue" | "green" | "purple" | "orange";
type IconType = typeof Crown;

const metricToneClasses: Record<MetricTone, { card: string; icon: string }> = {
  blue: { card: "border-[#D4E4F8] bg-gradient-to-br from-[#F7FBFF] to-[#EAF6FF]", icon: "bg-[#E9F0FF] text-[#356BE8]" },
  green: { card: "border-[#D4EBDD] bg-gradient-to-br from-[#F7FCFA] to-[#E8F8EF]", icon: "bg-[#DCF7EA] text-[#20B879]" },
  purple: { card: "border-[#E1D9F6] bg-gradient-to-br from-[#FBFAFF] to-[#F1EBFF]", icon: "bg-[#EEE6FF] text-[#7C4DDC]" },
  orange: { card: "border-[#F1E1C4] bg-gradient-to-br from-[#FFFDF9] to-[#FFF2DD]", icon: "bg-[#FFF0D7] text-[#F59A18]" },
};

function BusinessMetricCard({ label, value, meta, tone, icon: Icon }: { label: string; value: number | string; meta: string; tone: MetricTone; icon: IconType }) {
  const classes = metricToneClasses[tone];
  return (
    <div className="relative flex min-h-[84px] items-center gap-3 border-b border-[#E8EDF3] px-4 py-3 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(n+3)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${classes.icon}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-black leading-none tracking-[-0.025em] text-[#142A50]">{value}</p>
        <p className="mt-1.5 text-[7.5px] font-black uppercase tracking-[0.08em] text-[#50637F]">{label}</p>
        <p className="mt-1 text-[8px] font-medium text-[#7A899E]">{meta}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#6D7D96]" />
    </div>
  );
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