import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, UsersRound, Building2, CalendarDays, UserRoundCog, Check } from "lucide-react";
import { GroupAssociateSections } from "./associate-accounts/associate-sections";
import { GroupSuccessFeedback } from "./group-success-feedback";
import { GroupHeaderPartnerAssignment } from "./associate-accounts/header-partner-assignment";
import { loadGroupPartnerRegisterRows } from "./associate-accounts/group-partner-data";
import { AppShell } from "@/components/shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGroupAssociateManager } from "../group-associate-access";
export const dynamic="force-dynamic";
export default async function GroupDetailsPage({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{warning?:string;success?:string;error?:string}>}) {
 const {id}=await params;
 await requireGroupAssociateManager(id);
 const admin=createSupabaseAdminClient();
 const [{data:group},{data:memberships},{data:associateCount},{data:adminContact},{data:loginIdentity}]=await Promise.all([
   admin.from("intermediary_groups").select("id,group_code,group_name,description,status,group_mode,created_at").eq("id",id).maybeSingle(),
   admin.from("intermediary_group_memberships").select("partner_id").eq("group_id",id).is("effective_to",null),
   admin.from("group_portal_associate_accounts").select("id",{count:"exact",head:true}).eq("group_id",id),
   admin.from("group_administrator_contacts").select("admin_name").eq("group_id",id).maybeSingle(),
   admin.from("portal_access_identities").select("profile_id").eq("entity_type","group").eq("entity_id",id).maybeSingle()
 ]);
 if(!group)notFound();
 const ids=(memberships??[]).map(m=>m.partner_id);
 const {data:partners}=ids.length?await admin.from("partners").select("id,partner_code,display_name,source_application_id").in("id",ids):{data:[]};
 const partnerRegisterRows=await loadGroupPartnerRegisterRows(admin,partners??[]);
 const {data:adminProfile}=loginIdentity?.profile_id ? await admin.from("profiles").select("full_name").eq("id",loginIdentity.profile_id).maybeSingle() : {data:null};
 const administratorName=adminContact?.admin_name?.trim()||adminProfile?.full_name?.trim()||"—";
 const q=await searchParams;

 return <AppShell title="Group Details" backHref="/intermediaries/groups">
  <main className="mx-auto max-w-[1550px] space-y-4 pb-16">
   <header className="overflow-hidden rounded-[20px] border border-[#183E76] bg-[linear-gradient(105deg,#0C2655,#154885)] text-white shadow-[0_12px_30px_rgba(17,44,86,.14)]">
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
     <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-white text-blue-700"><Building2 className="h-5 w-5"/></span>
      <h1 className="text-[18px] font-bold tracking-tight">{group.group_name}</h1>
      <span className={group.status === "active" ? "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800" : "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900"}>{group.status === "active" ? <Check className="h-3.5 w-3.5" aria-label="Active" /> : group.status}</span>
     </div>
     <Link href={`/intermediaries/groups/${id}/edit`} aria-label="Edit Group details" className="grid h-10 w-10 place-items-center rounded-xl border border-white/40 bg-white/10 hover:bg-white/20"><Pencil className="h-4 w-4"/></Link>
    </div>
    <div className="grid divide-y divide-white/15 border-t border-white/20 bg-white/5 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
     {[
       {label:"ADMINISTRATOR",value:administratorName,icon:<UserRoundCog className="h-4 w-4"/>},
       {label:"PARTNERS",value:String(partners?.length??0),icon:<UsersRound className="h-4 w-4"/>},
       {label:"ASSOCIATES",value:String(1+(associateCount??0)),icon:<UsersRound className="h-4 w-4"/>},
       {label:"CREATED",value:new Date(group.created_at).toLocaleDateString("en-IN"),icon:<CalendarDays className="h-4 w-4"/>}
     ].map(item=><div key={item.label} className="flex min-w-0 items-center gap-2 px-4 py-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10">{item.icon}</span><div className="min-w-0"><p className="text-[9px] text-white/70">{item.label}</p><strong className="break-words text-xs">{item.value}</strong></div></div>)}
    </div>
   </header>
   {q.warning?<div role="alert" className="rounded-xl border border-orange-200 bg-orange-50 px-5 py-3 text-xs text-orange-700">{q.warning}</div>:null}
   <GroupSuccessFeedback success={q.success} />
   <GroupAssociateSections id={id} query={{error:q.error}} surface="operations" partners={partnerRegisterRows} headerPartnerAssignment={<GroupHeaderPartnerAssignment groupId={id}/>} />


  </main>
 </AppShell>;
}
