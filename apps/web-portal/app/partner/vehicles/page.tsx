import Link from "next/link";
import { CarFront, ChevronLeft, ChevronRight, Search, ShieldAlert, Wrench } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { listPartnerWebVehicles } from "@/lib/partner-vehicles";
import { VehicleFilters } from "./vehicle-filters";
import { parseVehicleStatusFilter, parseVehicleTypeFilter, type VehicleStatusFilter, type VehicleTypeFilter } from "./vehicle-filter-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 25;

function buildHref(query: string, page: number, status: VehicleStatusFilter, vehicleType: VehicleTypeFilter) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status !== "all") params.set("status", status);
  if (vehicleType !== "all") params.set("vehicleType", vehicleType);
  if (page > 1) params.set("page", String(page));
  const value = params.toString();
  return value ? `/partner/vehicles?${value}` : "/partner/vehicles";
}

function isRegistrationPending(status: string | null) {
  const normalized = (status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return normalized === "registration_pending" || normalized === "pending" || normalized === "rc_pending";
}

export default async function PartnerVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; vehicleType?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const status = parseVehicleStatusFilter(params.status);
  const vehicleType = parseVehicleTypeFilter(params.vehicleType);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { rows, total, counts } = await listPartnerWebVehicles({
    query,
    status,
    vehicleType,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, total);

  return (
    <PartnerPortalShell title="Vehicle">
      <section className="overflow-hidden rounded-[18px] border border-[#DCE5EF] bg-white shadow-[0_8px_26px_rgba(25,58,100,0.05)]">
        <div className="flex flex-col gap-3 border-b border-[#E5EBF2] px-5 py-3.5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex shrink-0 items-center gap-3">
              <span className="grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-[#123E6E] text-white shadow-[0_5px_14px_rgba(18,62,110,0.18)]">
                <CarFront className="h-5 w-5" />
              </span>
              <h1 className="whitespace-nowrap text-[18px] font-extrabold tracking-[-0.02em] text-[#18243A]">Vehicle Portfolio</h1>
            </div>
            <form className="relative w-full lg:max-w-[390px]" action="/partner/vehicles">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#73849B]" />
              <input name="q" defaultValue={query} placeholder="Search registration, chassis, engine, customer, permit, make or model" className="h-11 w-full rounded-[13px] border border-[#CFDAE7] bg-white pl-10 pr-4 text-[11px] font-semibold text-[#243A58] outline-none transition placeholder:text-[#95A2B5] focus:border-[#7FAADD] focus:ring-2 focus:ring-[#2E7ED0]/10" />
              {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
              {vehicleType !== "all" ? <input type="hidden" name="vehicleType" value={vehicleType} /> : null}
            </form>
          </div>
          <VehicleFilters status={status} vehicleType={vehicleType} counts={counts} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead><tr className="bg-[#F7F9FC] text-[9px] font-black uppercase tracking-[0.04em] text-[#6E819B]"><th className="px-4 py-3 sm:px-6">Vehicle</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Make / Model</th><th className="px-4 py-3">Registration</th><th className="px-4 py-3 sm:pr-6">Next Action</th></tr></thead>
            <tbody className="divide-y divide-[#E7ECF2]">
              {rows.map((vehicle) => {
                const pending = isRegistrationPending(vehicle.registration_status);
                const vehicleLabel = pending ? "Registration pending" : vehicle.vehicle_no || "—";
                const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—";
                const detailHref = `/partner/vehicles/${encodeURIComponent(vehicle.vehicle_id)}?customer=${encodeURIComponent(vehicle.customer_id)}`;
                return (
                  <tr key={vehicle.vehicle_id} className="text-[11px] text-[#273B56] transition hover:bg-[#FBFCFE]">
                    <td className="p-0"><Link href={detailHref} prefetch={false} className="group block w-full px-4 py-3.5 sm:px-6"><div className="font-mono text-[11px] font-extrabold tracking-[0.02em] text-[#17233A] group-hover:text-[#1458A6] group-hover:underline">{vehicleLabel}</div><div className="mt-1 text-[9px] font-medium uppercase text-[#8190A5]">{vehicle.vehicle_type || "—"}</div></Link></td>
                    <td className="p-0 font-semibold text-[#31435B]"><Link href={detailHref} prefetch={false} className="block w-full px-4 py-[18px] transition hover:text-[#1458A6]">{vehicle.customer_name || "—"}</Link></td>
                    <td className="p-0 font-semibold text-[#2C3C55]"><Link href={detailHref} prefetch={false} className="block w-full px-4 py-[18px] transition hover:text-[#1458A6]">{makeModel}</Link></td>
                    <td className="p-0"><Link href={detailHref} prefetch={false} className="block w-full px-4 py-[14px]">{pending ? <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F2C85C] bg-[#FFF9E9] px-2.5 py-1 text-[9.5px] font-extrabold text-[#A85A13]"><span className="h-1.5 w-1.5 rounded-full bg-[#B77B45]" />RC pending</span> : <span className="inline-flex items-center gap-1.5 rounded-full border border-[#98E7C3] bg-[#EDFFF5] px-2.5 py-1 text-[9.5px] font-extrabold text-[#16775D]"><span className="h-1.5 w-1.5 rounded-full bg-[#49AE8C]" />Registered</span>}</Link></td>
                    <td className="p-0"><Link href={detailHref} prefetch={false} className={`flex w-full items-center gap-1.5 px-4 py-[18px] text-[10px] font-extrabold transition hover:underline sm:pr-6 ${pending ? "text-[#C95A0A]" : "text-[#078161]"}`}>{pending ? <ShieldAlert className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}{pending ? "Update RC" : "Maintained"}</Link></td>
                  </tr>
                );
              })}
              {rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-20 text-center"><CarFront className="mx-auto h-8 w-8 text-[#A5B5C8]" /><p className="mt-3 text-[12px] font-extrabold text-[#253E61]">No vehicles found</p><p className="mt-1 text-[10px] text-[#8090A7]">Try adjusting your filters or search.</p></td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#E6EDF5] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[10px] font-medium text-[#667B98]">Showing {start}-{end} of {total}</p>
          <div className="flex items-center gap-2">
            <Link aria-disabled={safePage <= 1} href={buildHref(query, Math.max(1, safePage - 1), status, vehicleType)} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold ${safePage <= 1 ? "pointer-events-none border-[#E4EAF1] text-[#B0BBC9]" : "border-[#D7E1EC] text-[#536A88] hover:bg-[#F7FAFD]"}`}><ChevronLeft className="h-3.5 w-3.5" />Previous</Link>
            <span className="min-w-[42px] text-center text-[10px] font-extrabold text-[#344D6D]">{safePage} / {totalPages}</span>
            <Link aria-disabled={safePage >= totalPages} href={buildHref(query, Math.min(totalPages, safePage + 1), status, vehicleType)} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[10px] font-bold ${safePage >= totalPages ? "pointer-events-none border-[#E4EAF1] text-[#B0BBC9]" : "border-[#D7E1EC] text-[#536A88] hover:bg-[#F7FAFD]"}`}>Next<ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </section>
    </PartnerPortalShell>
  );
}
