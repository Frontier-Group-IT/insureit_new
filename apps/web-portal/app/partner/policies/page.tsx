import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  FileText,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { PartnerPagination } from "@/components/partner-portal/partner-pagination";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import {
  getPartnerWebPolicySummary,
  listPartnerWebPolicies,
  type PartnerPolicyLifecycle,
} from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;
const lifecycles: Array<{ value: PartnerPolicyLifecycle; label: string }> = [
  { value: "all", label: "All Policies" },
  { value: "in_force", label: "In Force" },
  { value: "expiring", label: "Expiring" },
  { value: "expired", label: "Expired" },
  { value: "upcoming", label: "Upcoming" },
];

function currency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(d);
}

function humanize(value: string | null | undefined) {
  return (value || "not recorded")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function validLifecycle(value?: string): PartnerPolicyLifecycle {
  return lifecycles.some((item) => item.value === value)
    ? (value as PartnerPolicyLifecycle)
    : "all";
}

function pageNumber(value?: string) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function statusClasses(value: string | null | undefined) {
  switch ((value || "").toLowerCase()) {
    case "in_force":
      return "border-[#AEE8CF] bg-[#ECFBF5] text-[#168B5A] before:bg-[#23B879]";
    case "expiring":
      return "border-[#F2DB96] bg-[#FFF9E7] text-[#B57900] before:bg-[#E6A313]";
    case "expired":
      return "border-[#F0C8D3] bg-[#FFF2F5] text-[#CA4263] before:bg-[#DE5B79]";
    case "upcoming":
      return "border-[#CFDDF1] bg-[#F2F6FC] text-[#557391] before:bg-[#7596B7]";
    default:
      return "border-[#CFDDF1] bg-[#F2F6FC] text-[#557391] before:bg-[#7596B7]";
  }
}

function policyProduct(type: string | null, product: string | null, businessLine: string | null) {
  const main = businessLine || type || "Policy";
  const detail = product || type;
  return { main: humanize(main), detail: detail && detail !== main ? humanize(detail) : null };
}

function riskLabel(vehicleNo: string | null, policyProductValue: string | null) {
  return vehicleNo || policyProductValue || "Risk not linked";
}

export default async function PartnerPoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lifecycle?: string; page?: string }>;
}) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const lifecycle = validLifecycle(query.lifecycle);
  const page = pageNumber(query.page);
  const offset = (page - 1) * PAGE_SIZE;

  const [rows, summary] = await Promise.all([
    listPartnerWebPolicies({ limit: PAGE_SIZE, offset, search: q, lifecycle }),
    getPartnerWebPolicySummary(),
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
    return search ? `/partner/policies?${search}` : "/partner/policies";
  };

  const resetHref = lifecycle === "all" && !q ? "/partner/policies" : "/partner/policies";

  return (
    <PartnerPortalShell title="Policies">
      <section className="overflow-hidden rounded-[18px] border border-[#D9E3EE] bg-white shadow-[0_10px_30px_rgba(29,54,86,0.06)]">
        <div className="flex flex-col gap-3 border-b border-[#E4EAF1] px-4 py-3 xl:flex-row xl:items-center">
          <div className="flex shrink-0 items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#103D6B] text-white shadow-[0_5px_12px_rgba(16,61,107,0.16)]">
              <FileText className="h-5 w-5" />
            </span>
            <h2 className="whitespace-nowrap text-[18px] font-extrabold tracking-[-0.02em] text-[#14243A]">
              Policy Portfolio
            </h2>
          </div>

          <form action="/partner/policies" className="w-full xl:ml-2 xl:max-w-[470px]">
            {lifecycle !== "all" ? <input type="hidden" name="lifecycle" value={lifecycle} /> : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71849D]" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search policy, customer, insurer, RM or vehicle"
                className="h-11 w-full rounded-[12px] border border-[#D5DFEA] bg-white pl-10 pr-3 text-[11px] font-semibold text-[#22364E] outline-none transition placeholder:text-[#8E9DB0] focus:border-[#7B96B7] focus:ring-2 focus:ring-[#3156B8]/10"
              />
            </div>
          </form>

          <div className="flex min-w-0 flex-wrap items-stretch gap-0 overflow-hidden rounded-[14px] border border-[#DCE5EF] bg-[#F8FAFD] xl:ml-auto">
            <Link
              href="/partner/policy-intakes"
              className="flex min-h-11 items-center gap-2 border-r border-[#DCE5EF] px-3 text-[#183A64] transition hover:bg-white"
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#EAF1FF] text-[#2E6BD1]">
                <ClipboardList className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="block text-[9.5px] font-extrabold">Policy Intake</span>
                <span className="block text-[7.5px] font-semibold uppercase tracking-[0.04em] text-[#8190A4]">Pending queue</span>
              </span>
            </Link>

            <div className="flex min-h-11 items-center gap-2 border-r border-[#DCE5EF] px-3">
              <span className="text-[8.5px] font-bold text-[#667A92]">In Force</span>
              <span className="grid h-7 min-w-7 place-items-center rounded-lg border border-[#D6E1EC] bg-white px-1.5 text-[11px] font-extrabold text-[#304861]">
                {summary.in_force_policies}
              </span>
            </div>

            <div className="flex min-h-11 items-center gap-2 px-3">
              <span className="text-[8.5px] font-bold text-[#B26F1D]">Expiring</span>
              <span className="grid h-7 min-w-7 place-items-center rounded-lg border border-[#F0D79B] bg-[#FFF8E8] px-1.5 text-[11px] font-extrabold text-[#AA6711]">
                {summary.expiring_30_days}
              </span>
            </div>
          </div>

          <Link
            href="/partner/policy-intakes"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-[#103D6B] px-4 text-[10px] font-extrabold text-white shadow-[0_5px_14px_rgba(16,61,107,0.18)] transition hover:bg-[#0A315A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25"
          >
            <span className="text-[17px] font-medium leading-none">+</span>
            Policy Intake
          </Link>
        </div>

        <div className="flex flex-col gap-2 border-b border-[#E4EAF1] bg-[#FBFCFE] px-4 py-2.5 xl:flex-row xl:items-center">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                form="partner-policy-filter"
                name="lifecycle"
                defaultValue={lifecycle}
                className="h-10 min-w-[210px] appearance-none rounded-[11px] border border-[#D7E0EA] bg-white pl-3 pr-9 text-[10px] font-bold text-[#344A63] outline-none focus:border-[#8099B8]"
              >
                {lifecycles.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#677C94]" />
            </div>

            <form id="partner-policy-filter" action="/partner/policies" className="contents">
              {q ? <input type="hidden" name="q" value={q} /> : null}
              <button
                type="submit"
                className="h-10 rounded-[11px] border border-[#D7E0EA] bg-white px-4 text-[9px] font-extrabold text-[#536A84] transition hover:bg-[#F5F8FC]"
              >
                Apply
              </button>
            </form>

            <Link
              href={resetHref}
              aria-label="Reset policy filters"
              className="grid h-10 w-10 place-items-center rounded-[11px] border border-[#D7E0EA] bg-white text-[#5D7590] transition hover:bg-[#F5F8FC]"
            >
              <RotateCcw className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-0 overflow-hidden rounded-[12px] border border-[#D9E3EC] bg-[#F7F9FC] xl:ml-auto">
            {lifecycles.map((item) => {
              const count = item.value === "all"
                ? summary.total_policies
                : item.value === "in_force"
                  ? summary.in_force_policies
                  : item.value === "expiring"
                    ? summary.expiring_30_days
                    : item.value === "expired"
                      ? summary.expired_policies
                      : summary.upcoming_policies;
              const active = item.value === lifecycle;
              return (
                <Link
                  key={item.value}
                  href={hrefFor({ lifecycle: item.value, page: 1 })}
                  className={`flex h-10 items-center gap-1.5 border-r border-[#D9E3EC] px-3 text-[8.5px] font-bold last:border-r-0 ${active ? "bg-[#0D7166] text-white" : "text-[#61748B] hover:bg-white"}`}
                >
                  <span>{item.label.replace(" Policies", "")}</span>
                  <span className={active ? "text-white/85" : "text-[#304A67]"}>{count}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="hidden grid-cols-[1.05fr_1.05fr_.9fr_1.05fr_.85fr_.62fr_.7fr_.82fr_42px] items-center gap-4 border-b border-[#DFE6EE] bg-[#F4F7FA] px-4 py-2.5 xl:grid">
          {[
            "Policy / Product",
            "Customer",
            "Risk / Asset",
            "Insurer",
            "Validity",
            "Status",
            "Gross Premium",
            "Source",
            "",
          ].map((label, index) => (
            <p key={`${label}-${index}`} className="text-[8px] font-extrabold uppercase tracking-[0.035em] text-[#637B96]">{label}</p>
          ))}
        </div>

        {rows.length ? (
          <div className="divide-y divide-[#E4EAF1]">
            {rows.map((row) => {
              const product = policyProduct(row.policy_type, row.policy_product, row.business_line);
              return (
                <Link
                  key={row.policy_id}
                  href={`/partner/policies/${encodeURIComponent(row.policy_id)}`}
                  prefetch={false}
                  className="group grid gap-3 px-4 py-2.5 transition hover:bg-[#FBFDFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 xl:grid-cols-[1.05fr_1.05fr_.9fr_1.05fr_.85fr_.62fr_.7fr_.82fr_42px] xl:items-center xl:gap-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[10.5px] font-extrabold text-[#182C43]">
                      {product.main}
                      {product.detail ? <span className="font-semibold text-[#5E7085]"> · {product.detail}</span> : null}
                    </p>
                    <p className="mt-0.5 truncate text-[8.5px] font-semibold text-[#6F8195]">{row.policy_no || row.policy_code || "Policy number pending"}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-bold text-[#34475D]">{row.customer_name}</p>
                    <p className="mt-0.5 truncate text-[8px] font-medium text-[#8391A3]">Customer account</p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.02em] text-[#40536A]">{riskLabel(row.vehicle_no, row.policy_product)}</p>
                    <p className="mt-0.5 truncate text-[8px] font-medium text-[#8794A4]">{row.vehicle_no ? "Vehicle" : "Policy risk"}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[9.5px] font-semibold text-[#52657A]">{row.insurer_name || "Insurer not recorded"}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[9.5px] font-bold leading-4 text-[#334860]">{dateLabel(row.start_date)} - {dateLabel(row.end_date)}</p>
                  </div>

                  <span className={`relative inline-flex w-fit items-center rounded-full border px-2.5 py-1 pl-[18px] text-[8.5px] font-bold before:absolute before:left-2 before:h-1.5 before:w-1.5 before:rounded-full before:content-[''] ${statusClasses(row.lifecycle_status)}`}>
                    {row.lifecycle_status === "in_force" ? "Active" : humanize(row.lifecycle_status)}
                  </span>

                  <p className="text-right text-[10px] font-extrabold text-[#263B53] xl:text-left">{currency(row.premium_amount)}</p>

                  <div className="min-w-0">
                    <p className="truncate text-[9px] font-bold text-[#4A6077]">{row.rm_name || row.intermediary_group_name || "Partner"}</p>
                    <p className="mt-0.5 truncate text-[7.8px] font-medium text-[#8391A3]">{row.intermediary_code || row.intermediary_type || "Direct"}</p>
                  </div>

                  <span className="hidden h-7 w-7 place-items-center justify-self-end rounded-full bg-[#EEF4FA] text-[#6484A5] transition group-hover:bg-[#E3EDF8] group-hover:text-[#275E9A] xl:grid">
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="py-14 text-center">
            <ShieldCheck className="mx-auto h-7 w-7 text-[#9AABC0]" />
            <p className="mt-3 text-[12px] font-bold text-[#23395D]">No policies found</p>
            <p className="mt-1 text-[10.5px] text-[#7A899F]">Try another search term or lifecycle filter.</p>
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
    </PartnerPortalShell>
  );
}
