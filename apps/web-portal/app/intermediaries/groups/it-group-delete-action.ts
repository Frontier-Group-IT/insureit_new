"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function deleteUnlinkedGroup(groupId: string): Promise<{ok:boolean;message:string}> {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || profile.role !== "it_super_user") {
    return {ok:false,message:"Only IT Super User can delete an Intermediary Group."};
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(groupId)) {
    return {ok:false,message:"Invalid group ID."};
  }
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.rpc("it_delete_unlinked_intermediary_group",{p_group_id:groupId});
  if(error) return {ok:false,message:"Group could not be deleted. It may have linked partners, accounts, policies, audit history or login identities. No linked records were deleted."};
  if(!data) return {ok:false,message:"Group was not found."};
  revalidatePath("/intermediaries/groups");
  return {ok:true,message:"Group deleted successfully."};
}

export async function getGroupDeletePartners(groupId:string) {
 const token=await getServerAccessToken();
 const {profile}=await getAuthenticatedProfile(token);
 if(!profile?.id || profile.role!=="it_super_user") return {ok:false,partners:[],message:"Only IT Super User can manage group deletion."};
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(groupId)) return {ok:false,partners:[],message:"Invalid group."};
 const admin=createSupabaseAdminClient();
 const {data:members,error}=await admin.from("intermediary_group_memberships").select("partner_id").eq("group_id",groupId).is("effective_to",null);
 if(error) return {ok:false,partners:[],message:"Could not load group members."};
 const ids=[...new Set((members??[]).map(m=>m.partner_id))];
 if(!ids.length) return {ok:true,partners:[],message:""};
 const {data:partners,error:partnerError}=await admin.from("partners").select("id,display_name,partner_code").in("id",ids);
 if(partnerError) return {ok:false,partners:[],message:"Could not load partner names."};
 return {ok:true,partners:ids.map(id=>({id,name:partners?.find(p=>p.id===id)?.display_name??id,code:partners?.find(p=>p.id===id)?.partner_code??""})),message:""};
}

export async function removePartnersBeforeGroupDelete(groupId:string,partnerIds:string[]) {
 const token=await getServerAccessToken();
 const {profile}=await getAuthenticatedProfile(token);
 if(!profile?.id || profile.role!=="it_super_user") return {ok:false,message:"Only IT Super User can remove partners before group deletion."};
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(groupId)||!partnerIds.length||partnerIds.length>200||partnerIds.some(id=>!uuid.test(id))) return {ok:false,message:"Invalid group or partner selection."};
 const admin=createSupabaseAdminClient();
 const {data:active,error}=await admin.from("intermediary_group_memberships").select("partner_id").eq("group_id",groupId).is("effective_to",null);
 if(error) return {ok:false,message:"Unable to verify the group's active partners."};
 const activeSet=new Set((active??[]).map(r=>r.partner_id));
 if(partnerIds.some(id=>!activeSet.has(id))) return {ok:false,message:"Partner selection changed. Refresh the list before removing partners."};
 // The existing function closes membership intervals and preserves their history.
 const {data:count,error:removeError}=await admin.rpc("service_remove_intermediary_group_members",{p_partner_ids:partnerIds,p_actor_profile_id:profile.id,p_reason:"Removed by IT Super User before Group deletion"});
 if(removeError) return {ok:false,message:"Could not remove partners. No group deletion was attempted."};
 revalidatePath("/intermediaries/groups");
 revalidatePath(`/intermediaries/groups/${groupId}`);
 return {ok:true,message:`${count??partnerIds.length} partner membership(s) removed. Historical membership records are retained and may still prevent permanent deletion.`};
}
