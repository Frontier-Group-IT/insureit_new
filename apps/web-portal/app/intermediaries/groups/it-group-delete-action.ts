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

/**
 * Preserve historical foreign keys by archiving an empty group.
 * This is not a physical deletion. It removes the group from the active register.
 */
export async function archiveGroupAfterPartnerRemoval(groupId:string):Promise<{ok:boolean;message:string}> {
 const token=await getServerAccessToken();
 const {profile}=await getAuthenticatedProfile(token);
 if(!profile?.id||profile.role!=="it_super_user") return {ok:false,message:"Only IT Super User can remove a group from the active register."};
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(!uuid.test(groupId)) return {ok:false,message:"Invalid group."};
 const admin=createSupabaseAdminClient();
 const {data:members,error:membersError}=await admin.from("intermediary_group_memberships").select("id").eq("group_id",groupId).is("effective_to",null).limit(1);
 if(membersError) return {ok:false,message:"Could not verify the group's memberships."};
 if(members?.length) return {ok:false,message:"Remove all active partners from this Group before proceeding."};
 // Do not leave active access to an archived group.
 const {data:identities,error:identityError}=await admin.from("portal_access_identities").select("id").eq("entity_type","group").eq("entity_id",groupId).eq("status","active").limit(1);
 if(identityError) return {ok:false,message:"Could not verify Group login identities."};
 if(identities?.length) return {ok:false,message:"Group has an active login identity. Deactivate or reassign the Group login before archiving."};
 const {error}=await admin.rpc("service_archive_intermediary_group",{p_group_id:groupId,p_actor_profile_id:profile.id});
 if(error) return {ok:false,message:"Could not archive Group. No partner, policy, claim or audit data was changed."};
 revalidatePath("/intermediaries/groups");
 revalidatePath(`/intermediaries/groups/${groupId}`);
 return {ok:true,message:"Group archived and removed from active Group Register. Historical records remain preserved."};
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
 // Scope the change to this group. The legacy partner-ID-only RPC can close
 // memberships in OTHER groups, so it must not be used here.
 const {data:removed,error:removeError}=await admin.from("intermediary_group_memberships")
   .update({
     effective_to:new Date().toISOString(),
     removed_by:profile.id,
     change_reason:"Removed by IT Super User from selected Group",
     updated_at:new Date().toISOString(),
   })
   .eq("group_id",groupId)
   .in("partner_id",partnerIds)
   .is("effective_to",null)
   .select("id");
 if(removeError) return {ok:false,message:"Could not remove partners. No group deletion was attempted."};
 const count=removed?.length??0;
 revalidatePath("/intermediaries/groups");
 revalidatePath(`/intermediaries/groups/${groupId}`);
 return {ok:true,message:`${count} partner membership(s) removed from this Group only. Partner accounts, other groups and historical memberships are preserved. Historical links may still block permanent Group deletion.`};
}
