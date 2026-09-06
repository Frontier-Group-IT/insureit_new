import Link from "next/link";
import { ArrowRight, BarChart3, CalendarClock, RefreshCw, Search } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerMetricStrip, PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
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

  return (
    <PartnerPortalShell title="Renewals">
      <div className="space-y-7">
        <PartnerPageHeader
          eyebrow="Renewal Pipeline"
          title="Upcoming and overdue renewals"
          description="Track upcoming and overdue renewals."
        />

        <PartnerMetricStrip
          items={[
            { label: "Overdue", value: summary.overdue_count, meta: currency(summary.overdue_premium) },
            { label: "Due 0–7 Days", value: summary.due_0_7_count, meta: currency(summary.due_0_7_premium) },
            { label: "Due 8–15 Days", value: summary.due_8_15_count, meta: currency(summary.due_8_15_premium) },
            { label: "Due 16–30 Days", value: summary.due_16_30_count, meta: currency(summary.due_16_30_premium) },
          ]}
        />

        <div className="grid gap-3 xl:grid-cols-2">
          <Link href="/partner/renewals/external" prefetch={false} className="group flex items-center gap-3 border-y border-[#DCE4ED] py-3.5 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><CalendarClock className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-extrabold text-[#1B2F4E]">External Renewal Opportunities</span>
              <span className="mt-0.5 block text-[9.5px] font-medium leading-4 text-[#74839A]">Retarget customers with policies held outside INSUREIT.</span>
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#3156B8]">Open</span>
            <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
          </Link>
          <Link href="/partner/renewals/external/reporting" prefetch={false} className="group flex items-center gap-3 border-y border-[#DCE4ED] py-3.5 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><BarChart3 className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-extrabold text-[#1B2F4E]">External Renewal Reporting</span>
              <span className="mt-0.5 block text-[9.5px] font-medium leading-4 text-[#74839A]">Review contact, quote, conversion and verified premium results.</span>
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#3156B8]">View</span>
            <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
          </Link>
        </div>

        <section>
          <div className="border-y border-[#DCE4ED] py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex gap-2">
                <Link href={hrefFor({ mode: "due", window: "all", page: 1 })} className={"rounded-lg px-3 py-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (mode === "due" ? "bg-[#3156B8] text-white" : "border border-[#D8E0EA] bg-white text-[#4D617D]")}>Due</Link>
                <Link href={hrefFor({ mode: "expired", window: "all", page: 1 })} className={"rounded-lg px-3 py-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (mode === "expired" ? "bg-[#3156B8] text-white" : "border border-[#D8E0EA] bg-white text-[#4D617D]")}>Expired</Link>
              </div>
              <form action="/partner/renewals" className="flex w-full gap-2 xl:max-w-[450px]">
                {mode !== "due" ? <input type="hidden" name="mode" value={mode} /> : null}
                {window !== "all" && mode === "due" ? <input type="hidden" name="window" value={window} /> : null}
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]" />
                  <input name="q" defaultValue={q} placeholder="Search customer, policy, vehicle or insurer" className="h-9 w-full rounded-lg border border-[#CCD7E4] bg-white pl-9 pr-3 text-[10px] font-semibold text-[#213653] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10" />
                </div>
                <button className="h-9 rounded-lg bg-[#111A35] px-3.5 text-[10px] font-bold text-white transition hover:bg-[#1B2A50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25" type="submit">Search</button>
              </form>
            </div>

            {mode === "due" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(["all","0_7","8_15","16_30"] as PartnerRenewalWindow[]).map((value) => (
                  <Link key={value} href={hrefFor({ window: value, page: 1 })} className={"rounded-lg px-2.5 py-1.5 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (window === value ? "bg-[#E9F0FF] text-[#3156B8]" : "bg-[#F4F6F9] text-[#657792]")}>
                    {value === "all" ? "All 30 Days" : value.replace("_", "–") + " Days"}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-5"><PartnerSectionHeading title={mode === "expired" ? "Expired Policies" : "Renewal Worklist"} description={rows.length + " shown · " + total + " matched"} /></div>
          <div className="mt-3 border-y border-[#DCE4ED]">

          {rows.length ? (
            <div className="divide-y divide-[#E8EDF4]">
              {rows.map((row) => (
                <Link key={row.policy_id} href={"/partner/policies/" + encodeURIComponent(row.policy_id)} prefetch={false} className="group grid gap-3 px-1 py-3.5 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-4 sm:py-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(140px,.65fr)_minmax(110px,.55fr)_auto] xl:items-center">
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
            <div className="py-14 text-center">
              <RefreshCw className="mx-auto h-7 w-7 text-[#9AABC0]" />
              <p className="mt-3 text-[12px] font-bold text-[#23395D]">No renewals found</p>
              <p className="mt-1 text-[10.5px] text-[#7A899F]">Try another search or renewal window.</p>
            </div>
          )}

          {(hasPrevious || hasNext) ? (
            <div className="flex items-center justify-between border-t border-[#E6ECF3] py-4">
              <Link href={hasPrevious ? hrefFor({ page: page - 1 }) : "#"} aria-disabled={!hasPrevious} className={"inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasPrevious ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>
                Previous
              </Link>
              <p className="text-[10px] font-semibold text-[#74839A]">Page {page}</p>
              <Link href={hasNext ? hrefFor({ page: page + 1 }) : "#"} aria-disabled={!hasNext} className={"inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasNext ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}
