import type { ReactNode } from "react";
import type { GroupPartnerRow } from "./group-partner-data";
import { GroupRegisterTabs } from "./group-register-tabs";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGroupAssociateManager } from "../../group-associate-access";
import { AssociateCreateForm } from "./associate-create-form";
import { GroupAssociateCreateEntry } from "./group-associate-create-entry";
import { AssociateControls } from "./associate-controls";
import { GroupAdminMenu } from "./group-admin-menu";

type Query = {success?:string; error?:string};
export async function GroupAssociateSections({id,query:q={},surface="operations",partners=[],headerPartnerAssignment}:{id:string;query?:Query;surface?:"operations"|"partner";partners?:GroupPartnerRow[];headerPartnerAssignment?:ReactNode}) {
 await requireGroupAssociateManager(id);
 const admin = createSupabaseAdminClient();
 const [associatesResult, contactResult, groupResult, identityResult] = await Promise.all([
  admin.from("group_portal_associate_accounts").select("id,name,phone_number,email,designation,address,city,state,postal_code,role,status").eq("group_id",id).order("created_at",{ascending:false}),
  admin.from("group_administrator_contacts").select("admin_name,admin_email,admin_mobile,address,city,state,postal_code").eq("group_id",id).maybeSingle(),
  admin.from("intermediary_groups").select("status").eq("id",id).maybeSingle(),
  admin.from("portal_access_identities").select("profile_id,login_email,status").eq("entity_type","group").eq("entity_id",id).limit(1).maybeSingle()
 ]);
 const associates=associatesResult.data;
 const group=groupResult.data;
 // A Group Administrator is created as a group login identity, NOT as a
 // group_portal_associate_accounts record. Always render it separately first.
 // Fall back to that identity when a legacy group lacks a contact row.
 const identity=identityResult.data;
 const {data:identityProfile,error:profileError}=identity?.profile_id
   ? await admin.from("profiles").select("full_name,email,phone").eq("id",identity.profile_id).maybeSingle()
   : {data:null,error:null};
 // The group contact is authoritative where populated; its linked login
 // profile fills missing fields without creating a duplicate Associate account.
 const contact=contactResult.data;
 const firstNonBlank=(...values:(string|null|undefined)[])=>values.find(value=>typeof value==="string"&&value.trim())?.trim()??"";
 const groupAdmin={
   admin_name:firstNonBlank(contact?.admin_name,identityProfile?.full_name),
   admin_email:firstNonBlank(contact?.admin_email,identity?.login_email,identityProfile?.email),
   admin_mobile:firstNonBlank(contact?.admin_mobile,identityProfile?.phone),
   address:contact?.address??null,city:contact?.city??null,state:contact?.state??null,postal_code:contact?.postal_code??null,
 };
 const loadError=associatesResult.error || contactResult.error || groupResult.error || identityResult.error || profileError;
 // Every Group has a Group Administrator profile row, even before its
 // contact information has been completed. Missing values render as dashes.
 const hasRegisterRecords=Boolean(group)||Boolean(associates?.length);
 const createEntry = !loadError ? <GroupAssociateCreateEntry hasRecords={hasRegisterRecords} error={q.error} form={<AssociateCreateForm groupId={id} surface={surface}/>} /> : null;
 return <div className="space-y-4">
   {loadError?<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Associate Accounts could not be loaded completely. Please retry; the register may be incomplete.</p>:null}
   {q.error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{q.error}</p>:null}
   {q.success?<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{q.success}</p>:null}
   {surface==="partner" ? <div className="relative rounded-2xl border border-[#DCE5EF] bg-white">
   <details open={Boolean(q.error)} className="group">
    <summary className="cursor-pointer p-4 text-sm font-semibold lg:pr-[430px]">Create Group Associate Account</summary>
    <AssociateCreateForm groupId={id} surface={surface}/>
   </details>
   {headerPartnerAssignment ? <div className="border-t border-[#E7ECF3] px-4 py-2 lg:absolute lg:right-4 lg:top-1 lg:w-[395px] lg:border-0 lg:p-0">{headerPartnerAssignment}</div> : null}
   </div> : null}
   <GroupRegisterTabs groupId={id} allowRemoval={surface==="operations"} partners={partners} addPartner={surface==="operations"?headerPartnerAssignment:null} associates={<section className="overflow-x-auto bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><h2 className="text-sm font-semibold">Associate Accounts Register</h2>{createEntry}</div>
    {hasRegisterRecords ? <table className="w-full min-w-[1060px] text-left text-xs"><thead className="bg-slate-50"><tr>{["Name","Phone Number","Email","Designation","Address","Role","Status","Action"].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead>
    <tbody>{groupAdmin ? <tr className="border-t bg-[#F8FBFF]">
      <td className="p-3 font-semibold">{groupAdmin.admin_name?.trim()||"—"}</td>
      <td className="p-3">{groupAdmin.admin_mobile?.trim()||"—"}</td>
      <td className="p-3">{groupAdmin.admin_email?.trim()||"—"}</td>
      <td className="p-3">Group Administrator</td>
      <td className="p-3">{[groupAdmin.address,groupAdmin.city,groupAdmin.state,groupAdmin.postal_code].filter(Boolean).join(", ")||"—"}</td>
      <td className="p-3"><span className="rounded-full border px-2 py-1">Group Administrator</span></td>
      <td className="p-3"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${identity?.status==="disabled"?"bg-red-100 text-red-700":"bg-green-100 text-green-700"}`}>{identity?.status==="disabled"?"Disabled":"Active"}</span></td>
      <td className="p-3"><GroupAdminMenu groupId={id} contact={groupAdmin} loginStatus={identity?.status==="active"||identity?.status==="disabled"?identity.status:null}/></td>
    </tr> : null}{(associates??[]).map(a=><tr key={a.id} className="border-t">
      <td className="p-3">{a.name}</td><td className="p-3">{a.phone_number}</td><td className="p-3">{a.email}</td><td className="p-3">{a.designation}</td>
      <td className="p-3">{[a.address,a.city,a.state,a.postal_code].filter(Boolean).join(", ")||"–"}</td>
      <td className="p-3"><span className="rounded-full border px-2 py-1">{{group_admin:"Group Administrator",insurance_head:"Insurance Head",claim_head:"Claim Head",bodyshop_manager:"Bodyshop Manager"}[a.role as "group_admin"|"insurance_head"|"claim_head"|"bodyshop_manager"]||a.role}</span></td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${a.status==="disabled"?"bg-red-100 text-red-700":"bg-green-100 text-green-700"}`}>{a.status==="disabled"?"Disabled":"Active"}</span></td>
      <td className="p-3"><AssociateControls groupId={id} associate={a} surface={surface}/></td>
    </tr>)}</tbody></table> : null}

   </section>} />
 </div>;
}
