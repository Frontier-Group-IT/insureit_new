import Link from "next/link";
import { Building2, MoreVertical, ShieldCheck } from "lucide-react";
import { PartnerPagination } from "@/components/partner-portal/partner-pagination";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebCustomerSummary, listPartnerWebCustomers } from "@/lib/partner-web";
import { CustomerSearch } from "./customer-search";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = { q?: string; page?: string };
const PAGE_SIZE = 10;

function pageNumber(value?: string) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function statusLabel(value: string | null) {
  return (value || "active").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function customerTypeLabel(value: string | null) {
  if (!value) return "Customer";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function PartnerCustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const q = query.q?.trim() ?? "";
  const page = pageNumber(query.page);
  const offset = (page - 1) * PAGE_SIZE;

  const [summary, rows] = await Promise.all([
    getPartnerWebCustomerSummary(),
    listPartnerWebCustomers({ limit: PAGE_SIZE, offset, search: q }),
  ]);

  const total = rows[0]?.total_count ?? (q ? rows.length : summary.total_customers);
  const active = summary.active_customers;
  const inactive = Math.max(summary.total_customers - summary.active_customers, 0);
  const hasPrevious = page > 1;
  const hasNext = offset + rows.length < total;

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    return search ? "/partner/customers?" + search : "/partner/customers";
  };

  return (
    <PartnerPortalShell title="Customers">
      <div className="pb-4">
        <section className="overflow-hidden rounded-2xl border border-[#D9E1EC] bg-white shadow-[0_8px_24px_rgba(31,65,115,0.05)]">
          <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-4 py-3.5 xl:flex-row xl:items-center">
            <div className="flex min-w-0 shrink-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#173E6C] text-white shadow-[0_4px_10px_rgba(23,62,108,0.16)]">
                <Building2 className="h-[19px] w-[19px]" />
              </span>
              <h1 className="whitespace-nowrap text-[16px] font-extrabold tracking-[-0.025em] text-[#15233B]">Customer Portfolio</h1>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center xl:ml-5">
              <CustomerSearch initialQuery={q} />

              <div className="relative w-full sm:w-[225px] sm:shrink-0">
                <select
                  aria-label="Customer type"
                  defaultValue="all"
                  className="h-10 w-full appearance-none rounded-xl border border-[#D5DEEA] bg-white px-4 pr-9 text-[11px] font-semibold text-[#41516A] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
                >
                  <option value="all">All customer types</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#425672]">⌄</span>
              </div>
            </div>

            <div className="inline-flex h-10 shrink-0 items-center self-start rounded-xl border border-[#D5DEEA] bg-[#F7F9FC] p-1 text-[10px] font-bold text-[#667892] sm:self-auto xl:ml-3">
              <span className="inline-flex h-8 items-center rounded-lg bg-[#173E6C] px-3 text-white shadow-sm">All&nbsp; {summary.total_customers}</span>
              <span className="inline-flex h-8 items-center px-3">Active&nbsp; {active}</span>
              <span className="inline-flex h-8 items-center px-3">Inactive&nbsp; {inactive}</span>
            </div>
          </div>

          <div className="hidden grid-cols-[42px_minmax(220px,1.25fr)_minmax(170px,.85fr)_minmax(145px,.7fr)_minmax(105px,.55fr)_minmax(165px,.8fr)_52px] items-center border-b border-[#E2E8F0] bg-[#F7F9FC] px-3 py-2.5 text-[8.5px] font-black uppercase tracking-[0.045em] text-[#61728D] lg:grid">
            <span className="flex justify-center"><span className="h-4 w-4 rounded border border-[#AAB7C8] bg-white" aria-hidden="true" /></span>
            <span>Customer</span>
            <span>Customer Type</span>
            <span>Mobile</span>
            <span>Status</span>
            <span>Next Action</span>
            <span className="text-center">More</span>
          </div>

          {rows.length ? (
            <div className="divide-y divide-[#E7ECF3]">
              {rows.map((row) => {
                const activeRow = statusLabel(row.customer_status) === "Active";
                return (
                  <div
                    key={row.customer_id}
                    className="grid gap-3 px-3 py-3 transition hover:bg-[#FAFCFF] lg:grid-cols-[42px_minmax(220px,1.25fr)_minmax(170px,.85fr)_minmax(145px,.7fr)_minmax(105px,.55fr)_minmax(165px,.8fr)_52px] lg:items-center"
                  >
                    <div className="hidden justify-center lg:flex">
                      <span className="h-4 w-4 rounded border border-[#AAB7C8] bg-white" aria-hidden="true" />
                    </div>

                    <Link
                      href={"/partner/customers/" + encodeURIComponent(row.customer_id)}
                      prefetch={false}
                      className="min-w-0 text-[11px] font-extrabold text-[#17233A] transition hover:text-[#173E6C] focus-visible:outline-none focus-visible:underline"
                    >
                      <span className="block truncate">{row.customer_name || row.company_name || "Customer"}</span>
                    </Link>

                    <p className="min-w-0 truncate text-[10.5px] font-medium text-[#44546E]">{customerTypeLabel(row.customer_type)}</p>
                    <p className="min-w-0 truncate text-[10.5px] font-medium text-[#4A5B73]">{row.phone || "—"}</p>

                    <div className="min-w-0">
                      {activeRow ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#9FE6C7] bg-[#ECFBF4] px-2.5 py-1 text-[9px] font-bold text-[#13865D]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#27B27A]" aria-hidden="true" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-[#D7DEE8] bg-[#F4F6F9] px-2.5 py-1 text-[9px] font-bold text-[#63738A]">{statusLabel(row.customer_status)}</span>
                      )}
                    </div>

                    <Link
                      href={"/partner/customers/" + encodeURIComponent(row.customer_id)}
                      prefetch={false}
                      className="inline-flex min-w-0 items-center gap-1.5 text-[10.5px] font-semibold text-[#13865D] transition hover:text-[#0F6F4C] focus-visible:outline-none focus-visible:underline"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{activeRow ? "Portfolio active" : "Review portfolio"}</span>
                    </Link>

                    <Link
                      href={"/partner/customers/" + encodeURIComponent(row.customer_id)}
                      prefetch={false}
                      aria-label={`Open ${row.customer_name || row.company_name || "customer"}`}
                      className="hidden h-7 w-7 place-items-center justify-self-center rounded-lg text-[#293A54] transition hover:bg-[#EEF3F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 lg:grid"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-14 text-center">
              <Building2 className="mx-auto h-7 w-7 text-[#9AABC0]" />
              <p className="mt-3 text-[12px] font-bold text-[#23395D]">No customers found</p>
              <p className="mt-1 text-[10.5px] text-[#7A899F]">{q ? "Try a different search." : "No customers available yet."}</p>
            </div>
          )}

          <PartnerPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            previousHref={hasPrevious ? pageHref(page - 1) : null}
            nextHref={hasNext ? pageHref(page + 1) : null}
          />
        </section>
      </div>
    </PartnerPortalShell>
  );
}
