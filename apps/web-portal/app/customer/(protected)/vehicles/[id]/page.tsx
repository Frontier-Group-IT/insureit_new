import Link from "next/link";
import { ArrowLeft, CalendarDays, CarFront, Hash, ShieldCheck } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  EmptyCustomerState,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import {
  customerDisplayVehicleNo,
  customerPolicyTone,
  formatCustomerDate,
  loadCustomerVehicleDetail,
  resolveCustomerWebScope,
} from "@/lib/customer-web-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerVehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ account?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const { account, accounts } = await resolveCustomerWebScope(query.account);
  const { vehicle, policies } = await loadCustomerVehicleDetail(account.id, id);
  const currentPolicy = policies.find((policy) => customerPolicyTone(policy.end_date).tone !== "expired");

  const details = [
    ["Registration date", formatCustomerDate(vehicle.registration_date)],
    ["Vehicle type", vehicle.vehicle_type || "—"],
    ["Make", vehicle.make || "—"],
    ["Model", vehicle.model || "—"],
    ["Year", vehicle.year?.toString() || "—"],
    ["Chassis number", vehicle.chassis_no || "—"],
    ["Engine number", vehicle.engine_no || "—"],
    ["Fitness expiry", formatCustomerDate(vehicle.fitness_expiry_date)],
    ["PUC expiry", formatCustomerDate(vehicle.puc_expiry_date)],
    ["Road tax expiry", formatCustomerDate(vehicle.road_tax_expiry_date)],
    ["National permit expiry", formatCustomerDate(vehicle.national_permit_expiry_date)],
    ["Local permit expiry", formatCustomerDate(vehicle.local_permit_expiry_date)],
  ];

  return (
    <div className="space-y-5">
      <Link href={{ pathname: "/customer/vehicles", query: { account: account.id } }} className="inline-flex items-center gap-1 text-[11px] font-black text-[#53627A] hover:text-[#142746]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to vehicles
      </Link>
      <CustomerPageHeading
        eyebrow="Vehicle detail"
        title={customerDisplayVehicleNo(vehicle)}
        description={[vehicle.make, vehicle.model].filter(Boolean).join(" · ") || vehicle.vehicle_type}
        action={<StatusPill tone={currentPolicy ? "active" : "expired"}>{currentPolicy ? "Covered" : "No active policy"}</StatusPill>}
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname={`/customer/vehicles/${vehicle.id}`} />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
          <div className="flex items-center gap-2"><CarFront className="h-4 w-4 text-[#174EA6]" /><h2 className="text-[13px] font-black text-[#10213D]">Vehicle information</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#F7F9FC] px-3 py-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8794A7]">{label}</p>
                <p className="mt-1 break-words text-[11.5px] font-black text-[#35445B]">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#174EA6]" /><h2 className="text-[13px] font-black text-[#10213D]">Insurance history</h2></div>
          <div className="mt-4 space-y-2">
            {policies.map((policy) => {
              const status = customerPolicyTone(policy.end_date);
              return (
                <Link key={`${policy.source}:${policy.id}`} href={{ pathname: `/customer/policies/${policy.id}`, query: { account: account.id, source: policy.source } }} className="block rounded-xl border border-[#E2E8F0] bg-[#FBFCFE] p-3 hover:border-[#BCCBDD]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate text-[11.5px] font-black text-[#10213D]">{policy.policy_no}</p><p className="mt-0.5 truncate text-[10px] font-semibold text-[#74839A]">{policy.insurer_name || policy.policy_type}</p></div>
                    <StatusPill tone={status.tone}>{status.tone}</StatusPill>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[9.5px] font-bold text-[#77869A]">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatCustomerDate(policy.end_date)}</span>
                    <span className="inline-flex items-center gap-1 uppercase"><Hash className="h-3 w-3" />{policy.source}</span>
                  </div>
                </Link>
              );
            })}
            {policies.length === 0 ? <EmptyCustomerState title="No policies for this vehicle" body="Insurance policies linked to this vehicle will appear here." /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
