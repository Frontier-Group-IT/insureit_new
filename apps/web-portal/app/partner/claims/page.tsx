import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FileText, Search, ShieldAlert } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebClaimSummary, listPartnerWebClaims, type PartnerClaimState } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;
const states: Array<{ value: PartnerClaimState; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

function currency(value: number | string | null | undefined) {
  if (value == null) return "Amount not recorded";
  const amount = Number(value);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}
function dateLabel(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function humanize(value: string | null | undefined) {
  return (value || "not recorded").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function validState(value?: string): PartnerClaimState {
  return states.some((item) => item.value === value) ? value as PartnerClaimState : "all";
}
function pageNumber(value?: string) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default async function PartnerClaimsPage({ searchParams }: { searchParams: Promise<{ q?: string; state?: string; page?: string }> }) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const state = validState(query.state);
  const page = pageNumber(query.page);
  const offset = (page - 1) * PAGE_SIZE;

  const [summary, rows] = await Promise.all([
    getPartnerWebClaimSummary(),
    listPartnerWebClaims({ limit: PAGE_SIZE, offset, search: q, state }),
  ]);

  const total = rows[0]?.total_count ?? 0;
  const hasPrevious = page > 1;
  const hasNext = offset + rows.length < total;

  const hrefFor = (next: { state?: PartnerClaimState; page?: number }) => {
    const params = new URLSearchParams();
    const nextState = next.state ?? state;
    const nextPage = next.page ?? 1;
    if (q) params.set("q", q);
    if (nextState !== "all") params.set("state", nextState);
    if (nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    return search ? "/partner/claims?" + search : "/partner/claims";
  };

  const metricItems = [
    { label: "Claims", value: summary.total_claims, icon: FileText, iconWrap: "bg-[#EAF3FF] text-[#3156B8]" },
    { label: "Active", value: summary.active_claims, icon: CheckCircle2, iconWrap: "bg-[#E7F8F0] text-[#1AA572]" },
    { label: "Completed", value: summary.completed_claims, icon: CheckCircle2, iconWrap: "bg-[#F0E9FF] text-[#7650D8]" },
    { label: "Assistance", value: summary.assistance_requested, icon: Clock3, iconWrap: "bg-[#FFF2DD] text-[#E99515]" },
  ];

  return (
    <PartnerPortalShell title="Claims">
      <div className="space-y-4 pb-4">
        <section className="overflow-hidden rounded-xl border border-[#DCE5F0] bg-white shadow-[0_3px_12px_rgba(37,61,103,0.04)]">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            {metricItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className={`flex min-h-[72px] items-center gap-3 px-4 py-3 ${index ? "border-t border-[#E6ECF3] sm:border-t-0 sm:border-l" : ""} ${index === 2 ? "sm:border-t xl:border-t-0" : ""}`}>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${item.iconWrap}`}><Icon className="h-[18px] w-[18px]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-black leading-none tracking-[-0.03em] text-[#142A50]">{item.value}</p>
                    <p className="mt-1.5 text-[7.5px] font-black uppercase tracking-[0.07em] text-[#6A7A90]">{item.label}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#6D7D96]" />
                </div>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_16px_rgba(37,61,103,0.045)]">
          <div className="flex flex-col gap-3 border-b border-[#E7EDF4] px-4 py-3 xl:flex-row xl:items-center">
            <div className="flex shrink-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#3156B8]"><FileText className="h-4 w-4" /></span>
              <h2 className="text-[12px] font-extrabold text-[#1B2F4E]">Your claims</h2>
            </div>

            <form action="/partner/claims" className="w-full xl:ml-3 xl:max-w-[470px]">
              {state !== "all" ? <input type="hidden" name="state" value={state} /> : null}
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]" />
                <input name="q" defaultValue={q} placeholder="Search claim, customer, vehicle or policy" className="h-9 w-full rounded-lg border border-[#CCD7E4] bg-white pl-9 pr-3 text-[10px] font-semibold text-[#213653] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10" />
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
              {states.map((item) => (
                <Link key={item.value} href={hrefFor({ state: item.value, page: 1 })} className={"rounded-lg px-3 py-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (item.value === state ? "bg-[#166EF0] text-white shadow-[0_4px_10px_rgba(22,110,240,0.18)]" : "border border-[#D8E0EA] bg-white text-[#4D617D]")}>{item.label}</Link>
              ))}
              <span className="ml-1 hidden h-6 w-px bg-[#E1E7EF] sm:block" aria-hidden="true" />
              <p className="shrink-0 text-[9.5px] font-medium text-[#74839A]">Total recorded <span className="ml-1 text-[13px] font-black text-[#172846]">{total}</span></p>
            </div>
          </div>

          {rows.length ? (
            <div className="divide-y divide-[#E8EDF4]">
              {rows.map((row) => {
                const amount = row.settlement_amount ?? row.approved_amount ?? row.estimated_loss;
                return (
                  <Link key={row.claim_id} href={"/partner/claims/" + encodeURIComponent(row.claim_id)} prefetch={false} className="group grid gap-3 px-4 py-3 transition hover:bg-[#FAFCFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(140px,.65fr)_minmax(120px,.55fr)_auto] xl:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FFF6E7] text-[#B56A00]"><ShieldAlert className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="break-words text-[11.5px] font-extrabold leading-4 text-[#1B2F4E]">{row.claim_no || "Claim"}</p>
                        <p className="mt-0.5 break-words text-[10px] font-medium leading-4 text-[#74839A]">{row.customer_name}</p>
                      </div>
                    </div>
                    <div>
                      <p className="break-words text-[10px] font-semibold leading-4 text-[#536680]">{row.insurer_name || "Insurer not recorded"}</p>
                      <p className="mt-0.5 break-words text-[9.5px] leading-4 text-[#7F8EA4]">{[row.vehicle_no || "Vehicle not linked", row.policy_no || "External policy"].join(" · ")}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] font-extrabold text-[#203653]">{currency(amount)}</p>
                      <p className="mt-0.5 text-[9px] text-[#8190A5]">{dateLabel(row.accident_at || row.created_at)}</p>
                    </div>
                    <span className="inline-flex w-fit rounded-lg bg-[#EEF3F8] px-2 py-1 text-[9px] font-bold text-[#425672]">{humanize(row.current_status || row.claim_state)}</span>
                    <ArrowRight className="hidden h-4 w-4 text-[#315A91] transition group-hover:translate-x-0.5 xl:block" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-14 text-center">
              <ShieldAlert className="mx-auto h-7 w-7 text-[#9AABC0]" />
              <p className="mt-3 text-[12px] font-bold text-[#23395D]">No claims found</p>
              <p className="mt-1 text-[10.5px] text-[#7A899F]">No claims match this search or filter.</p>
            </div>
          )}

          {(hasPrevious || hasNext) ? (
            <div className="flex items-center justify-between border-t border-[#E6ECF3] px-4 py-3.5">
              <Link href={hasPrevious ? hrefFor({ page: page - 1 }) : "#"} aria-disabled={!hasPrevious} className={"inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasPrevious ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Previous
              </Link>
              <p className="text-[10px] font-semibold text-[#74839A]">Page {page}</p>
              <Link href={hasNext ? hrefFor({ page: page + 1 }) : "#"} aria-disabled={!hasNext} className={"inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasNext ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </PartnerPortalShell>
  );
}
