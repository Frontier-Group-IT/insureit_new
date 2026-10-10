import { CarFront, ClipboardCheck, FileSearch, ShieldCheck } from "lucide-react";
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
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/e-challan" />

      <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
        <div className="absolute inset-y-0 right-0 w-[67%] bg-[url('/customer-insurance-quote-vehicles.svg')] bg-cover bg-center opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#06162F] via-[#08254C]/95 via-45% to-transparent" />
        <div className="relative flex min-h-[180px] items-center px-5 py-5 sm:min-h-[220px] sm:px-8">
          <div className="max-w-[57%]">
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#9DCFFF]">E-Challan assistance</p>
            <h1 className="mt-2 text-[clamp(23px,3vw,38px)] font-black leading-tight">Check and manage your <span className="text-[#369BFF]">E-Challan</span> easily.</h1>
            <p className="mt-2 max-w-[430px] text-[11px] leading-5 text-[#E0EEFF]">Share your vehicle and challan details. INSUREIT will help you with the next steps.</p>
          </div>
        </div>
      </section>
      <div className="grid items-stretch gap-4 lg:grid-cols-[.72fr_1.28fr]">
        <aside className="rounded-2xl border border-[#DCE4EE] bg-white p-5 shadow-[0_8px_24px_rgba(28,50,82,.04)]">
          <h2 className="text-[19px] font-black text-[#10213D]">How it works</h2>
          <ol className="mt-5 space-y-5">
            {[
              { title: "Enter vehicle details", description: "Provide your vehicle registration number and optional challan details.", Icon: CarFront },
              { title: "We review your request", description: "Our team helps you find the relevant challan information and next steps.", Icon: FileSearch },
              { title: "Get guidance", description: "Receive assistance with the applicable process for payment or resolution.", Icon: ClipboardCheck },
            ].map(({title,description,Icon},index)=><li key={title} className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#DDEEFF] text-[13px] font-black text-[#176BD4]">{index+1}</span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EDF5FF] text-[#176BD4]"><Icon className="h-5 w-5"/></span>
              <span><strong className="block text-[12px] font-black text-[#142746]">{title}</strong><span className="mt-1 block text-[11px] leading-5 text-[#627794]">{description}</span></span>
            </li>)}
          </ol>
          <div className="mt-7 rounded-xl bg-[#EDF5FF] p-4">
            <div className="flex items-center gap-2 text-[12px] font-black text-[#125CB6]"><ShieldCheck className="h-5 w-5"/>Important</div>
            <p className="mt-1 text-[11px] leading-5 text-[#526985]">INSUREIT provides assistance and coordination. Final challan details, penalties and payment status remain governed by the relevant authority.</p>
          </div>
        </aside>
        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,.04)] sm:p-5">
          <CustomerServiceRequestForm
            mode="challan_assistance"
            customerId={account.id}
            vehicles={vehicles.map(vehicle => ({ id: vehicle.id, label: customerDisplayVehicleNo(vehicle) }))}
          />
        </section>
      </div>
    </div>
  );
}