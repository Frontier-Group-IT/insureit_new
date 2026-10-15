import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGroupAssociateManager } from "../group-associate-access";
export const dynamic = "force-dynamic";
export default async function GroupDetailsPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 await requireGroupAssociateManager(id);
 const admin=createSupabaseAdminClient();
 const [{data:group},{data:memberships}]=await Promise.all([
   admin.from("intermediary_groups").select("id,group_code,group_name,description,status,group_mode").eq("id",id).maybeSingle(),
   admin.from("intermediary_group_memberships").select("partner_id").eq("group_id",id).is("effective_to",null)
 ]);
 if(!group)notFound();
 const ids=(memberships??[]).map(m=>m.partner_id);
 const {data:partners}=ids.length?await admin.from("partners").select("id,partner_code,display_name").in("id",ids):{data:[]};
 return <AppShell title="Group Details" backHref="/intermediaries/groups">
  <div className="mx-auto max-w-[1480px] space-y-4 p-1">
   <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0D2C5C] p-5 text-white">
    <div><div className="text-[10px] text-white/70">Business Group · {group.group_code}</div>
    <h1 className="mt-1 text-xl font-bold">{group.group_name}</h1>
    <div className="text-xs text-white/70">{group.description||"Group hierarchy and administration"}</div></div>
    <Link className="rounded-xl border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20" href={`/intermediaries/groups/${id}/associate-accounts`}>Associate Accounts →</Link>
   </header>
   <section className="rounded-2xl border border-[#DCE5EF] bg-white p-5">
    <h2 className="mb-3 font-semibold">Group information</h2>
    <p className="text-sm">Status: {group.status} · Type: {group.group_mode}</p>
    <p className="mt-1 text-sm">Active Partners: {partners?.length??0}</p>
   </section>
   <section className="rounded-2xl border border-[#DCE5EF] bg-white p-5">
    <h2 className="mb-3 font-semibold">Associated Partners</h2>
    {(partners??[]).map(p=><div key={p.id} className="border-b border-slate-100 py-3 text-sm">{p.display_name} <span className="text-slate-500">({p.partner_code})</span></div>)}
    {!(partners??[]).length?<p className="text-sm text-slate-500">No active Partner assignments.</p>:null}
   </section>
  </div>
 </AppShell>;
}
