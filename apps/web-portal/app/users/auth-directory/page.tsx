import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { AuthDirectoryTable, type DirectoryRow } from "./auth-directory-table";

type Profile = {id:string;full_name:string|null;role:string;email:string|null;is_active:boolean};
type Identity = {profile_id:string;entity_id:string;entity_type:string;status:string;login_email:string|null};
type Named = {id:string;display_name?:string|null;group_name?:string|null;parent_partner_id?:string|null};
async function fetchRows<T>(table:string,columns:string):Promise<T[]> {
  const admin=createSupabaseAdminClient();
  const result=await admin.from(table).select(columns).limit(5000);
  if(result.error) throw new Error("Cannot load identity directory data.");
  return (result.data??[]) as T[];
}
export default async function AuthDirectoryPage({searchParams}:{searchParams?:Promise<{user_id?:string}>}) {
  const requestedUserId=(await searchParams)?.user_id??null;
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile || profile.role !== "it_super_user" || !profile.is_active) redirect("/access-denied");
  const admin=createSupabaseAdminClient();
  const users: {id:string;email?:string;phone?:string;created_at:string;last_sign_in_at?:string|null;email_confirmed_at?:string|null;phone_confirmed_at?:string|null;user_metadata?:Record<string,unknown>}[]=[];
  for(let page=1;page<=30;page++){
    const response=await admin.auth.admin.listUsers({page,perPage:500});
    if(response.error) throw new Error("Could not load Auth users.");
    users.push(...response.data.users);
    if(response.data.users.length<500) break;
  }
  const [profiles,identities,partners,intermediaries,groups]=await Promise.all([
    fetchRows<Profile>("profiles","id,full_name,role,email,is_active"),
    fetchRows<Identity>("portal_access_identities","profile_id,entity_id,entity_type,status,login_email"),
    fetchRows<Named>("partners","id,display_name,parent_partner_id"),
    fetchRows<Named>("intermediaries","id,display_name"),
    fetchRows<Named>("intermediary_groups","id,group_name")
  ]);
  const profileById=new Map(profiles.map(p=>[p.id,p]));
  const identityById=new Map(identities.map(p=>[p.profile_id,p]));
  const partnerById=new Map(partners.map(p=>[p.id,p]));
  const names=new Map([...partners.map(p=>[p.id,p.display_name??""] as const),...intermediaries.map(p=>[p.id,p.display_name??""] as const),...groups.map(p=>[p.id,p.group_name??""] as const)]);
  const rows:DirectoryRow[]=users.map(u=>{
    const p=profileById.get(u.id);
    const identity=identityById.get(u.id);
    const role=p?.role??"Unlinked";
    const phoneLogin=role==="customer"||(!p&&Boolean(u.phone)&&!u.email)||Boolean(u.email?.endsWith("@customer-login.insureit.invalid"));
    const accountType=phoneLogin?"Customer":identity?.entity_type?identity.entity_type.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase()):role==="intermediary"?"Intermediary":"Employee / Internal";
    const parent=identity?.entity_id?partnerById.get(identity.entity_id)?.parent_partner_id:null;
    const organization=(identity?.entity_id?names.get(identity.entity_id):"")||(parent?names.get(parent):"")||"";
    const authEmail=phoneLogin?"":u.email??"";
    const profileEmail=phoneLogin?"":p?.email??"";
    const warnings:string[]=[];
    if(!p)warnings.push("No linked portal profile");
    if(!phoneLogin&&authEmail&&profileEmail&&authEmail.toLowerCase()!==profileEmail.toLowerCase())warnings.push("Auth and profile email mismatch");
    if(!phoneLogin&&!u.email_confirmed_at)warnings.push("Email unconfirmed");
    if(p&&!p.is_active)warnings.push("Profile inactive");
    return {id:u.id,name:p?.full_name?.trim()||(phoneLogin?"Customer · identity "+u.id.slice(0,8):"Unnamed Auth user"),role,
      accountType,organization,authEmail,profileEmail,loginMethod:phoneLogin?"Phone":"Email",status:p?(p.is_active?"Active":"Inactive"):"No profile",
      confirmed:phoneLogin?Boolean(u.phone_confirmed_at):Boolean(u.email_confirmed_at),
      lastSignIn:u.last_sign_in_at??null,createdAt:u.created_at,identityStatus:identity?.status??"No portal identity",warning:warnings};
  });
  return <AppShell title="Auth Password Management"><main className="mx-auto max-w-[1700px] space-y-4 pb-8">
    <header><h1 className="text-xl font-bold text-slate-900">Auth Password Management</h1><p className="text-xs text-slate-500">IT Super User · Complete Supabase Auth directory · customer phone numbers concealed</p></header>
    <AuthDirectoryTable rows={rows} requestedUserId={requestedUserId}/>
  </main></AppShell>;
}
