import { ClipboardCheck, Headset, MessageCircle, ShieldCheck } from "lucide-react";
import {
  CustomerAccountTabs,
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
    <div className="space-y-2.5">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/insurance-quote" />
      <section className="relative isolate overflow-hidden rounded-xl bg-[#061A38] text-white shadow-[0_6px_22px_rgba(10,32,68,.12)]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#06152e_0%,#062349_43%,transparent_76%)]" />
        <div className="absolute inset-y-0 right-0 w-[66%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-cover bg-center opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06152e] via-[#061b38]/95 via-45% to-transparent" />
        <div className="relative flex min-h-[180px] items-center justify-between gap-2 px-4 py-4 sm:min-h-[205px] sm:px-6">
          <div className="max-w-[55%]">
            <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#8DCBFF]">Commercial vehicle insurance</p>
            <h1 className="mt-2 max-w-[360px] text-[clamp(21px,2.6vw,35px)] font-black leading-[1.06] tracking-tight">Protect <span className="text-[#46A6FF]">your</span><br/>business <span className="text-[#46A6FF]">journey.</span></h1>
            <p className="mt-2 max-w-[370px] text-[10px] leading-4 text-[#E0EEFF]">Get the right insurance quote with expert assistance from INSUREIT.</p>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[9px] font-semibold text-[#E8F3FF]">
              <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-[#58B3FF]"/>Quick request</span>
              <span className="flex items-center gap-1"><Headset className="h-4 w-4 text-[#58B3FF]"/>Expert callback</span>
              <span className="flex items-center gap-1"><ClipboardCheck className="h-4 w-4 text-[#58B3FF]"/>Multiple insurer options</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-4 w-4 text-[#4DDEAA]"/>WhatsApp updates</span>
            </div>
          </div>
          <p className="hidden shrink-0 border-l-2 border-[#53B8FF] pl-3 text-[10px] font-extrabold uppercase leading-4 tracking-wide text-white lg:block">Right<br/>cover<br/>for every<br/>journey</p>
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border border-[#DCE5F1] bg-white p-3 shadow-[0_8px_26px_rgba(28,50,82,.06)] sm:p-5">
        <CustomerServiceRequestForm
          mode="insurance_quote"
          customerId={account.id}
          vehicles={vehicles.map((vehicle) => ({ id: vehicle.id, label: customerDisplayVehicleNo(vehicle), make: vehicle.make, model: vehicle.model, vehicleType: vehicle.vehicle_type }))}
        />
      </section>
    </div>
  );
}