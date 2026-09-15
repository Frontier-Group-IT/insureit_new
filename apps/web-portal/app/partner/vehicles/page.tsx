import Link from "next/link";
import { CarFront, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { listPartnerWebVehicles } from "@/lib/partner-vehicles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;

function buildHref(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  return value ? `/partner/vehicles?${value}` : "/partner/vehicles";
}

export default async function PartnerVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { rows, total } = await listPartnerWebVehicles({ query, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);

  return (
    <PartnerPortalShell title="Vehicle">
      <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_16px_rgba(37,61,103,0.045)]">
        <div className="flex flex-col gap-3 border-b border-[#E7EDF4] px-4 py-3 lg:flex-row lg:items-center">
          <div className="flex min-w-[190px] items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF2FF] text-[#2467D1]"><CarFront className="h-5 w-5" /></span>
            <div>
              <h1 className="text-[14px] font-extrabold text-[#182C4C]">Vehicle Register</h1>
              <p className="mt-0.5 text-[10px] font-medium text-[#7A8CA5]">{total} total vehicle{total === 1 ? "" : "s"}</p>
            </div>
          </div>

          <form className="relative w-full max-w-[560px]" action="/partner/vehicles">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8CA3]" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search vehicle, customer, make or model"
              className="h-10 w-full rounded-xl border border-[#D6E0EC] bg-white pl-10 pr-4 text-[11px] font-semibold text-[#213857] outline-none transition placeholder:text-[#9AA8BA] focus:border-[#8CB8ED] focus:ring-2 focus:ring-[#2F91FF]/10"
            />
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="bg-[#F4F7FB] text-[9px] font-black uppercase tracking-[0.05em] text-[#6680A2]">
                <th className="px-4 py-3">Vehicle No.</th>
                <th className="px-4 py-3">Make / Model</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Vehicle Type</th>
                <th className="px-4 py-3">Registration</th>
                <th className="px-4 py-3 text-center">Policies</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EEF5]">
              {rows.map((vehicle) => (
                <tr key={vehicle.vehicle_id} className="text-[11px] text-[#223B5B] transition hover:bg-[#FAFCFF]">
                  <td className="px-4 py-3.5 font-extrabold text-[#18345C]">{vehicle.vehicle_no || "—"}</td>
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-[#263E60]">{[vehicle.make, vehicle.model].filter(Boolean).join(" · ") || "—"}</div>
                  </td>
                  <td className="px-4 py-3.5 font-semibold">{vehicle.customer_name || "—"}</td>
                  <td className="px-4 py-3.5">{vehicle.vehicle_type || "—"}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex rounded-full bg-[#EEF4FB] px-2.5 py-1 text-[9px] font-bold text-[#456585]">{vehicle.registration_status || "Registered"}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center font-bold">{vehicle.policy_count}</td>
                  <td className="px-4 py-3.5 text-right">
                    <Link href={`/partner/customers/${vehicle.customer_id}/fleet`} prefetch={false} className="inline-flex h-8 items-center rounded-lg border border-[#D8E3F0] px-3 text-[9.5px] font-extrabold text-[#275A9B] transition hover:bg-[#F3F8FE]">View</Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-20 text-center"><CarFront className="mx-auto h-8 w-8 text-[#A5B5C8]" /><p className="mt-3 text-[12px] font-extrabold text-[#253E61]">No vehicles found</p><p className="mt-1 text-[10px] text-[#8090A7]">Try adjusting your search.</p></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#E6EDF5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-medium text-[#667B98]">Showing {start}-{end} of {total}</p>
          <div className="flex items-center gap-2">
            <Link aria-disabled={safePage <= 1} href={safePage <= 1 ? buildHref(query, 1) : buildHref(query, safePage - 1)} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold ${safePage <= 1 ? "pointer-events-none border-[#E4EAF1] text-[#B0BBC9]" : "border-[#D7E1EC] text-[#536A88] hover:bg-[#F7FAFD]"}`}><ChevronLeft className="h-3.5 w-3.5" />Previous</Link>
            <span className="min-w-[42px] text-center text-[10px] font-extrabold text-[#344D6D]">{safePage} / {totalPages}</span>
            <Link aria-disabled={safePage >= totalPages} href={safePage >= totalPages ? buildHref(query, safePage) : buildHref(query, safePage + 1)} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold ${safePage >= totalPages ? "pointer-events-none border-[#E4EAF1] text-[#B0BBC9]" : "border-[#D7E1EC] text-[#536A88] hover:bg-[#F7FAFD]"}`}>Next<ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </section>
    </PartnerPortalShell>
  );
}
