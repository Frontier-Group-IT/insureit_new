import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarClock, CalendarDays, Clock3, ExternalLink, RefreshCw, Search } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebRenewalSummary, listPartnerWebRenewals, type PartnerRenewalMode, type PartnerRenewalWindow } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;

function currency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}
function dateLabel(value: string | null) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? value + "T00:00:00" : value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function daysUntil(value: string | null) {
  if (!value) return 9999;
  const end = new Date(value + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}
function renewalLabel(value: string | null) {
  const days = daysUntil(value);
  if (days === 9999) return "No expiry";
  if (days < 0) return String(Math.abs(days)) + "d overdue";
  if (days === 0) return "Due today";
  return String(days) + "d left";
}
function validMode(value?: string): PartnerRenewalMode { return value === "expired" ? "expired" : "due"; }
function validWindow(value?: string): PartnerRenewalWindow { return value === "0_7" || value === "8_15" || value === "16_30" ? value : "all"; }
function pageNumber(value?: string) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default async function PartnerRenewalsPage({ searchParams }: { searchParams: Promise<{ q?: string; mode?: string; window?: string; page?: string }> }) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const mode = validMode(query.mode);
  const window = validWindow(query.window);
  const page = pageNumber(query.page);
  const offset = (page - 1) * PAGE_SIZE;

  const [summary, rows] = await Promise.all([
    getPartnerWebRenewalSummary(),
    listPartnerWebRenewals({ limit: PAGE_SIZE, offset, search: q, mode, window }),
  ]);

  const total = rows[0]?.total_count ?? 0;
  const hasPrevious = page > 1;
  const hasNext = offset + rows.length < total;
  const hrefFor = (next: { mode?: PartnerRenewalMode; window?: PartnerRenewalWindow; page?: number }) => {
    const params = new URLSearchParams();
    const nextMode = next.mode ?? mode;
    const nextWindow = next.window ?? window;
    const nextPage = next.page ?? 1;
    if (q) params.set("q", q);
    if (nextMode !== "due") params.set("mode", nextMode);
    if (nextWindow !== "all" && nextMode === "due") params.set("window", nextWindow);
    if (nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    return search ? "/partner/renewals?" + search : "/partner/renewals";
  };

  const metricItems = [
    { label: "Overdue", value: summary.overdue_count, meta: currency(summary.overdue_premium), icon: Clock3, card: "border-[#D7E7F8] bg-[#F2F8FF]", iconWrap: "bg-[#DDEEFF] text-[#3156B8]" },
    { label: "Due 0–7 Days", value: summary.due_0_7_count, meta: currency(summary.due_0_7_premium), icon: CalendarDays, card: "border-[#D8EFE6] bg-[#F1FBF6]", iconWrap: "bg-[#DDF7EB] text-[#1AA572]" },
    { label: "Due 8–15 Days", value: summary.due_8_15_count, meta: currency(summary.due_8_15_premium), icon: CalendarDays, card: "border-[#E7DFFC] bg-[#F8F4FF]", iconWrap: "bg-[#EEE6FF] text-[#7650D8]" },
    { label: "Due 16–30 Days", value: summary.due_16_30_count, meta: currency(summary.due_16_30_premium), icon: CalendarDays, card: "border-[#F4E5C8] bg-[#FFF9EE]", iconWrap: "bg-[#FFF0D3] text-[#E99515]" },
  ];

  return (
    <PartnerPortalShell title="Renewals">
      <div data-partner-renewals-reference-page="true" className="space-y-4 pb-4">
        <section
          data-partner-renewals-reference-hero="true"
          className="relative isolate overflow-hidden rounded-xl border border-[#CFE1F4] bg-[linear-gradient(105deg,#E9F5FF_0%,#E8F5FF_54%,#DDEEFF_100%)] px-4 py-4 shadow-[0_5px_16px_rgba(31,91,158,0.07)] sm:px-5"
        >
          <div className="relative z-10 flex min-h-[72px] items-center gap-4 pr-20 sm:pr-32">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#1377EE] text-white shadow-[0_5px_14px_rgba(19,119,238,0.24)]">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.08em] text-[#2F66C9]">
                <CalendarDays className="h-3 w-3" /> Renewal Pipeline
              </p>
              <h1 className="mt-1 text-[20px] font-extrabold tracking-[-0.03em] text-[#142B50] sm:text-[22px]">Upcoming and overdue renewals</h1>
              <p className="mt-1 text-[10px] font-medium text-[#687E9E]">Track upcoming and overdue renewals.</p>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[34%] overflow-hidden" aria-hidden="true">
            <span className="absolute -bottom-14 right-6 h-36 w-36 rounded-full bg-[#C9E8FF]/70" />
            <span className="absolute -right-3 top-4 h-16 w-16 rounded-full bg-[#DDF3FF]/80" />
            <span className="absolute bottom-3 right-24 h-12 w-2 rotate-[24deg] rounded-full bg-[#B7DDF5]/45" />
            <span className="absolute bottom-4 right-20 h-7 w-2 -rotate-[28deg] rounded-full bg-[#AED8F1]/50" />
            <Image src="/assets/Custom-Icons/optimized-128/renewal.png" alt="" width={128} height={128} className="absolute bottom-[-14px] right-4 h-[104px] w-[104px] object-contain opacity-95 sm:right-8" priority />
          </div>
        </section>

        <section data-partner-renewals-reference-metrics="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`flex min-h-[92px] items-center gap-3 rounded-xl border px-4 py-3 shadow-[0_4px_14px_rgba(37,61,103,0.045)] ${item.card}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${item.iconWrap}`}><Icon className="h-[18px] w-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] font-black uppercase tracking-[0.07em] text-[#526987]">{item.label}</p>
                  <p className="mt-1 text-[18px] font-black leading-none tracking-[-0.03em] text-[#142A50]">{item.value}</p>
                  <p className="mt-1.5 text-[9px] font-medium text-[#7D8CA1]">{item.meta}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[#526987]" />
              </div>
            );
          })}
        </section>

        <section data-partner-renewals-reference-actions="true" className="grid gap-3 xl:grid-cols-2">
          <Link href="/partner/renewals/external" prefetch={false} className="group flex min-h-[66px] items-center gap-3 rounded-xl border border-[#D8E8F8] bg-[#F1F8FF] px-4 py-3 shadow-[0_4px_14px_rgba(37,61,103,0.04)] transition hover:border-[#C4DDF5] hover:bg-[#ECF6FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#DDEEFF] text-[#2F70E5]"><ExternalLink className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10.5px] font-extrabold text-[#1B2F4E]">External Renewal Opportunities</span>
              <span className="mt-0.5 block text-[9px] font-medium leading-4 text-[#74839A]">Retarget customers with policies held outside INSUREIT.</span>
            </span>
            <span className="rounded-full bg-[#E6F1FF] px-2.5 py-1 text-[8.5px] font-black uppercase tracking-[0.07em] text-[#2563D8]">Open</span>
            <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
          </Link>
          <Link href="/partner/renewals/external/reporting" prefetch={false} className="group flex min-h-[66px] items-center gap-3 rounded-xl border border-[#E7E0F8] bg-[#F8F5FF] px-4 py-3 shadow-[0_4px_14px_rgba(37,61,103,0.04)] transition hover:border-[#D9CEF4] hover:bg-[#F5F0FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7650D8]/20">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEE6FF] text-[#7650D8]"><BarChart3 className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10.5px] font-extrabold text-[#1B2F4E]">External Renewal Reporting</span>
              <span className="mt-0.5 block text-[9px] font-medium leading-4 text-[#74839A]">Review contact, quote, conversion and verified premium results.</span>
            </span>
            <span className="rounded-full bg-[#EEE8FF] px-2.5 py-1 text-[8.5px] font-black uppercase tracking-[0.07em] text-[#6E49CF]">View</span>
            <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
          </Link>
        </section>

        <section data-partner-renewals-reference-filters="true" className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="inline-flex w-fit gap-2">
              <Link href={hrefFor({ mode: "due", window: "all", page: 1 })} className={"min-w-[64px] rounded-lg px-4 py-2 text-center text-[10px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (mode === "due" ? "bg-[#166EF0] text-white shadow-[0_4px_10px_rgba(22,110,240,0.18)]" : "border border-[#D9E2EC] bg-white text-[#425672]")}>Due</Link>
              <Link href={hrefFor({ mode: "expired", window: "all", page: 1 })} className={"min-w-[72px] rounded-lg px-4 py-2 text-center text-[10px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (mode === "expired" ? "bg-[#166EF0] text-white shadow-[0_4px_10px_rgba(22,110,240,0.18)]" : "border border-[#D9E2EC] bg-white text-[#425672]")}>Expired</Link>
            </div>
            <form action="/partner/renewals" className="flex w-full gap-2 xl:max-w-[470px]">
              {mode !== "due" ? <input type="hidden" name="mode" value={mode} /> : null}
              {window !== "all" && mode === "due" ? <input type="hidden" name="window" value={window} /> : null}
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]" />
                <input name="q" defaultValue={q} placeholder="Search customer, policy, vehicle or insurer" className="h-9 w-full rounded-lg border border-[#CCD7E4] bg-white pl-9 pr-3 text-[10px] font-semibold text-[#213653] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10" />
              </div>
              <button className="h-9 rounded-lg bg-[#111A35] px-4 text-[10px] font-bold text-white transition hover:bg-[#1B2A50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25" type="submit">Search</button>
            </form>
          </div>

          {mode === "due" ? (
            <div className="flex flex-wrap gap-2">
              {(["all", "0_7", "8_15", "16_30"] as PartnerRenewalWindow[]).map((value) => (
                <Link key={value} href={hrefFor({ window: value, page: 1 })} className={"rounded-full px-3 py-1.5 text-[8.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (window === value ? "bg-[#E5F0FF] text-[#2866CC]" : "bg-[#F2F5F9] text-[#657792]")}>
                  {value === "all" ? "All 30 Days" : value.replace("_", "–") + " Days"}
                </Link>
              ))}
            </div>
          ) : null}
        </section>

        <section data-partner-renewals-reference-worklist="true" className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_16px_rgba(37,61,103,0.045)]">
          <div className="flex items-center gap-3 border-b border-[#E7EDF4] px-4 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#3156B8]"><CalendarClock className="h-4 w-4" /></span>
            <div className="min-w-0">
              <h2 className="text-[12px] font-extrabold text-[#1B2F4E]">{mode === "expired" ? "Expired Policies" : "Renewal Worklist"}</h2>
              <p className="mt-0.5 text-[9px] font-medium text-[#8190A5]">{rows.length} shown · {total} matched</p>
            </div>
          </div>

          {rows.length ? (
            <div className="divide-y divide-[#E8EDF4]">
              {rows.map((row) => (
                <Link key={row.policy_id} href={"/partner/policies/" + encodeURIComponent(row.policy_id)} prefetch={false} className="group grid gap-3 px-4 py-3.5 transition hover:bg-[#FAFCFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:py-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(140px,.65fr)_minmax(110px,.55fr)_auto] xl:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><RefreshCw className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="break-words text-[11.5px] font-extrabold leading-4 text-[#1B2F4E]">{row.customer_name}</p>
                      <p className="mt-0.5 break-words text-[10px] font-medium leading-4 text-[#74839A]">{row.policy_no || row.policy_code || "Policy"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="break-words text-[10px] font-semibold leading-4 text-[#536680]">{row.insurer_name || "Insurer not recorded"}</p>
                    <p className="mt-0.5 break-words text-[9.5px] leading-4 text-[#7F8EA4]">{row.vehicle_no || row.policy_product || "Risk not linked"}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-extrabold text-[#203653]">{currency(row.premium_amount)}</p>
                    <p className="mt-0.5 text-[9px] text-[#8190A5]">Ends {dateLabel(row.end_date)}</p>
                  </div>
                  <span className="inline-flex w-fit rounded-lg bg-[#EEF3F8] px-2 py-1 text-[9px] font-bold text-[#425672]">{renewalLabel(row.end_date)}</span>
                  <ArrowRight className="hidden h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5 xl:block" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="relative grid min-h-[190px] place-items-center overflow-hidden px-4 py-8 text-center">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F5FAFF]" aria-hidden="true" />
              <div className="relative z-10">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#F3F8FF] shadow-[0_5px_16px_rgba(49,86,184,0.08)]">
                  <Image src="/assets/Custom-Icons/optimized-128/renewal.png" alt="" width={128} height={128} className="h-11 w-11 object-contain" />
                </span>
                <p className="mt-3 text-[12px] font-extrabold text-[#23395D]">No renewals found</p>
                <p className="mt-1 text-[9.5px] font-medium text-[#7A899F]">Try adjusting your filters or check back later.</p>
              </div>
            </div>
          )}

          {(hasPrevious || hasNext) ? (
            <div className="flex items-center justify-between border-t border-[#E6ECF3] px-4 py-3.5">
              <Link href={hasPrevious ? hrefFor({ page: page - 1 }) : "#"} aria-disabled={!hasPrevious} className={"inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasPrevious ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>Previous</Link>
              <p className="text-[10px] font-semibold text-[#74839A]">Page {page}</p>
              <Link href={hasNext ? hrefFor({ page: page + 1 }) : "#"} aria-disabled={!hasNext} className={"inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasNext ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>Next <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          ) : null}
        </section>
      </div>
    </PartnerPortalShell>
  );
}
