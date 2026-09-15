import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CarFront, FileText, ShieldCheck, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebCustomerDetail } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export default async function PartnerVehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ customer?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const customerId = query.customer?.trim();
  if (!customerId) notFound();

  const data = await getPartnerWebCustomerDetail(customerId);
  const vehicle = data.vehicles.find((item) => item.vehicle_id === id);
  if (!vehicle) notFound();

  const vehiclePolicies = data.policies.filter((policy) => {
    if (!vehicle.vehicle_no || !policy.vehicle_no) return false;
    return policy.vehicle_no.trim().toLowerCase() === vehicle.vehicle_no.trim().toLowerCase();
  });
  const vehicleClaims = data.claims.filter((claim) => {
    if (!vehicle.vehicle_no || !claim.vehicle_no) return false;
    return claim.vehicle_no.trim().toLowerCase() === vehicle.vehicle_no.trim().toLowerCase();
  });

  const vehicleLabel = vehicle.vehicle_no || "Registration pending";
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—";

  return (
    <PartnerPortalShell title="Vehicle Details">
      <div className="space-y-3 pb-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/partner/vehicles"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D3DEEA] bg-white px-3 text-[10.5px] font-bold text-[#425A78] transition hover:bg-[#F7FAFD]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Vehicle Portfolio
          </Link>
          <Link
            href={`/partner/customers/${encodeURIComponent(customerId)}/fleet`}
            className="inline-flex h-9 items-center rounded-lg border border-[#D3DEEA] bg-white px-3 text-[10.5px] font-bold text-[#315A8C] transition hover:bg-[#F7FAFD]"
          >
            Customer Fleet
          </Link>
        </div>

        <section className="overflow-hidden rounded-[18px] border border-[#DCE5EF] bg-white shadow-[0_8px_26px_rgba(25,58,100,0.05)]">
          <div className="flex flex-col gap-4 border-b border-[#E5EBF2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-[#123E6E] text-white">
                <CarFront className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7D8DA2]">Vehicle</p>
                <h1 className="mt-1 text-[18px] font-extrabold text-[#18243A]">{vehicleLabel}</h1>
                <p className="mt-1 text-[11px] font-semibold text-[#6F8097]">{makeModel}</p>
              </div>
            </div>
            <span className="inline-flex w-fit rounded-full bg-[#EEF4FB] px-3 py-1.5 text-[10px] font-extrabold uppercase text-[#456585]">
              {vehicle.vehicle_type || "Vehicle"}
            </span>
          </div>

          <div className="grid gap-px bg-[#E7EDF4] md:grid-cols-3">
            <div className="bg-white p-5">
              <div className="flex items-center gap-2 text-[#5E718B]"><UserRound className="h-4 w-4" /><span className="text-[10px] font-bold uppercase">Customer</span></div>
              <p className="mt-2 text-[13px] font-extrabold text-[#243956]">{data.customer.customer_name}</p>
              <p className="mt-1 text-[10px] text-[#7A8CA4]">{data.customer.phone || data.customer.customer_code || "—"}</p>
            </div>
            <div className="bg-white p-5">
              <div className="flex items-center gap-2 text-[#5E718B]"><FileText className="h-4 w-4" /><span className="text-[10px] font-bold uppercase">Policies</span></div>
              <p className="mt-2 text-[22px] font-extrabold text-[#243956]">{vehiclePolicies.length}</p>
              <p className="mt-1 text-[10px] text-[#7A8CA4]">Policies linked to this vehicle</p>
            </div>
            <div className="bg-white p-5">
              <div className="flex items-center gap-2 text-[#5E718B]"><ShieldCheck className="h-4 w-4" /><span className="text-[10px] font-bold uppercase">Claims</span></div>
              <p className="mt-2 text-[22px] font-extrabold text-[#243956]">{vehicleClaims.length}</p>
              <p className="mt-1 text-[10px] text-[#7A8CA4]">Claims linked to this vehicle</p>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[18px] border border-[#DCE5EF] bg-white">
          <div className="border-b border-[#E5EBF2] px-5 py-4 sm:px-6">
            <h2 className="text-[14px] font-extrabold text-[#1D304B]">Vehicle information</h2>
          </div>
          <div className="grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {[
              ["Registration", vehicle.vehicle_no || "Registration pending"],
              ["Vehicle type", vehicle.vehicle_type || "—"],
              ["Make", vehicle.make || "—"],
              ["Model", vehicle.model || "—"],
              ["Manufacturing year", vehicle.year ? String(vehicle.year) : "—"],
              ["Fitness expiry", formatDate(vehicle.fitness_expiry_date)],
              ["PUC expiry", formatDate(vehicle.puc_expiry_date)],
              ["Road tax expiry", formatDate(vehicle.road_tax_expiry_date)],
              ["National permit expiry", formatDate(vehicle.national_permit_expiry_date)],
              ["Local permit expiry", formatDate(vehicle.local_permit_expiry_date)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[9.5px] font-bold uppercase tracking-[0.04em] text-[#8090A5]">{label}</p>
                <p className="mt-1.5 text-[11.5px] font-bold text-[#2C405D]">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[18px] border border-[#DCE5EF] bg-white">
          <div className="border-b border-[#E5EBF2] px-5 py-4 sm:px-6">
            <h2 className="text-[14px] font-extrabold text-[#1D304B]">Linked policies</h2>
          </div>
          {vehiclePolicies.length ? (
            <div className="divide-y divide-[#E8EEF5]">
              {vehiclePolicies.map((policy) => (
                <Link key={policy.policy_id} href={`/partner/policies/${policy.policy_id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#FAFCFF] sm:px-6">
                  <div>
                    <p className="text-[11.5px] font-extrabold text-[#263D5D]">{policy.policy_no || policy.policy_code || "Policy"}</p>
                    <p className="mt-1 text-[10px] text-[#7B8CA3]">{policy.insurer_name || policy.policy_product || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-[#526986]">Ends {formatDate(policy.end_date)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="px-5 py-8 text-center text-[10.5px] text-[#7C8DA3] sm:px-6">No linked policy found for this vehicle.</p>
          )}
        </section>
      </div>
    </PartnerPortalShell>
  );
}
