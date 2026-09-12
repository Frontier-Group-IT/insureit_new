import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeIndianRupee,
  Clock3,
  FileText,
  Search,
  ShieldCheck,
  ShieldPlus,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
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

function statusClasses(value: string | null | undefined) {
  switch ((value || "").toLowerCase()) {
    case "in_force":
      return "border-[#CDEEDC] bg-[#EAF9F1] text-[#28A96B] before:bg-[#24B874]";
    case "expiring":
      return "border-[#F7E4A7] bg-[#FFF8E6] text-[#C98A00] before:bg-[#F0AA18]";
    case "expired":
      return "border-[#F8D4DE] bg-[#FFF0F4] text-[#D8476A] before:bg-[#E75D7F]";
    case "upcoming":
      return "border-[#D6E3F6] bg-[#F1F6FD] text-[#597492] before:bg-[#7998BA]";
    default:
      return "border-[#D6E3F6] bg-[#F1F6FD] text-[#597492] before:bg-[#7998BA]";
  }
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

  const metrics = [
    { label: "Premium Booked", value: currency(summary.total_premium), icon: BadgeIndianRupee, iconWrap: "bg-[#EAF3FF] text-[#2F72DE]", cell: "bg-white", showTrend: true },
    { label: "Policies", value: summary.total_policies, icon: ShieldCheck, iconWrap: "bg-[#EEF4FF] text-[#3F7FE8]", cell: "bg-white" },
    { label: "In Force", value: summary.in_force_policies, icon: ShieldPlus, iconWrap: "bg-[#E6F8EE] text-[#28B46A]", cell: "bg-[#F3FBF7]" },
    { label: "Expiring 30d", value: summary.expiring_30_days, icon: Clock3, iconWrap: "bg-[#FFF3D8] text-[#F0A000]", cell: "bg-[#FFFAEF]" },
    { label: "Expired", value: summary.expired_policies, icon: FileText, iconWrap: "bg-[#FFE8EF] text-[#E24F73]", cell: "bg-[#FFF5F8]" },
  ];

  return (
    <PartnerPortalShell title="Policies">
      <div className="space-y-4">
        <section className="grid overflow-hidden rounded-xl border border-[#DCE5F0] bg-white shadow-[0_4px_14px_rgba(31,55,86,0.04)] sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`flex min-h-[78px] items-center gap-3 px-4 py-3 ${item.cell} ${index ? "border-t border-[#E4EAF2] sm:border-t-0 sm:border-l" : ""} ${index === 2 ? "sm:border-t xl:border-t-0" : ""} ${index === 4 ? "sm:border-t xl:border-t-0" : ""}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${item.iconWrap}`}>
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#71849E]">{item.label}</p>
                    {item.showTrend ? <span className="text-[11px] font-black text-[#37B76B]">↗</span> : null}
                  </div>
                  <p className="mt-1 truncate text-[18px] font-extrabold leading-none tracking-[-0.02em] text-[#17365D]">{item.value}</p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_5px_16px_rgba(31,55,86,0.04)]">
          <div className="flex flex-col gap-3 border-b border-[#E5EBF2] px-4 py-3 xl:flex-row xl:items-center">
            <div className="flex shrink-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#2F72DE]">
                <FileText className="h-4 w-4" />
              </span>
              <h2 className="text-[14px] font-extrabold text-[#183354]">Policy Register</h2>
            </div>

            <form action="/partner/policies" className="w-full xl:ml-3 xl:max-w-[360px]">
              {lifecycle !== "all" ? <input type="hidden" name="lifecycle" value={lifecycle} /> : null}
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7790AC]" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search policy, customer, vehicle or insurer"
                  className="h-9 w-full rounded-lg border border-[#D1DDE9] bg-white pl-9 pr-3 text-[10px] font-semibold text-[#213653] outline-none transition placeholder:text-[#91A0B4] focus:border-[#3973DD] focus:ring-2 focus:ring-[#3156B8]/10"
                />
              </div>
            </form>

            <div className="flex flex-wrap gap-1.5 xl:ml-auto">
              {lifecycles.map((item) => {
                const active = item.value === lifecycle;
                return (
                  <Link
                    key={item.value}
                    href={hrefFor({ lifecycle: item.value, page: 1 })}
                    className={
                      "rounded-lg border px-3 py-2 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " +
                      (active
                        ? "border-[#246CE0] bg-[#1670F4] text-white shadow-[0_4px_10px_rgba(22,112,244,0.14)]"
                        : "border-[#DCE4EE] bg-white text-[#58708D] hover:border-[#C7D4E5] hover:bg-[#F8FAFD]")
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <Link
              href="/partner/policy-intakes"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#103D82] px-3.5 text-[9.5px] font-bold text-white shadow-[0_5px_12px_rgba(16,61,130,0.15)] transition hover:bg-[#0B326F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25"
            >
              <FileText className="h-3.5 w-3.5" />
              Policy Intake
            </Link>

            <div className="shrink-0 border-l border-[#E3E9F0] pl-4 text-[9.5px] font-medium text-[#74839A]">
              Total records <span className="ml-1 text-[14px] font-extrabold text-[#17365D]">{total}</span>
            </div>
          </div>

          <div className="hidden grid-cols-[42px_minmax(0,1.25fr)_minmax(0,1fr)_minmax(105px,.5fr)_minmax(120px,.6fr)_minmax(100px,.5fr)_48px] items-center gap-4 bg-[#F5F8FC] px-4 py-2.5 xl:grid">
            <p className="text-[8px] font-extrabold uppercase tracking-[0.04em] text-[#6484AB]">#</p>
            <p className="text-[8px] font-extrabold uppercase tracking-[0.04em] text-[#6484AB]">Policy No. &amp; Customer</p>
            <p className="text-[8px] font-extrabold uppercase tracking-[0.04em] text-[#6484AB]">Insurer</p>
            <p className="text-[8px] font-extrabold uppercase tracking-[0.04em] text-[#6484AB]">Premium</p>
            <p className="text-[8px] font-extrabold uppercase tracking-[0.04em] text-[#6484AB]">Validity</p>
            <p className="text-[8px] font-extrabold uppercase tracking-[0.04em] text-[#6484AB]">Status</p>
            <p className="text-center text-[8px] font-extrabold uppercase tracking-[0.04em] text-[#6484AB]">Action</p>
          </div>

          {rows.length ? (
            <div className="divide-y divide-[#E8EDF4]">
              {rows.map((row, index) => (
                <Link
                  key={row.policy_id}
                  href={"/partner/policies/" + encodeURIComponent(row.policy_id)}
                  prefetch={false}
                  className="group grid gap-3 px-4 py-3 transition hover:bg-[#FBFDFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 xl:grid-cols-[42px_minmax(0,1.25fr)_minmax(0,1fr)_minmax(105px,.5fr)_minmax(120px,.6fr)_minmax(100px,.5fr)_48px] xl:items-center xl:gap-4"
                >
                  <p className="hidden text-[9px] font-semibold text-[#6E819A] xl:block">{offset + index + 1}</p>

                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#2F72DE]">
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-[10.5px] font-extrabold leading-4 text-[#1466D8]">{row.policy_no || row.policy_code || "Policy"}</p>
                      <p className="mt-0.5 break-words text-[9px] font-semibold uppercase leading-4 text-[#667D99]">{row.customer_name}</p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="break-words text-[9.5px] font-semibold leading-4 text-[#486681]">{row.insurer_name || "Insurer not recorded"}</p>
                    <p className="mt-0.5 break-words text-[8.8px] font-medium leading-4 text-[#8191A7]">{row.vehicle_no || row.policy_product || row.business_line || "Risk not linked"}</p>
                  </div>

                  <p className="text-[10px] font-extrabold text-[#1D385B]">{currency(row.premium_amount)}</p>

                  <p className="text-[9.5px] font-medium text-[#607B99]">Ends {dateLabel(row.end_date)}</p>

                  <span className={`relative inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 pl-[18px] text-[8.7px] font-bold before:absolute before:left-2 before:h-1.5 before:w-1.5 before:rounded-full before:content-[''] ${statusClasses(row.lifecycle_status)}`}>
                    {humanize(row.lifecycle_status)}
                  </span>

                  <span className="hidden h-7 w-7 place-items-center justify-self-end rounded-full bg-[#F1F6FC] text-[#5F81A8] transition group-hover:bg-[#E8F1FC] group-hover:text-[#2F6FCA] xl:grid">
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
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
            <div className="flex items-center justify-between border-t border-[#E6ECF3] px-4 py-3.5">
              <Link href={hasPrevious ? hrefFor({ page: page - 1 }) : "#"} aria-disabled={!hasPrevious} className={"inline-flex min-h-8 items-center gap-2 rounded-lg border px-3 text-[9.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasPrevious ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Previous
              </Link>
              <p className="text-[9.5px] font-semibold text-[#74839A]">Page {page}</p>
              <Link href={hasNext ? hrefFor({ page: page + 1 }) : "#"} aria-disabled={!hasNext} className={"inline-flex min-h-8 items-center gap-2 rounded-lg border px-3 text-[9.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasNext ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </PartnerPortalShell>
  );
}
