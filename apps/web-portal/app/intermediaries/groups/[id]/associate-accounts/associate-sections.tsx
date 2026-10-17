import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGroupAssociateManager } from "../../group-associate-access";
import { createGroupAssociate } from "./actions";
import { AssociateControls } from "./associate-controls";

type Query = {success?:string; error?:string};
export async function GroupAssociateSections({id,query:q={},surface="operations"}:{id:string;query?:Query;surface?:"operations"|"partner"}) {
 await requireGroupAssociateManager(id);
 const admin = createSupabaseAdminClient();
 const {data:associates} = await admin.from("group_portal_associate_accounts").select("id,name,phone_number,email,designation,address,city,state,postal_code,role,status").eq("group_id",id).order("created_at",{ascending:false});
 const input="h-9 w-full rounded-lg border border-[#D8DEE9] px-3 text-[11px] outline-none focus:border-blue-500";
 return <div className="space-y-4">
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
 </div>;
}
