import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getIntermediaryGroupManager, getIntermediaryGroupEmployeeScope } from "@/lib/intermediary-group-access";
import { FormSubmitButton } from "@/components/form-submit-button";
import { archiveBusinessGroup, assignBusinessGroupMembers, convertLegacyGroupToBusiness, removeBusinessGroupMembers, renameBusinessGroup } from "../business-group-actions";

export async function GroupMembershipManagement({id,groupMode,groupName,partners}:{id:string;groupMode:string;groupName:string;partners:Array<{id:string;partner_code:string;display_name:string}>}) {
 const manager=await getIntermediaryGroupManager();
 if(!manager) return null;
 const admin=createSupabaseAdminClient();
 const scope=await getIntermediaryGroupEmployeeScope(manager);
 const [candidates,occupied] = scope.mode==="organization" ? await Promise.all([
  admin.from("partners").select("id,partner_code,display_name").is("parent_partner_id",null).eq("partner_status","active_partner").order("display_name").limit(500),
  admin.from("intermediary_group_memberships").select("partner_id").is("effective_to",null)
 ]) : [{data:[]},{data:[]}];
 const assigned=new Set(partners.map(p=>p.id));
 const occupiedIds=new Set((occupied.data??[]).map(p=>p.partner_id));
 const choices=(candidates.data??[]).filter(p=>!assigned.has(p.id)&&!occupiedIds.has(p.id));
 return <details className="rounded-2xl border border-[#DCE5EF] bg-white">
  <summary className="cursor-pointer px-5 py-4 text-[12px] font-semibold text-[#17365D]">Group Management — Partners and settings</summary>
  <div className="space-y-4 border-t border-[#E7ECF3] p-4">
   <form action={renameBusinessGroup} className="flex flex-wrap items-end gap-2">
    <input type="hidden" name="group_id" value={id}/>
    <label className="grid flex-1 gap-1 text-[10px] text-[#64748B]">Group Name<input name="group_name" required defaultValue={groupName} className="h-9 rounded-lg border px-3 text-[11px]"/></label>
    <FormSubmitButton label="Update Group" pendingLabel="Saving…" className="h-9 rounded-lg bg-[#17365D] px-4 text-[10px] font-semibold text-white"/>
   </form>
   {groupMode==="legacy_employee"?<form action={convertLegacyGroupToBusiness}><input type="hidden" name="group_id" value={id}/><FormSubmitButton label="Convert legacy Group safely" pendingLabel="Converting…" className="h-9 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[10px] text-amber-700"/></form>:null}
   <div className="space-y-2"><p className="text-[11px] font-semibold">Assigned Partners</p>
   {partners.length?partners.map(p=><form action={removeBusinessGroupMembers} key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#E7ECF3] px-3 py-2"><input type="hidden" name="group_id" value={id}/><input type="hidden" name="partner_id" value={p.id}/><span className="text-[11px]">{p.display_name} · {p.partner_code}</span><FormSubmitButton label="Remove" pendingLabel="Removing…" className="rounded-lg border border-red-200 px-3 py-1.5 text-[10px] text-red-700"/></form>):<p className="text-[10px] text-[#64748B]">No Partners assigned.</p>}</div>
   {scope.mode==="organization"&&groupMode==="business"&&choices.length?<form action={assignBusinessGroupMembers} className="flex flex-wrap items-end gap-2"><input type="hidden" name="group_id" value={id}/><label className="grid flex-1 gap-1 text-[10px] text-[#64748B]">Add / move Partner<select name="partner_id" required defaultValue="" className="h-9 rounded-lg border px-3 text-[11px]"><option value="" disabled>Select ungrouped Partner</option>{choices.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.partner_code}</option>)}</select></label><FormSubmitButton label="Add to Group" pendingLabel="Adding…" className="h-9 rounded-lg border px-3 text-[10px]"/></form>:null}
   {partners.length===0?<form action={archiveBusinessGroup}><input type="hidden" name="group_id" value={id}/><FormSubmitButton label="Archive empty Group" pendingLabel="Archiving…" className="rounded-lg border border-red-200 px-3 py-2 text-[10px] text-red-700"/></form>:null}
   <Link href={`/intermediaries/groups/${id}/edit`} className="text-[10px] font-semibold text-blue-700 underline">More Group details and configuration</Link>
  </div>
 </details>;
}
