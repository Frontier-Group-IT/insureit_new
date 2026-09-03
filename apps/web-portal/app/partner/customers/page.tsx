import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, MapPin, Phone, Search, UsersRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebCustomerSummary, listPartnerWebCustomers } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = { q?: string; page?: string };
const PAGE_SIZE = 25;

function pageNumber(value?: string) {
  const parsed = Number(value ?? "1");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function statusLabel(value: string | null) {
  return (value || "active").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
      <div className="space-y-4">
        <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Customer Book</p>
              <h2 className="mt-1 text-[23px] font-extrabold tracking-[-0.025em] text-[#142541]">Your customers</h2>
              <p className="mt-1 text-[11px] font-medium text-[#74839A]">Only customers inside your Partner-authorized commercial scope are returned.</p>
            </div>

            <form action="/partner/customers" className="flex w-full max-w-[430px] gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]" />
                <input name="q" defaultValue={q} placeholder="Search name, code, phone or email" className="h-11 w-full rounded-xl border border-[#D2DCE9] bg-white pl-10 pr-3 text-[11px] font-semibold text-[#213653] outline-none focus:border-[#3156B8]" />
              </div>
              <button type="submit" className="h-11 rounded-xl bg-[#111A35] px-4 text-[11px] font-bold text-white">Search</button>
            </form>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Summary label="Total Customers" value={summary.total_customers} />
            <Summary label="Active" value={summary.active_customers} />
            <Summary label="With Phone" value={summary.with_phone} />
            <Summary label="With Email" value={summary.with_email} />
          </div>
        </section>

        <section className="overflow-hidden rounded-[26px] border border-[#D7E0EC] bg-white shadow-[0_16px_45px_rgba(34,56,89,.07)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6ECF3] px-5 py-4 sm:px-6">
            <div>
              <p className="text-[12px] font-extrabold text-[#172846]">{q ? "Search results for “" + q + "”" : "Customer Register"}</p>
              <p className="mt-0.5 text-[10px] font-medium text-[#7A899F]">{total} scoped customer{total === 1 ? "" : "s"}</p>
            </div>
            {q ? <Link href="/partner/customers" className="text-[10.5px] font-bold text-[#3156B8]">Clear search</Link> : null}
          </div>

          {rows.length ? (
            <div className="divide-y divide-[#E8EDF4]">
              {rows.map((row) => (
                <Link key={row.customer_id} href={"/partner/customers/" + encodeURIComponent(row.customer_id)} prefetch={false} className="group grid gap-3 px-5 py-4 transition hover:bg-[#F8FAFD] sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(180px,.8fr)_minmax(140px,.65fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]"><UsersRound className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-extrabold text-[#172846]">{row.customer_name || row.company_name || "Customer"}</p>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-[#74839A]">{row.customer_code || row.company_name || row.customer_type || "Customer record"}</p>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    {row.phone ? <p className="flex items-center gap-1.5 truncate text-[10px] font-semibold text-[#536680]"><Phone className="h-3 w-3" />{row.phone}</p> : null}
                    {row.email ? <p className="flex items-center gap-1.5 truncate text-[10px] font-semibold text-[#536680]"><Mail className="h-3 w-3" />{row.email}</p> : null}
                  </div>

                  <div>
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#536680]"><MapPin className="h-3 w-3" />{[row.city, row.state].filter(Boolean).join(", ") || "Location not recorded"}</p>
                    <span className="mt-1.5 inline-flex rounded-lg bg-[#EEF3F8] px-2 py-1 text-[9px] font-bold text-[#425672]">{statusLabel(row.customer_status)}</span>
                  </div>

                  <ArrowRight className="hidden h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5 lg:block" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-5 py-14 text-center">
              <UsersRound className="mx-auto h-7 w-7 text-[#9AABC0]" />
              <p className="mt-3 text-[12px] font-bold text-[#23395D]">No customers found</p>
              <p className="mt-1 text-[10.5px] text-[#7A899F]">{q ? "Try a different scoped customer search." : "No customers are currently available in this Partner scope."}</p>
            </div>
          )}

          {(hasPrevious || hasNext) ? (
            <div className="flex items-center justify-between border-t border-[#E6ECF3] px-5 py-4 sm:px-6">
              <Link href={hasPrevious ? pageHref(page - 1) : "#"} aria-disabled={!hasPrevious} className={"inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-[10px] font-bold " + (hasPrevious ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Previous
              </Link>
              <p className="text-[10px] font-semibold text-[#74839A]">Page {page}</p>
              <Link href={hasNext ? pageHref(page + 1) : "#"} aria-disabled={!hasNext} className={"inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 text-[10px] font-bold " + (hasNext ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>
                Next <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#E1E7F0] bg-[#F8FAFD] p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#75849A]">{label}</p>
      <p className="mt-2 text-[22px] font-extrabold text-[#162746]">{value}</p>
    </div>
  );
}
