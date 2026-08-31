import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { createVehicleCustomer } from "./actions";

export const dynamic="force-dynamic";
export default async function NewVehicleCustomerPage({searchParams}:{searchParams:Promise<{error?:string}>}){
  await requireCapability("create_customers","edit"); const params=await searchParams;
  const input="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px] text-[#17203A] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]";
  const label="mb-1.5 block text-[9px] font-bold uppercase tracking-[.055em] text-[#475467]";
  return <AppShell title="Create Customer for Vehicle" backHref="/vehicles/new"><div className="mx-auto max-w-[760px] rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">
    <div className="border-b border-[#E5ECF5] px-5 py-4"><h1 className="text-[15px] font-semibold text-[#17365D]">New operational customer</h1><p className="mt-1 text-[9.5px] leading-4 text-[#667085]">Create the minimum customer master required for Vehicle Register. Same-name + same-mobile records are reused; a shared mobile can still belong to a different insured.</p></div>
    {params.error?<div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-semibold text-red-700">{params.error}</div>:null}
    <form action={createVehicleCustomer} className="p-5"><div className="grid gap-4 sm:grid-cols-2">
      <div><label className={label} htmlFor="contact_name">Customer / insured name *</label><input id="contact_name" name="contact_name" required className={input}/></div>
      <div><label className={label} htmlFor="phone">Mobile number *</label><input id="phone" name="phone" inputMode="numeric" maxLength={10} required className={input}/></div>
      <div><label className={label} htmlFor="company_name">Company name</label><input id="company_name" name="company_name" className={input}/></div>
      <div><label className={label} htmlFor="city">City</label><input id="city" name="city" className={input}/></div>
      <div><label className={label} htmlFor="state">State</label><input id="state" name="state" className={input}/></div>
    </div><div className="mt-5 flex justify-end gap-2 border-t border-[#E5ECF5] pt-4"><Link href="/vehicles/new" className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[10px] font-semibold text-[#475569]">Back to Vehicle</Link><button type="submit" className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white">Create Customer &amp; Continue</button></div></form>
  </div></AppShell>;
}
