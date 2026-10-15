import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, UsersRound, Building2, ShieldCheck, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGroupAssociateManager } from "../group-associate-access";
export const dynamic="force-dynamic";
export default async function GroupDetailsPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{warning?:string;success?:string}>}) {
 const {id}=await params;
 await requireGroupAssociateManager(id);
 const admin=createSupabaseAdminClient();
 const [{data:group},{data:memberships},{data:contact},{data:access}]=await Promise.all([
   admin.from("intermediary_groups").select("id,group_code,group_name,description,status,group_mode,created_at").eq("id",id).maybeSingle(),
   admin.from("intermediary_group_memberships").select("partner_id").eq("group_id",id).is("effective_to",null),
   admin.from("group_administrator_contacts").select("admin_name,admin_email,admin_mobile,address,city,state,postal_code").eq("group_id",id).maybeSingle(),
   admin.from("portal_access_identities").select("login_email,status").eq("entity_type","group").eq("entity_id",id).maybeSingle()
 ]);
 if(!group)notFound();
 const ids=(memberships??[]).map(m=>m.partner_id);
 const {data:partners}=ids.length?await admin.from("partners").select("id,partner_code,display_name").in("id",ids):{data:[]};
 const q=await searchParams;
 const field=(label:string,value:string|number|null|undefined)=><div className="space-y-1"><p className="text-[10px] font-medium uppercase tracking-wide text-[#6C7E95]">{label}</p><p className="text-[13px] font-semibold text-[#203C61]">{value||"—"}</p></div>;
 return <AppShell title="Group Details" backHref="/intermediaries/groups">
  <main className="mx-auto max-w-[1550px] space-y-4 pb-16">
   <header className="overflow-hidden rounded-[20px] border border-[#183E76] bg-[linear-gradient(105deg,#0C2655,#154885)] text-white shadow-[0_12px_30px_rgba(17,44,86,.14)]">
    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
     <div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-full bg-white text-blue-700"><Building2 className="h-6 w-6"/></span>
      <div><h1 className="text-[21px] font-bold tracking-tight">Business Group Review</h1>
       <div className="mt-1 flex items-center gap-3"><strong className="text-[13px]">{group.group_name}</strong><span className="rounded-lg border border-white/30 bg-white/10 px-2 py-1 text-[11px]">{group.group_code}</span></div>
      </div>
     </div>
     <div className="flex items-center gap-2">
      <Link href={`/intermediaries/groups/${id}/associate-accounts`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 text-xs font-semibold hover:bg-white/20"><UsersRound className="h-4 w-4"/> Associate Accounts</Link>
      <Link href={`/intermediaries/groups/${id}/edit`} aria-label="Edit Group details" className="grid h-10 w-10 place-items-center rounded-xl border border-white/40 bg-white/10 hover:bg-white/20"><Pencil className="h-4 w-4"/></Link>
     </div>
    </div>
    <div className="grid divide-y divide-white/15 border-t border-white/20 bg-white/5 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
     {[["status","GROUP STATUS",group.status],[UsersRound,"PARTNERS",String(partners?.length??0)],[Building2,"GROUP TYPE",group.group_mode],[CalendarDays,"CREATED",new Date(group.created_at).toLocaleDateString("en-IN")]].map(([_type,label,value],i)=><div key={label as string} className="flex items-center gap-3 p-4"><span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">{i===0?<ShieldCheck className="h-4 w-4"/>:i===1?<UsersRound className="h-4 w-4"/>:i===2?<Building2 className="h-4 w-4"/>:<CalendarDays className="h-4 w-4"/>}</span><div><p className="text-[9px] text-white/70">{label as string}</p><strong className="text-xs">{value as string}</strong></div></div>)}
    </div>
   </header>
   {q.warning?<div role="alert" className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-3 text-xs text-orange-700">{q.warning}</div>:null}
   {q.success?<div className="rounded-xl border border-green-200 bg-green-50 px-5 py-3 text-xs text-green-700">Group saved. Review administrator details and invitation status.</div>:null}
   <div className="grid gap-4 lg:grid-cols-2">
    <section className="rounded-2xl border border-[#DDE6EF] bg-white">
     <h2 className="border-b px-5 py-4 text-sm font-bold text-[#18365F]">Group identity & administrator</h2>
     <div className="grid grid-cols-2 gap-6 p-6">{field("Group Name",group.group_name)}{field("Group Code",group.group_code)}{field("Admin Name",contact?.admin_name)}{field("Admin Email",contact?.admin_email||access?.login_email)}{field("Admin Mobile",contact?.admin_mobile)}{field("Role","Group Administrator")}</div>
    </section>
    <section className="rounded-2xl border border-[#DDE6EF] bg-white">
     <h2 className="border-b px-5 py-4 text-sm font-bold text-[#18365F]">Address & portal access</h2>
     <div className="grid grid-cols-2 gap-6 p-6">{field("Address",contact?.address)}{field("City",contact?.city)}{field("State",contact?.state)}{field("PIN Code",contact?.postal_code)}{field("Login Email",access?.login_email)}{field("Login Status",access?.status||"Not provisioned")}</div>
    </section>
   </div>
   <section className="overflow-hidden rounded-2xl border border-[#DDE6EF] bg-white">
    <h2 className="border-b px-5 py-4 text-sm font-bold text-[#18365F]">Associated Partners</h2>
    <div className="divide-y divide-[#EDF1F5]">{(partners??[]).map(p=><div key={p.id} className="flex justify-between gap-4 px-5 py-4 text-xs"><strong>{p.display_name}</strong><span className="text-[#6A7D95]">{p.partner_code}</span></div>)}
     {!(partners??[]).length?<p className="px-5 py-5 text-xs text-[#718198]">No active Partner assignments.</p>:null}</div>
   </section>
  </main>
 </AppShell>;
}
