import Link from "next/link";
import { ArrowRight, CalendarRange, TrendingDown, TrendingUp } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerDivider, PartnerMetricStrip, PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
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

  return (
    <PartnerPortalShell title="My Business">
      <div className="space-y-7">
        <PartnerPageHeader
          eyebrow={humanize(performance.scope_mode) + " Scope"}
          title="Business performance"
          description="Review your business performance."
          action={
            <form className="flex flex-wrap items-end gap-2" action="/partner/business">
              <label className="grid gap-1">
                <span className="text-[8.5px] font-black uppercase tracking-[0.09em] text-[#74839A]">From</span>
                <input name="from" type="date" defaultValue={query.from ?? ""} className="h-9 rounded-lg border border-[#CCD7E4] bg-white px-2.5 text-[10px] font-semibold text-[#213653] outline-none focus:border-[#3156B8]" />
              </label>
              <label className="grid gap-1">
                <span className="text-[8.5px] font-black uppercase tracking-[0.09em] text-[#74839A]">To</span>
                <input name="to" type="date" defaultValue={query.to ?? ""} className="h-9 rounded-lg border border-[#CCD7E4] bg-white px-2.5 text-[10px] font-semibold text-[#213653] outline-none focus:border-[#3156B8]" />
              </label>
              <button type="submit" className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#111A35] px-3.5 text-[10px] font-bold text-white">
                <CalendarRange className="h-3.5 w-3.5" /> Apply
              </button>
            </form>
          }
        />

        <PartnerMetricStrip
          items={[
            { label: "Gross Premium", value: currency(premiumNow), meta: monthLabel(performance.current_month) },
            { label: "Policies", value: performance.policies_this_month, meta: performance.total_policies + " lifetime" },
            { label: "Customers", value: performance.total_customers, meta: "Scoped customer book" },
            { label: "Lifetime Premium", value: currency(performance.lifetime_gross_premium), meta: "Recorded business" },
          ]}
        />

        <div className="flex items-center gap-3">
          <span className={"grid h-8 w-8 place-items-center rounded-xl " + (change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
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
          <section>
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

        <PartnerDivider />

        <div className="grid gap-8 xl:grid-cols-[1.15fr_.85fr]">
          <section>
            <PartnerSectionHeading eyebrow="Business Trend" title="Last six months" />
            <div className="mt-4 flex min-h-[220px] items-end gap-3 overflow-x-auto border-b border-[#DCE4ED] pb-4">
              {performance.trend.map((item) => {
                const premium = Number(item.premium || 0);
                const height = Math.max(18, Math.round((premium / maxTrend) * 150));
                return (
                  <div key={item.month} className="flex min-w-[74px] flex-1 flex-col items-center">
                    <p className="mb-2 text-center text-[8.5px] font-bold text-[#667892]">{currency(premium)}</p>
                    <div className="flex h-[154px] w-full items-end justify-center px-2">
                      <div className="w-full max-w-[34px] rounded-t-md bg-[#3156B8]" style={{ height }} />
                    </div>
                    <p className="mt-2 text-[9.5px] font-bold text-[#223755]">{shortMonth(item.month)}</p>
                    <p className="text-[8.5px] text-[#8190A5]">{item.policies} policies</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <PartnerSectionHeading eyebrow="Business Mix" title="Current month" />
            <div className="mt-4 divide-y divide-[#E0E7EF] border-y border-[#DCE4ED]">
              {performance.business_mix.length ? performance.business_mix.slice(0, 6).map((item) => {
                const premium = Number(item.premium || 0);
                const percent = premiumNow > 0 ? Math.min(100, (premium / premiumNow) * 100) : 0;
                return (
                  <div key={item.label} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[10.5px] font-bold text-[#203653]">{humanize(item.label)}</p>
                      <p className="shrink-0 text-[9.5px] font-semibold text-[#677A94]">{currency(premium)} · {item.policies}</p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E8EDF3]">
                      <div className="h-full rounded-full bg-[#3156B8]" style={{ width: String(percent) + "%" }} />
                    </div>
                  </div>
                );
              }) : <p className="py-8 text-center text-[10.5px] font-medium text-[#74839A]">No business mix recorded for this month.</p>}
            </div>
          </section>
        </div>

        <PartnerDivider />

        <section>
          <PartnerSectionHeading eyebrow="Workspaces" title="Continue working" />
          <div className="mt-3 grid divide-y divide-[#E0E7EF] border-y border-[#DCE4ED] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Action href="/partner/customers" title="Customer Book" subtitle="Open scoped customers" />
            <Action href="/partner/policies" title="Policy Register" subtitle="Review policy portfolio" />
            <Action href="/partner/renewals" title="Renewal Pipeline" subtitle="Open due and overdue business" />
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function Action({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} prefetch={false} className="group flex min-h-[72px] items-center justify-between px-1 py-3.5 transition hover:bg-white/70 sm:px-4">
      <span>
        <span className="block text-[11px] font-extrabold text-[#172846]">{title}</span>
        <span className="mt-0.5 block text-[9.5px] font-medium text-[#74839A]">{subtitle}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
    </Link>
  );
}
