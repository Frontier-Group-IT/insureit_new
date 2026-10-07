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

export default async function CustomerInsuranceQuotePage({
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
        eyebrow="Insurance services"
        title="Get Insurance Quote"
        description="Request renewal, new-policy or insurer-change assistance using your registered Customer account."
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/insurance-quote" />

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <aside className="rounded-2xl border border-[#DCE4EE] bg-[#142746] p-5 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#AFCBFF]">Commercial vehicle insurance</p>
          <h2 className="mt-2 text-[22px] font-black tracking-[-0.02em]">Simple request. Expert callback.</h2>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-[#D5E5FC]">Share the vehicle and requirement. Your request enters the same INSUREIT service-enquiry workflow used by the Customer App.</p>
          <div className="mt-5 space-y-2 text-[10.5px] font-bold text-[#E5EEF9]">
            <p>• Renewal assistance</p><p>• New policy enquiry</p><p>• Change insurer</p><p>• WhatsApp updates optional</p>
          </div>
        </aside>
        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,0.04)]">
          <CustomerServiceRequestForm
            mode="insurance_quote"
            customerId={account.id}
            vehicles={vehicles.map((vehicle) => ({ id: vehicle.id, label: customerDisplayVehicleNo(vehicle) }))}
          />
        </section>
      </div>
    </div>
  );
}
