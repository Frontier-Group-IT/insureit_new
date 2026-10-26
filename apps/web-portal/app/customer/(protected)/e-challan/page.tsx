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

      <section className="relative isolate overflow-hidden rounded-xl border border-[#E9E4FA] bg-[#F4F1FF] text-[#1C244A]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-full bg-[url('/assets/PT2.jpeg')] bg-right-center bg-no-repeat bg-[length:auto_100%] opacity-75" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F5F3FF] via-[#F5F3FF]/95 via-[40%] to-[#F5F3FF]/10" />
        <div className="relative flex min-h-[145px] items-center px-5 py-4 sm:min-h-[168px] sm:px-6">
          <div className="max-w-[610px]">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-[#7355CA]"><CarFront className="h-4 w-4" /> E-Challan Assistance</div>
            <h1 className="text-[clamp(24px,2.5vw,34px)] font-extrabold leading-[1.15] tracking-tight">Check and manage your<br /><span className="text-[#7540D9]">E-Challan</span> easily.</h1>
            <p className="mt-2 text-[12px] text-[#777C9B]">View your vehicle details, challan information and take action — all in one place.</p>
          </div>
        </div>
      </section>
      <div className="grid items-stretch gap-3 lg:grid-cols-[.55fr_1fr]">
        <aside className="rounded-xl border border-[#EAE6F4] bg-white p-4 shadow-[0_3px_14px_rgba(70,50,120,.035)]">
          <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#242B51]"><FileSearch className="h-5 w-5 text-[#7442CB]" aria-hidden="true" />How it works</h2>
          <ol className="mt-4 space-y-4">
            {[
              { title: "Enter vehicle details", description: "Provide your vehicle registration number and optional challan details.", Icon: CarFront },
              { title: "We review your request", description: "Our team helps you find the relevant challan information and next steps.", Icon: FileSearch },
              { title: "Get guidance", description: "Receive assistance with the applicable process for payment or resolution.", Icon: ClipboardCheck },
            ].map(({title,description,Icon},index)=><li key={title} className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F0EBFF] text-[13px] font-bold text-[#6941CA]">{index+1}</span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F0EBFF] text-[#6941CA]"><Icon className="h-5 w-5"/></span>
              <span><strong className="block text-[12px] font-bold text-[#252A4D]">{title}</strong><span className="mt-1 block text-[11px] leading-5 text-[#7B809B]">{description}</span></span>
            </li>)}
          </ol>
          <div className="mt-5 rounded-lg bg-[#F3EFFF] p-3">
            <div className="flex items-center gap-2 text-[12px] font-bold text-[#7442CC]"><ShieldCheck className="h-5 w-5"/>Important</div>
            <p className="mt-1 text-[11px] leading-5 text-[#7B809B]">INSUREIT provides assistance and coordination. Final challan details, penalties and payment status remain governed by the relevant authority.</p>
          </div>
        </aside>
        <section className="rounded-xl border border-[#EAE6F4] bg-white p-4 shadow-[0_3px_14px_rgba(70,50,120,.035)]">
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