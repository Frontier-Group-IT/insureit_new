import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarClock, RefreshCw, Search } from "lucide-react";
import { PartnerPagination } from "@/components/partner-portal/partner-pagination";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { listPartnerWebRenewals, type PartnerRenewalMode, type PartnerRenewalWindow } from "@/lib/partner-web";

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

  const rows = await listPartnerWebRenewals({ limit: PAGE_SIZE, offset, search: q, mode, window });

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
    <PartnerPortalShell title="Internal Renewal">
      <div data-partner-renewals-reference-page="true" className="pb-4">
        <section data-partner-renewals-reference-worklist="true" className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_16px_rgba(37,61,103,0.045)]">
          <div className="flex flex-col gap-3 border-b border-[#E7EDF4] px-4 py-3 xl:flex-row xl:items-center">
            <div className="flex shrink-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#3156B8]"><CalendarClock className="h-4 w-4" /></span>
              <div className="min-w-0">
                <h2 className="text-[12px] font-extrabold text-[#1B2F4E]">{mode === "expired" ? "Expired Policies" : "Renewal Worklist"}</h2>
                <p className="mt-0.5 text-[9px] font-medium text-[#8190A5]">{rows.length} shown · {total} matched</p>
              </div>
            </div>

            <form action="/partner/renewals" className="w-full xl:ml-3 xl:max-w-[430px]">
              {mode !== "due" ? <input type="hidden" name="mode" value={mode} /> : null}
              {window !== "all" && mode === "due" ? <input type="hidden" name="window" value={window} /> : null}
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]" />
                <input name="q" defaultValue={q} placeholder="Search customer, policy, vehicle or insurer" className="h-9 w-full rounded-lg border border-[#CCD7E4] bg-white pl-9 pr-3 text-[10px] font-semibold text-[#213653] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10" />
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-1.5 xl:ml-auto xl:justify-end">
              {mode === "due" ? (
                <>
                  {(["all", "0_7", "8_15", "16_30"] as PartnerRenewalWindow[]).map((value) => (
                    <Link key={value} href={hrefFor({ window: value, page: 1 })} className={"rounded-full px-3 py-1.5 text-[8.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (window === value ? "bg-[#E5F0FF] text-[#2866CC]" : "bg-[#F2F5F9] text-[#657792]")}>
                      {value === "all" ? "All 30 Days" : value.replace("_", "–") + " Days"}
                    </Link>
                  ))}
                </>
              ) : null}
              <Link href={hrefFor({ mode: "due", window: "all", page: 1 })} className={"min-w-[64px] rounded-lg px-4 py-2 text-center text-[10px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (mode === "due" ? "bg-[#166EF0] text-white shadow-[0_4px_10px_rgba(22,110,240,0.18)]" : "border border-[#D9E2EC] bg-white text-[#425672]")}>Due</Link>
              <Link href={hrefFor({ mode: "expired", window: "all", page: 1 })} className={"min-w-[72px] rounded-lg px-4 py-2 text-center text-[10px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (mode === "expired" ? "bg-[#166EF0] text-white shadow-[0_4px_10px_rgba(22,110,240,0.18)]" : "border border-[#D9E2EC] bg-white text-[#425672]")}>Expired</Link>
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
            <div className="relative grid min-h-[300px] place-items-center overflow-hidden px-4 py-8 text-center">
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

          <PartnerPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            previousHref={hasPrevious ? hrefFor({ page: page - 1 }) : null}
            nextHref={hasNext ? hrefFor({ page: page + 1 }) : null}
          />
        </section>
      </div>
    </PartnerPortalShell>
  );
}
