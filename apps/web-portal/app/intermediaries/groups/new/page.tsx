import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requireIntermediaryGroupManager } from "@/lib/intermediary-group-access";
import { createBusinessGroup } from "../business-group-actions";
export const dynamic="force-dynamic";
export default async function NewBusinessGroup({searchParams}:{searchParams:Promise<{error?:string}>}){
 await requireIntermediaryGroupManager();
 const {error}=await searchParams;
 const input="mt-1 h-11 w-full rounded-2xl border border-[#DDE5EF] bg-white px-4 text-[13px] text-[#17365D] outline-none focus:border-blue-500";
 return <AppShell title="Create Business Group" backHref="/intermediaries/groups">
 <main className="mx-auto max-w-[1550px] space-y-4 pb-12">
  <header className="overflow-hidden rounded-[20px] border border-[#D8E1EC] bg-white">
   <div className="flex items-center justify-between bg-[#17365D] px-6 py-5 text-white">
    <div><h1 className="text-[22px] font-bold">Business Group Onboarding</h1><p className="text-xs text-white/75">Create Group and primary administrator account</p></div>
    <Link href="/intermediaries/groups" className="rounded-xl border border-white/25 px-4 py-2 text-xs">Back</Link>
   </div>
   <div className="grid grid-cols-2 text-xs text-[#536680] sm:grid-cols-3">
     {["01 · Group & administrator","02 · Address","03 · Account access"].map(x=><div key={x} className="border-r border-[#E1E7EF] px-5 py-4 text-center">{x}</div>)}
   </div>
  </header>
  {error?<p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>:null}
  <form action={createBusinessGroup} className="space-y-4">
   <input type="hidden" name="onboarding_surface" value="dedicated"/>
   <section className="overflow-hidden rounded-2xl border border-[#DFE5EE] bg-white">
    <h2 className="border-b border-[#E5EAF1] px-5 py-4 text-sm font-semibold"><span className="mr-3 rounded-lg bg-[#17365D] px-3 py-2 text-white">01</span> Group & administrator</h2>
    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
     <label className="text-xs font-medium">Group Name *<input name="group_name" required maxLength={80} className={input}/></label>
     <label className="text-xs font-medium">Admin Name *<input name="admin_name" required maxLength={120} className={input}/></label>
     <label className="text-xs font-medium">Admin Email *<input type="email" name="login_email" required className={input}/></label>
     <label className="text-xs font-medium">Admin Mobile *<input name="phone" required inputMode="tel" maxLength={16} className={input}/></label>
    </div>
   </section>
   <section className="overflow-hidden rounded-2xl border border-[#DFE5EE] bg-white">
    <h2 className="border-b border-[#E5EAF1] px-5 py-4 text-sm font-semibold"><span className="mr-3 rounded-lg bg-[#17365D] px-3 py-2 text-white">02</span> Address</h2>
    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
     <label className="text-xs font-medium sm:col-span-2 xl:col-span-3">Address *<input name="address" required className={input}/></label>
     <label className="text-xs font-medium">City *<input name="city" required className={input}/></label>
     <label className="text-xs font-medium">State *<input name="state" required className={input}/></label>
     <label className="text-xs font-medium">PIN Code *<input name="postal_code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required className={input}/></label>
    </div>
   </section>
   <section className="overflow-hidden rounded-2xl border border-[#DFE5EE] bg-white">
    <h2 className="border-b border-[#E5EAF1] px-5 py-4 text-sm font-semibold"><span className="mr-3 rounded-lg bg-[#17365D] px-3 py-2 text-white">03</span> Account access</h2>
    <div className="grid gap-4 p-5">
     <label className="text-xs font-medium">Role<input value="Group Administrator" readOnly disabled className={input+" bg-[#F3F6FA] font-semibold"}/><input type="hidden" name="admin_role" value="group_admin"/></label>
    </div>
   </section>
   <div className="flex justify-end gap-3 rounded-2xl border border-[#DFE5EE] bg-white px-5 py-4 shadow-sm">
    <Link className="rounded-xl border border-[#DDE5EF] bg-white px-5 py-3 text-xs font-semibold" href="/intermediaries/groups">Cancel</Link>
    <button className="rounded-xl bg-[#17365D] px-7 py-3 text-xs font-semibold text-white">Save Group</button>
   </div>
  </form>
 </main></AppShell>;
}
