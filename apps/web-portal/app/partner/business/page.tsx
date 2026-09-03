import Link from "next/link";
import { ArrowRight, CalendarRange, TrendingDown, TrendingUp } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
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
  const performance = await getPartnerWebBusinessPerformance();
  const hasRange = validIsoDate(query.from) && validIsoDate(query.to) && String(query.from) <= String(query.to);
  const range = hasRange ? await getPartnerWebBusinessRange(String(query.from), String(query.to)) : null;

  const premiumNow = Number(performance.premium_this_month || 0);
  const premiumLast = Number(performance.premium_last_month || 0);
  const change = Number(performance.premium_change_percent || 0);
  const maxTrend = Math.max(1, ...performance.trend.map((item) => Number(item.premium || 0)));

  return (
    <PartnerPortalShell title="My Business">
      <div className="space-y-4">
        <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">{humanize(performance.scope_mode)} Scope</p>
              <h2 className="mt-1 text-[23px] font-extrabold tracking-[-0.025em] text-[#142541]">Business performance</h2>
              <p className="mt-1 text-[11px] font-medium text-[#72809A]">Partner-authorized performance from the same business contracts used by INSUREIT Partner.</p>
            </div>
            <form className="flex flex-wrap items-end gap-2" action="/partner/business">
              <label className="grid gap-1">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#72809A]">From</span>
                <input name="from" type="date" defaultValue={query.from ?? ""} className="h-10 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[11px] font-semibold text-[#213653] outline-none focus:border-[#3156B8]" />
              </label>
              <label className="grid gap-1">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[#72809A]">To</span>
                <input name="to" type="date" defaultValue={query.to ?? ""} className="h-10 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[11px] font-semibold text-[#213653] outline-none focus:border-[#3156B8]" />
              </label>
              <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#111A35] px-4 text-[11px] font-bold text-white">
                <CalendarRange className="h-4 w-4" /> Apply
              </button>
            </form>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Gross Premium" value={currency(premiumNow)} meta={monthLabel(performance.current_month)} />
            <Metric label="Policies" value={performance.policies_this_month} meta={String(performance.total_policies) + " lifetime"} />
            <Metric label="Customers" value={performance.total_customers} meta="Scoped customer book" />
            <Metric label="Lifetime Premium" value={currency(performance.lifetime_gross_premium)} meta="Recorded business" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#E1E7F0] bg-[#F8FAFD] px-4 py-3">
            <span className={"grid h-9 w-9 place-items-center rounded-xl " + (change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
              {change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-[11px] font-extrabold text-[#1A2D4B]">
                {premiumLast > 0 ? Math.abs(change).toFixed(1) + "% " + (change >= 0 ? "higher" : "lower") + " than last month" : "New business baseline"}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-[#74839A]">Previous month premium: {currency(premiumLast)}</p>
            </div>
          </div>
        </section>

        {range ? (
          <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Selected Range</p>
                <h2 className="mt-1 text-[18px] font-extrabold text-[#152746]">{range.from_date} to {range.to_date}</h2>
              </div>
              <Link href="/partner/business" className="text-[10.5px] font-bold text-[#3156B8]">Clear range</Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Premium" value={currency(range.premium)} meta={Number(range.premium_change_percent || 0).toFixed(1) + "% vs previous"} />
              <Metric label="Policies" value={range.policies} meta="Issued in range" />
              <Metric label="Customers" value={range.customers} meta="Customers in range" />
              <Metric label="Renewals" value={range.renewals} meta="Renewal activity" />
              <Metric label="Claims" value={range.claims} meta="Claim activity" />
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Business Trend</p>
            <h2 className="mt-1 text-[18px] font-extrabold text-[#152746]">Last six months</h2>
            <div className="mt-5 flex min-h-[220px] items-end gap-3 overflow-x-auto pb-2">
              {performance.trend.map((item) => {
                const premium = Number(item.premium || 0);
                const height = Math.max(18, Math.round((premium / maxTrend) * 150));
                return (
                  <div key={item.month} className="flex min-w-[78px] flex-1 flex-col items-center">
                    <p className="mb-2 text-center text-[9px] font-bold text-[#667892]">{currency(premium)}</p>
                    <div className="flex h-[154px] w-full items-end justify-center rounded-xl bg-[#F3F6FA] px-2 pb-2">
                      <div className="w-full max-w-[42px] rounded-lg bg-[#3156B8]" style={{ height }} />
                    </div>
                    <p className="mt-2 text-[10px] font-bold text-[#223755]">{shortMonth(item.month)}</p>
                    <p className="text-[9px] text-[#8190A5]">{item.policies} policies</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Business Mix</p>
            <h2 className="mt-1 text-[18px] font-extrabold text-[#152746]">Current month</h2>
            <div className="mt-4 space-y-4">
              {performance.business_mix.length ? performance.business_mix.slice(0, 6).map((item) => {
                const premium = Number(item.premium || 0);
                const percent = premiumNow > 0 ? Math.min(100, (premium / premiumNow) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[11px] font-bold text-[#203653]">{humanize(item.label)}</p>
                      <p className="shrink-0 text-[10px] font-semibold text-[#677A94]">{currency(premium)} · {item.policies}</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EDF1F6]">
                      <div className="h-full rounded-full bg-[#3156B8]" style={{ width: String(percent) + "%" }} />
                    </div>
                  </div>
                );
              }) : <p className="py-8 text-center text-[11px] font-medium text-[#74839A]">No business mix recorded for this month.</p>}
            </div>
          </section>
        </div>

        <section className="grid gap-3 sm:grid-cols-3">
          <Action href="/partner/customers" title="Customer Book" subtitle="Open scoped customers" />
          <Action href="/partner/policies" title="Policy Register" subtitle="Review policy portfolio" />
          <Action href="/partner/renewals" title="Renewal Pipeline" subtitle="Open due and overdue business" />
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function Metric({ label, value, meta }: { label: string; value: string | number; meta: string }) {
  return (
    <div className="rounded-2xl border border-[#E1E7F0] bg-[#F8FAFD] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#75849A]">{label}</p>
      <p className="mt-2 truncate text-[21px] font-extrabold tracking-[-0.025em] text-[#162746]">{value}</p>
      <p className="mt-1 text-[9.5px] font-medium text-[#8190A5]">{meta}</p>
    </div>
  );
}

function Action({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} prefetch={false} className="group flex min-h-[84px] items-center justify-between rounded-[22px] border border-[#D7E0EC] bg-white px-4 py-4 shadow-[0_12px_35px_rgba(34,56,89,.06)]">
      <span>
        <span className="block text-[12px] font-extrabold text-[#172846]">{title}</span>
        <span className="mt-0.5 block text-[10px] font-medium text-[#74839A]">{subtitle}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
    </Link>
  );
}
