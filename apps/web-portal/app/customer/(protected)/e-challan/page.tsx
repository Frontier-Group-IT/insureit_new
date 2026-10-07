import {
  CustomerAccountTabs,
  CustomerPageHeading,
} from "@/components/customer-portal/customer-phase1";
import { CustomerServiceRequestForm } from "@/components/customer-portal/customer-service-request-form";
import {
  customerDisplayVehicleNo,
  loadCustomerWebVehicles,
  resolveCustomerWebScope,
} from "@/lib/customer-web-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerEChallanPage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const vehicles = await loadCustomerWebVehicles(account.id);

  return (
    <div className="space-y-5">
      <CustomerPageHeading
        eyebrow="Challan assistance"
        title="E‑Challan"
        description="Send your vehicle and challan details to the INSUREIT support workflow for assisted follow-up."
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/e-challan" />

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <aside className="rounded-2xl border border-[#DCE4EE] bg-[#142746] p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#AFCBFF]">Challan assistance</p>
          <h2 className="mt-2 text-[22px] font-black tracking-[-0.02em]">Share the details. We’ll guide the next step.</h2>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-[#D5E5FC]">INSUREIT provides assistance and coordination. Final challan details, penalties and payment status remain governed by the relevant authority.</p>
        </aside>
        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,0.04)]">
          <CustomerServiceRequestForm
            mode="challan_assistance"
            customerId={account.id}
            vehicles={vehicles.map((vehicle) => ({ id: vehicle.id, label: customerDisplayVehicleNo(vehicle) }))}
          />
        </section>
      </div>
    </div>
  );
}
