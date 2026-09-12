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
      <div className="space-y-7">
        <div className="grid overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)] sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Total Customers" value={summary.total_customers} icon={<UsersRound className="h-5 w-5 text-[#3156B8]" />} />
          <SummaryMetric label="Active" value={summary.active_customers} icon={<span className="text-[20px] font-bold leading-none text-[#16A36A]">✓</span>} />
          <SummaryMetric label="With Phone" value={summary.with_phone} icon={<Phone className="h-5 w-5 text-[#6D42D8]" />} />
          <SummaryMetric label="With Email" value={summary.with_email} icon={<Mail className="h-5 w-5 text-[#F59E0B]" />} />
        </div>

        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex shrink-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#2563EB]">
                <UsersRound className="h-5 w-5" />
              </span>
              <h2 className="text-[15px] font-extrabold leading-5 text-[#172846]">Customer Register</h2>
            </div>

            <form action="/partner/customers" className="w-full sm:ml-3 sm:max-w-[620px]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]" />
                <input name="q" defaultValue={q} placeholder="Search name, code, phone or email" className="h-10 w-full rounded-lg border border-[#CCD7E4] bg-white pl-10 pr-4 text-[10.5px] font-semibold text-[#213653] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10" />
              </div>
            </form>

            <p className="shrink-0 text-[10.5px] font-medium text-[#74839A] sm:ml-auto">{total} customers</p>
          </div>

          <div className="mt-3 border-y border-[#DCE4ED]">

          {rows.length ? (
            <div className="divide-y divide-[#E8EDF4]">
              {rows.map((row) => (
                <Link key={row.customer_id} href={"/partner/customers/" + encodeURIComponent(row.customer_id)} prefetch={false} className="group grid gap-3 px-1 py-3.5 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-4 sm:py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(180px,.75fr)_minmax(160px,.55fr)_minmax(90px,.35fr)_auto] lg:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><UsersRound className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <p className="break-words text-[12px] font-extrabold leading-4 text-[#172846]">{row.customer_name || row.company_name || "Customer"}</p>
                      <p className="mt-0.5 break-words text-[10px] font-medium leading-4 text-[#74839A]">{row.customer_code || row.company_name || row.customer_type || "Customer record"}</p>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    {row.phone ? <p className="flex min-w-0 items-center gap-1.5 break-all text-[10px] font-semibold leading-4 text-[#536680]"><Phone className="h-3 w-3" />{row.phone}</p> : null}
                    {row.email ? <p className="flex min-w-0 items-center gap-1.5 break-all text-[10px] font-semibold leading-4 text-[#536680]"><Mail className="h-3 w-3" />{row.email}</p> : null}
                  </div>

                  <p className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-[#536680]"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{[row.city, row.state].filter(Boolean).join(", ") || "Location not recorded"}</span></p>

                  <div className="min-w-0">
                    {statusLabel(row.customer_status) === "Active" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F8EF] px-2.5 py-1 text-[9px] font-bold text-[#148A5A]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#13A36B]" aria-hidden="true" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-lg bg-[#EEF3F8] px-2 py-1 text-[9px] font-bold text-[#425672]">{statusLabel(row.customer_status)}</span>
                    )}
                  </div>

                  <ArrowRight className="hidden h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5 lg:block" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center">
              <UsersRound className="mx-auto h-7 w-7 text-[#9AABC0]" />
              <p className="mt-3 text-[12px] font-bold text-[#23395D]">No customers found</p>
              <p className="mt-1 text-[10.5px] text-[#7A899F]">{q ? "Try a different search." : "No customers available yet."}</p>
            </div>
          )}

          {(hasPrevious || hasNext) ? (
            <div className="flex items-center justify-between border-t border-[#E6ECF3] py-4">
              <Link href={hasPrevious ? pageHref(page - 1) : "#"} aria-disabled={!hasPrevious} className={"inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasPrevious ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>
                <ArrowLeft className="h-3.5 w-3.5" /> Previous
              </Link>
              <p className="text-[10px] font-semibold text-[#74839A]">Page {page}</p>
              <Link href={hasNext ? pageHref(page + 1) : "#"} aria-disabled={!hasNext} className={"inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 " + (hasNext ? "border-[#D2DCE9] text-[#203653]" : "pointer-events-none border-[#E5EAF0] text-[#AAB4C2]")}>
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

function SummaryMetric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[84px] items-center gap-3 border-b border-[#E8EDF3] px-4 py-3 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(n+3)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-black leading-none tracking-[-0.025em] text-[#142A50]">{value}</p>
        <p className="mt-1.5 text-[7.5px] font-black uppercase tracking-[0.08em] text-[#50637F]">{label}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#6D7D96]" />
    </div>
  );
}
