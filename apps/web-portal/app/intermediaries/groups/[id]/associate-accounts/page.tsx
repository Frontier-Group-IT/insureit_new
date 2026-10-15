import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGroupAssociateManager } from "../../group-associate-access";
import { createGroupAssociate } from "./actions";
import { AssociateControls } from "./associate-controls";
export const dynamic="force-dynamic";
type Query={success?:string,error?:string};
export default async function GroupAssociatesPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Query>}){
 const {id}=await params;
 return renderGroupAssociates({id,query:await searchParams,surface:"operations"});
}
export async function renderGroupAssociates({id,query:q,surface}:{id:string;query:Query;surface:"partner"|"operations"}){

 await requireGroupAssociateManager(id);
 const admin=createSupabaseAdminClient();
 const [{data:group},{data:associates}]=await Promise.all([
  admin.from("intermediary_groups").select("id,group_name,group_code,status").eq("id",id).maybeSingle(),
  admin.from("group_portal_associate_accounts").select("id,name,phone_number,email,designation,address,city,state,postal_code,role,status").eq("group_id",id).order("created_at",{ascending:false})
 ]);
 if(!group)notFound();
 const input="h-10 w-full rounded-xl border border-[#D8DEE9] px-3 text-xs outline-none focus:border-blue-500";
 const content=(
  <main className="mx-auto max-w-[1480px] space-y-4">
   <header className="flex items-center justify-between rounded-2xl bg-[#0D2C5C] p-5 text-white">
    <div><h1 className="text-xl font-semibold">Associate Accounts Review</h1><p className="text-sm">{group.group_name} · {group.group_code}</p></div>
    <Link className="rounded-xl border border-white/40 px-4 py-2 text-xs" href={`/intermediaries/groups/${id}`}>Back to Group</Link>
   </header>
   {q.error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{q.error}</p>:null}
   {q.success?<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{q.success}</p>:null}
   <section className="rounded-2xl border border-[#DCE5EF] bg-white">
    <h2 className="border-b p-4 text-sm font-semibold">Create Group Associate Account</h2>
    <form action={createGroupAssociate} className="grid gap-3 p-5 md:grid-cols-4">
      <input type="hidden" name="group_id" value={id}/><input type="hidden" name="portal_surface" value={surface==="partner"?"partner":"operations"}/>
      <label className="text-xs">Name *<input className={input} name="name" required/></label>
      <label className="text-xs">Phone Number *<input className={input} name="phone" required inputMode="tel"/></label>
      <label className="text-xs">Email *<input className={input} name="email" type="email" required/></label>
      <label className="text-xs">Designation *<input className={input} name="designation" required/></label>
      <label className="text-xs md:col-span-2">Address<input className={input} name="address"/></label>
      <label className="text-xs">City<input className={input} name="city"/></label>
      <label className="text-xs">State<input className={input} name="state"/></label>
      <label className="text-xs">PIN Code<input className={input} name="postal_code"/></label>
      <label className="text-xs">Role *<select className={input} name="role" defaultValue="" required><option value="" disabled>Select role</option><option value="group_admin" disabled>Group Administrator (Primary)</option><option value="insurance_head">Insurance Head</option><option value="claim_head">Claim Head</option><option value="bodyshop_manager">Bodyshop Manager</option></select></label>
      <div className="flex items-end justify-end md:col-span-2"><button className="h-10 rounded-xl bg-[#17365D] px-5 text-xs font-semibold text-white">Save Details</button></div>
    </form>
   </section>
   <section className="overflow-x-auto rounded-2xl border border-[#DCE5EF] bg-white">
    <h2 className="border-b p-4 text-sm font-semibold">Associate Accounts Register</h2>
    <table className="w-full min-w-[1060px] text-left text-xs"><thead className="bg-slate-50"><tr>{["Name","Phone Number","Email","Designation","Address","Role","Status","Action"].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead>
    <tbody>{(associates??[]).map(a=><tr key={a.id} className="border-t">
      <td className="p-3">{a.name}</td><td className="p-3">{a.phone_number}</td><td className="p-3">{a.email}</td><td className="p-3">{a.designation}</td>
      <td className="p-3">{[a.address,a.city,a.state,a.postal_code].filter(Boolean).join(", ")||"–"}</td>
      <td className="p-3"><span className="rounded-full border px-2 py-1">{{group_admin:"Group Administrator",insurance_head:"Insurance Head",claim_head:"Claim Head",bodyshop_manager:"Bodyshop Manager"}[a.role as "group_admin"|"insurance_head"|"claim_head"|"bodyshop_manager"]||a.role}</span></td><td className="p-3">{a.status}</td>
      <td className="p-3"><AssociateControls groupId={id} associate={a} surface={surface}/></td>
    </tr>)}</tbody></table>
   </section>
  </main>);
 return surface==="partner"
 ? <PartnerPortalShell title="Group Associate Accounts">{content}</PartnerPortalShell>
 : <AppShell title="Group Associate Accounts" backHref={`/intermediaries/groups/${id}`}>{content}</AppShell>;
}
