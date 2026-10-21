"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type ArchiveResult = {status:"success"|"error";message:string};

/**
 * Offboarding is distinct from permanent deletion. A user's profile and Auth ID remain
 * available for historical FKs (including submitted policy intakes and audit entries).
 */
export async function archiveUserIdentity(userId:string, confirmation:string):Promise<ArchiveResult> {
 const {profile:actor}=await getAuthenticatedProfile(await getServerAccessToken());
 if(!actor?.id||!actor.is_active||actor.role!=="it_super_user")return {status:"error",message:"Only the active IT Super User can archive accounts."};
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId)||confirmation!=="ARCHIVE USER")return {status:"error",message:"Invalid user or confirmation."};
 if(actor.id===userId)return {status:"error",message:"The primary IT Super User cannot archive their own account."};
 const admin=createSupabaseAdminClient();
 const [{data:user,error:authError},{data:target,error:profileError}]=await Promise.all([
   admin.auth.admin.getUserById(userId),
   admin.from("profiles").select("id,full_name,role,is_active,employee_id").eq("id",userId).maybeSingle<{id:string;full_name:string;role:string;is_active:boolean;employee_id:string|null}>()
 ]);
 if(authError||!user.user||profileError||!target)return {status:"error",message:"Account lookup failed; no changes made."};
 if(target.role==="it_super_user"||target.role==="it_user")return {status:"error",message:"IT administrator accounts require separate protected offboarding."};
 if(!target.is_active)return {status:"error",message:"This portal profile is already inactive. Verify whether its Auth login also needs revocation."};

 // An audit record must be writable before any account change.
 const {error:auditError}=await admin.from("audit_logs").insert({
   actor_id:actor.id,action:"it_identity_archive_requested",table_name:"profiles",record_id:userId,
   new_data:{history_preserved:true,profile_retained:true,employee_id:target.employee_id}
 });
 if(auditError)return {status:"error",message:"Audit logging unavailable; no account changes made."};

 // Disable Supabase password sign-ins first; preserve the Auth row for foreign keys.
 const {error:banError}=await admin.auth.admin.updateUserById(userId,{ban_duration:"876000h"});
 if(banError)return {status:"error",message:"Could not revoke login. Profile and business records were not changed."};

 const {error:profileUpdateError}=await admin.from("profiles").update({is_active:false}).eq("id",userId).eq("is_active",true);
 if(profileUpdateError)return {status:"error",message:"Login was banned, but the profile update failed. Retry after reviewing this account; business history is preserved."};

 if(target.employee_id){
   const {error:employeeError}=await admin.from("employees")
     .update({employment_status:"inactive",updated_by:actor.id,updated_at:new Date().toISOString()})
     .eq("id",target.employee_id);
   if(employeeError)return {status:"error",message:"Login and profile were disabled, but Employee Directory status could not be updated. Please review the employee status; historical records remain intact."};
 }
 await admin.from("audit_logs").insert({
   actor_id:actor.id,action:"it_identity_archived",table_name:"profiles",record_id:userId,
   new_data:{login_banned:true,profile_active:false,employee_inactive:Boolean(target.employee_id),historical_records_preserved:true}
 });
 revalidatePath("/users/auth-directory");
 revalidatePath("/employees");
 revalidatePath("/users");
 return {status:"success",message:"Account archived: login disabled and profile marked inactive. Completed intakes, policies, documents and historical attribution remain untouched. Existing sessions may remain valid until expiry; review open assignments separately."};
}
