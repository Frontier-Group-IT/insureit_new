import { ArrowRight, ClipboardCheck, Headset, MessageCircle, ShieldCheck } from "lucide-react";
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
    <div className="space-y-5">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/insurance-quote" />
      <section className="relative isolate overflow-hidden rounded-[20px] bg-[#071A36] text-white shadow-[0_12px_32px_rgba(10,32,68,.14)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_40%,#2166b4_0%,transparent_48%),linear-gradient(110deg,#06142b_0%,#0b2b55_100%)]" />
        <div className="relative grid min-h-[250px] items-center gap-3 px-5 py-6 sm:px-8 lg:grid-cols-[.85fr_1.15fr] lg:py-7">
          <div className="relative z-10">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#86C5FF]">Commercial vehicle insurance</p>
            <h1 className="mt-3 max-w-[490px] text-[clamp(26px,3.1vw,44px)] font-black leading-[1.09] tracking-tight">Protect your <span className="text-[#46A6FF]">business journey.</span></h1>
            <p className="mt-3 max-w-[440px] text-[12px] leading-5 text-[#DCEAFF]">Get the right insurance quote with expert assistance from INSUREIT.</p>
            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3 text-[10px] font-semibold text-[#E8F3FF] sm:flex sm:flex-wrap sm:gap-4">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-5 w-5 text-[#58B3FF]"/>Quick request</span>
              <span className="flex items-center gap-1.5"><Headset className="h-5 w-5 text-[#58B3FF]"/>Expert callback</span>
              <span className="flex items-center gap-1.5"><ClipboardCheck className="h-5 w-5 text-[#58B3FF]"/>Insurer options</span>
              <span className="flex items-center gap-1.5"><MessageCircle className="h-5 w-5 text-[#4DDEAA]"/>WhatsApp optional</span>
            </div>
          </div>
          <div className="relative flex min-h-[145px] items-center justify-center lg:min-h-[225px]">
            <div className="absolute inset-0 rounded-full bg-[#2B80D8]/15 blur-3xl"/>
            <img src="/customer-insurance-quote-vehicles.svg" alt="White commercial truck and passenger vehicles on a city road" className="relative max-h-[245px] w-full object-contain drop-shadow-[0_12px_14px_rgba(0,0,0,.24)]" />
            <div className="absolute right-0 top-0 hidden border-l-2 border-[#53B8FF] pl-3 text-[11px] font-extrabold uppercase tracking-wide text-white xl:block">Right cover<br/>for every<br/>journey</div>
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-[20px] border border-[#DCE5F1] bg-white p-4 shadow-[0_8px_26px_rgba(28,50,82,.06)] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#E8EDF5] pb-3">
          <div><h2 className="text-[17px] font-black text-[#10213D]">Get Insurance Quote</h2><p className="mt-0.5 text-[11px] text-[#657791]">Select your vehicle and tell us what you need.</p></div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EDF5FF] px-3 py-1.5 text-[10px] font-bold text-[#1B63B4]">Quick request <ArrowRight className="h-3 w-3"/></span>
        </div>
        <CustomerServiceRequestForm
          mode="insurance_quote"
          customerId={account.id}
          vehicles={vehicles.map((vehicle) => ({ id: vehicle.id, label: customerDisplayVehicleNo(vehicle) }))}
        />
      </section>
    </div>
  );
}