import type { ReactNode } from "react";
import type { GroupPartnerRow } from "./group-partner-data";
import { GroupRegisterTabs } from "./group-register-tabs";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGroupAssociateManager } from "../../group-associate-access";
import { AssociateCreateForm } from "./associate-create-form";
import { GroupAssociateCreateEntry } from "./group-associate-create-entry";
import { AssociateControls } from "./associate-controls";

type Query = {success?:string; error?:string};
export async function GroupAssociateSections({id,query:q={},surface="operations",partners=[],headerPartnerAssignment}:{id:string;query?:Query;surface?:"operations"|"partner";partners?:GroupPartnerRow[];headerPartnerAssignment?:ReactNode}) {
 await requireGroupAssociateManager(id);
 const admin = createSupabaseAdminClient();
 const {data:associates} = await admin.from("group_portal_associate_accounts").select("id,name,phone_number,email,designation,address,city,state,postal_code,role,status").eq("group_id",id).order("created_at",{ascending:false});
 return <div className="space-y-4">
   {q.error?<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{q.error}</p>:null}
   {q.success?<p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{q.success}</p>:null}
   <div className="relative rounded-2xl border border-[#DCE5EF] bg-white">
   <details open={Boolean(q.error)} className="group">
    <summary className="cursor-pointer p-4 text-sm font-semibold lg:pr-[430px]">Create Group Associate Account</summary>
    <AssociateCreateForm groupId={id} surface={surface}/>
   </details>
   {headerPartnerAssignment ? <div className="border-t border-[#E7ECF3] px-4 py-2 lg:absolute lg:right-4 lg:top-1 lg:w-[395px] lg:border-0 lg:p-0">{headerPartnerAssignment}</div> : null}
   </div>
   <GroupRegisterTabs partners={partners} associates={<section className="overflow-x-auto bg-white">
    <h2 className="border-b p-4 text-sm font-semibold">Associate Accounts Register</h2>
    {(associates??[]).length ? <table className="w-full min-w-[1060px] text-left text-xs"><thead className="bg-slate-50"><tr>{["Name","Phone Number","Email","Designation","Address","Role","Status","Action"].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead>
    <tbody>{(associates??[]).map(a=><tr key={a.id} className="border-t">
      <td className="p-3">{a.name}</td><td className="p-3">{a.phone_number}</td><td className="p-3">{a.email}</td><td className="p-3">{a.designation}</td>
      <td className="p-3">{[a.address,a.city,a.state,a.postal_code].filter(Boolean).join(", ")||"–"}</td>
      <td className="p-3"><span className="rounded-full border px-2 py-1">{{group_admin:"Group Administrator",insurance_head:"Insurance Head",claim_head:"Claim Head",bodyshop_manager:"Bodyshop Manager"}[a.role as "group_admin"|"insurance_head"|"claim_head"|"bodyshop_manager"]||a.role}</span></td><td className="p-3">{a.status}</td>
      <td className="p-3"><AssociateControls groupId={id} associate={a} surface={surface}/></td>
    </tr>)}</tbody></table> : null}
    <GroupAssociateCreateEntry hasRecords={Boolean(associates?.length)} error={q.error} form={<AssociateCreateForm groupId={id} surface={surface}/>}/>
   </section>} />
 </div>;
}
