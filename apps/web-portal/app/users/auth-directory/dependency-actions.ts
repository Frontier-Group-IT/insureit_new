"use server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

type Contact = {group_id:string;profile_id:string;admin_name:string;admin_email:string;admin_mobile:string;address:string;city:string;state:string;postal_code:string};
type Blocker = {table:string;column:string;count:number;delete_rule:string};
async function context(userId:string) {
 const {profile}=await getAuthenticatedProfile(await getServerAccessToken());
 if(!profile?.id||profile.role!=="it_super_user"||!profile.is_active)throw new Error("IT Super User permission required.");
 if(profile.id===userId)throw new Error("You cannot resolve dependencies on your own account.");
 const admin=createSupabaseAdminClient();
 const {data:target,error:targetError}=await admin.from("profiles").select("id,role").eq("id",userId).maybeSingle();
 if(targetError||!target)throw new Error("Portal profile not found.");
 if(target.role==="it_super_user")throw new Error("IT Super User accounts cannot be modified here.");
 return {admin,actorId:profile.id};
}
export async function inspectIdentityDependencies(userId:string) {
 const {admin}=await context(userId);
 const [{data:blocks,error:blockError},{data:contacts,error:contactError}]=await Promise.all([
   admin.rpc("admin_hard_delete_blockers",{p_target_table:"profiles",p_target_id:userId}),
   admin.from("group_administrator_contacts").select("group_id,profile_id,admin_name,admin_email,admin_mobile,address,city,state,postal_code").eq("profile_id",userId)
 ]);
 if(blockError||contactError)throw new Error("Could not inspect protected relationships.");
 const groups=await Promise.all(((contacts??[]) as Contact[]).map(async contact=>{
   const {data}=await admin.from("intermediary_groups").select("group_name,status").eq("id",contact.group_id).maybeSingle();
   return {...contact,group_name:data?.group_name??"Unknown group",group_status:data?.status??"Unknown"};
 }));
 return {blockers:(Array.isArray(blocks)?blocks:[]) as Blocker[],groups};
}
export async function resolveGroupAdminContact(userId:string,groupId:string,mode:"remove_test"|"reassign",confirmation:string,newProfileId?:string) {
 const {admin,actorId}=await context(userId);
 const {data:contact,error:contactError}=await admin.from("group_administrator_contacts").select("group_id,profile_id,admin_name,admin_email").eq("group_id",groupId).eq("profile_id",userId).maybeSingle();
 if(contactError||!contact)throw new Error("Relationship no longer exists. Refresh dependency list.");
 const {data:group,error:groupError}=await admin.from("intermediary_groups").select("group_name,status").eq("id",groupId).maybeSingle();
 if(groupError||!group)throw new Error("Group not found.");
 if(mode==="remove_test") {
   if(confirmation!==`REMOVE CONTACT ${group.group_name}`)throw new Error("Confirmation does not match the exact group name.");
   // Only detach a test contact after an explicit confirmation; never delete its business group or related data.
   const {error:auditError}=await admin.from("audit_logs").insert({actor_id:actorId,action:"it_dependency_contact_detach",table_name:"group_administrator_contacts",record_id:groupId,new_data:{from_profile:userId,group:group.group_name,action:"remove_test_contact"}});
   if(auditError)throw new Error("Audit unavailable; no change made.");
   const {error}=await admin.from("group_administrator_contacts").delete().eq("group_id",groupId).eq("profile_id",userId);
   if(error)throw new Error("Cannot remove this relationship. Group and account were preserved.");
 } else if(mode==="reassign") {
   if(!newProfileId||newProfileId===userId)throw new Error("Choose a different administrator.");
   if(confirmation!==`REASSIGN ${group.group_name}`)throw new Error("Confirmation does not match the group name.");
   const {data:replacement,error:replacementError}=await admin.from("profiles").select("id,full_name,email,role,is_active").eq("id",newProfileId).maybeSingle();
   if(replacementError||!replacement?.is_active||replacement.role!=="intermediary"||!replacement.email||!replacement.full_name)throw new Error("Replacement must be an active intermediary with name and email.");
   const {error:auditError}=await admin.from("audit_logs").insert({actor_id:actorId,action:"it_dependency_contact_reassignment",table_name:"group_administrator_contacts",record_id:groupId,new_data:{from_profile:userId,to_profile:newProfileId,group:group.group_name}});
   if(auditError)throw new Error("Audit unavailable; no change made.");
   const {error}=await admin.from("group_administrator_contacts").update({profile_id:newProfileId,admin_name:replacement.full_name,admin_email:replacement.email,updated_by:actorId}).eq("group_id",groupId).eq("profile_id",userId);
   if(error)throw new Error("Reassignment blocked; no identity deletion performed.");
 } else throw new Error("Unsupported action.");
 revalidatePath("/users/auth-directory");
 return inspectIdentityDependencies(userId);
}
