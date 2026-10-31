import { GroupEditFormActions } from "./form-actions";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGroupAssociateManager } from "../../group-associate-access";
import { saveGroupReviewDetails } from "./save-action";
export const dynamic="force-dynamic";
export default async function EditGroupPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;await requireGroupAssociateManager(id);
 const admin=createSupabaseAdminClient();
 const [{data:group},{data:contact}]=await Promise.all([
  admin.from("intermediary_groups").select("group_name,description,group_code,group_mode").eq("id",id).maybeSingle(),
  admin.from("group_administrator_contacts").select("admin_name,admin_mobile,address,city,state,postal_code").eq("group_id",id).maybeSingle()
 ]);
 if(!group)notFound();
 const input="mt-1 h-10 w-full rounded-xl border border-[#DCE5EF] px-3 text-sm";
 return <AppShell title="Edit Group" backHref={`/intermediaries/groups/${id}`}>
 <main className="mx-auto max-w-[1100px] space-y-4">
  <header className="rounded-2xl bg-[#17365D] p-5 text-white"><h1 className="text-xl font-bold">Edit Business Group</h1><p className="text-xs text-white/80">{group.group_code}</p></header>
  <form action={saveGroupReviewDetails} className="space-y-4 rounded-2xl border bg-white p-5">
   <input type="hidden" name="group_id" value={id}/>
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-xs">Group Name *<input className={input} name="group_name" required defaultValue={group.group_name}/></label>
    <label className="text-xs">Admin Name<input className={input} name="admin_name" defaultValue={contact?.admin_name??""}/></label>
    <label className="text-xs">Admin Mobile<input className={input} name="admin_mobile" defaultValue={contact?.admin_mobile??""}/></label>
    <label className="text-xs">Role<input className={input+" bg-slate-100"} readOnly value="Group Administrator"/></label>
    <label className="text-xs sm:col-span-2">Address<input className={input} name="address" defaultValue={contact?.address??""}/></label>
    <label className="text-xs">City<input className={input} name="city" defaultValue={contact?.city??""}/></label>
    <label className="text-xs">State<input className={input} name="state" defaultValue={contact?.state??""}/></label>
    <label className="text-xs">PIN Code<input className={input} name="postal_code" defaultValue={contact?.postal_code??""} maxLength={6}/></label>
    <label className="text-xs">Description<input className={input} name="description" defaultValue={group.description??""}/></label>
   </div>
   <GroupEditFormActions returnHref={`/intermediaries/groups/${id}`} />
  </form>
 </main></AppShell>;
}