import Link from "next/link";
import { ArrowLeft, ArrowRight, Search, ShieldCheck } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerMetricStrip, PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerWebPolicySummary, listPartnerWebPolicies, type PartnerPolicyLifecycle } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;
const lifecycles: Array<{ value: PartnerPolicyLifecycle; label: string }> = [
  { value: "all", label: "All" },
  { value: "in_force", label: "In Force" },
  { value: "expiring", label: "Expiring" },
  { value: "expired", label: "Expired" },
  { value: "upcoming", label: "Upcoming" },
];

function currency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? value + "T00:00:00" : value);
  return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function humanize(value: string | null | undefined) {
  return (value || "not recorded").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function validLifecycle(value?: string): PartnerPolicyLifecycle {
  return lifecycles.some((item) => item.value === value) ? value as PartnerPolicyLifecycle : "all";
}

function pageNumber(value?: string) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default async function PartnerPoliciesPage({ searchParams }: { searchParams: Promise<{ q?: string; lifecycle?: string; page?: string }> }) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const lifecycle = validLifecycle(query.lifecycle);
  const page = pageNumber(query.page);
  const offset = (page - 1) * PAGE_SIZE;

  const [summary, rows] = await Promise.all([
    getPartnerWebPolicySummary(),
    listPartnerWebPolicies({ limit: PAGE_SIZE, offset, search: q, lifecycle }),
  ]);

  const total = rows[0]?.total_count ?? 0;
  const hasPrevious = page > 1;
  const hasNext = offset + rows.length < total;

  const hrefFor = (next: { lifecycle?: PartnerPolicyLifecycle; page?: number }) => {
    const params = new URLSearchParams();
    const nextLifecycle = next.lifecycle ?? lifecycle;
    const nextPage = next.page ?? 1;
    if (q) params.set("q", q);
    if (nextLifecycle !== "all") params.set("lifecycle", nextLifecycle);
    if (nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    return search ? "/partner/policies?" + search : "/partner/policies";
  };

  return (
    <PartnerPortalShell title="Policies">
      <div className="space-y-7">
        <PartnerPageHeader
          eyebrow="Policy Book"
          title="Your policies"
          description="View your policy portfolio."
          action={<Link href="/partner/policy-intakes" className="inline-flex h-9 items-center rounded-lg bg-[#111A35] px-3.5 text-[10px] font-bold text-white">Policy Intake</Link>}
        />

        <PartnerMetricStrip
          columns={5}
          items={[
            { label: "Premium Booked", value: currency(summary.total_premium) },
            { label: "Policies", value: summary.total_policies },
            { label: "In Force", value: summary.in_force_policies },
            { label: "Expiring 30d", value: summary.expiring_30_days },
            { label: "Expired", value: summary.expired_policies },
          ]}
        />

        <section>
          <div className="border-y border-[#DCE4ED] py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <form action="/partner/policies" className="flex w-full gap-2 xl:max-w-[500px]">
                {lifecycle !== "all" ? <input type="hidden" name="lifecycle" value={lifecycle} /> : null}
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]" />
                  <input name="q" defaultValue={q} placeholder="Search policy, customer, vehicle or insurer" className="h-9 w-full rounded-lg border border-[#CCD7E4] bg-white pl-9 pr-3 text-[10px] font-semibold text-[#213653] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10" />
                </div>
                <button className="h-9 rounded-lg bg-[#111A35] px-3.5 text-[10px] font-bold text-white transition hover:bg-[#1B2A50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25" type="submit">Search</button>
              </form>

              <div className="flex flex-wrap gap-2">
                {lifecycles.map((item) => {
                  const active = item.value === lifecycle;
                  return <Link key={item.value} href={hrefFor({ lifecycle: item.value, page: 1 })} className={"rounded-lg px-3 py-2 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (active ? "bg-[#3156B8] text-white" : "border border-[#D8E0EA] bg-white text-[#4D617D]")}>{item.label}</Link>;
                })}
              </div>
            </div>
          </div>

          <div className="mt-5"><PartnerSectionHeading title="Policy Register" description={total + " records"} /></div>
          <div className="mt-3 border-y border-[#DCE4ED]">

          {rows.length ? (
            <div className="divide-y divide-[#E8EDF4]">
              {rows.map((row) => (
                <Link key={row.policy_id} href={"/partner/policies/" + encodeURIComponent(row.policy_id)} prefetch={false} className="group grid gap-3 px-1 py-3.5 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-4 sm:py-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(140px,.65fr)_minmax(120px,.55fr)_auto] xl:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><ShieldCheck className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-[11.5px] font-extrabold text-[#1B2F4E]">{row.policy_no || row.policy_code || "Policy"}</p>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-[#74839A]">{row.customer_name}</p>
                    </div>
                  </div>
                  <div>
                    <p className="truncate text-[10px] font-semibold text-[#536680]">{row.insurer_name || "Insurer not recorded"}</p>
                    <p className="mt-0.5 truncate text-[9.5px] text-[#7F8EA4]">{row.vehicle_no || row.policy_product || row.business_line || "Risk not linked"}</p>
                  </div>
                  <div>
                    <p className="text-[10.5px] font-extrabold text-[#203653]">{currency(row.premium_amount)}</p>
                    <p className="mt-0.5 text-[9px] text-[#8190A5]">Ends {dateLabel(row.end_date)}</p>
                  </div>
                  <span className="inline-flex w-fit rounded-lg bg-[#EEF3F8] px-2 py-1 text-[9px] font-bold text-[#425672]">{humanize(row.lifecycle_status)}</span>
                  <ArrowRight className="hidden h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5 xl:block" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center">
              <ShieldCheck className="mx-auto h-7 w-7 text-[#9AABC0]" />
              <p className="mt-3 text-[12px] font-bold text-[#23395D]">No policies found</p>
              <p className="mt-1 text-[10.5px] text-[#7A899F]">Try another search term or lifecycle filter.</p>
            </div>
          )}

          {(hasPrevious || hasNext) ? (
            <div className="flex items-center justify-between border-t border-[#E6ECF3] py-4">
              <Link href={hasPrevious ? hrefFor({ page: page - 1 }) : "#"} aria-disabled={!hasPrevious} className={"inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasPrevious ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Previous
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

