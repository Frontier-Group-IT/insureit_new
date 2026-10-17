import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGroupAssociateManager } from "../../group-associate-access";
import { GroupAssociateSections } from "./associate-sections";
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
 const content=(<main className="mx-auto max-w-[1480px] space-y-4">
  <header className="flex items-center justify-between rounded-2xl bg-[#0D2C5C] p-5 text-white"><div><h1 className="text-xl font-semibold">Associate Accounts Review</h1><p className="text-sm">{group.group_name} · {group.group_code}</p></div><Link className="rounded-xl border border-white/40 px-4 py-2 text-xs" href={`/intermediaries/groups/${id}`}>Back to Group</Link></header>
  <GroupAssociateSections id={id} query={q} surface={surface}/>
 </main>);
 return surface==="partner"
 ? <PartnerPortalShell title="Group Associate Accounts">{content}</PartnerPortalShell>
 : <AppShell title="Group Associate Accounts" backHref={`/intermediaries/groups/${id}`}>{content}</AppShell>;
}
