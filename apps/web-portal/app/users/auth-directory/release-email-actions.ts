"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type ReleaseEmailResult = {status:"success"|"error";message:string};

const isUuid=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const isValidEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const normalize=(value:string|null|undefined)=>value?.trim().toLowerCase()??"";

export async function archiveAndReleaseLoginEmail(userId:string, expectedEmail:string, confirmation:string):Promise<ReleaseEmailResult>{
 const {profile:actor}=await getAuthenticatedProfile(await getServerAccessToken());
 if(!actor?.id||!actor.is_active||actor.role!=="it_super_user")return {status:"error",message:"Only an active IT Super User can release login emails."};
 if(!isUuid(userId)||userId===actor.id)return {status:"error",message:"Invalid target or protected administrator account."};
 const requested=normalize(expectedEmail);
 if(!isValidEmail(requested)||confirmation!==`RELEASE ${requested}`)return {status:"error",message:"Type the exact RELEASE confirmation for the account email."};
 const admin=createSupabaseAdminClient();
 const [{data:auth,error:authError},{data:profile,error:profileError}]=await Promise.all([
   admin.auth.admin.getUserById(userId),
   admin.from("profiles").select("id,full_name,role,is_active,employee_id,email").eq("id",userId).maybeSingle<{id:string;full_name:string;role:string;is_active:boolean;employee_id:string|null;email:string|null}>()
 ]);
 if(authError||!auth.user||profileError||!profile)return {status:"error",message:"Selected Auth user or profile could not be verified."};
 if(profile.role==="it_super_user"||profile.role==="it_user"||profile.role==="customer")return {status:"error",message:"Protected IT or customer phone identities cannot use this release workflow."};
 if(normalize(auth.user.email)!==requested)return {status:"error",message:"Login email has changed. Refresh the directory and review the account before proceeding."};
 // Profile contact emails may intentionally differ from the login; do not alter unrelated history.

 const employeeId=profile.employee_id;
 if(employeeId){
   const {data:employee,error:employeeError}=await admin.from("employees").select("id,email,employment_status").eq("id",employeeId).maybeSingle<{id:string;email:string|null;employment_status:string}>();
   if(employeeError||!employee)return {status:"error",message:"Linked employee could not be verified."};
   // Retain a different employee contact email rather than overwriting historical data.
 }
 // A non-routable archive address is intentionally never used to log in.
 const archiveEmail=`retired-${userId}@retired-login.insureit.invalid`;
 const {error:auditError}=await admin.from("audit_logs").insert({
   actor_id:actor.id,action:"it_email_release_requested",table_name:"profiles",record_id:userId,
   new_data:{old_login_email:requested,archived_login:archiveEmail,identity_preserved:true,history_preserved:true}
 });
 if(auditError)return {status:"error",message:"Audit write failed; no account change was made."};

 // First revoke access, then change the Auth email while retaining its UUID and historical references.
 const {error:banError}=await admin.auth.admin.updateUserById(userId,{ban_duration:"876000h"});
 if(banError)return {status:"error",message:"Login could not be disabled; email was not released."};
 const {error:inactiveError}=await admin.from("profiles").update({is_active:false}).eq("id",userId);
 if(inactiveError)return {status:"error",message:"Login disabled but profile deactivation failed. Do not create another user until this is resolved."};
 if(employeeId){
   const {error:employmentError}=await admin.from("employees").update({employment_status:"inactive",updated_by:actor.id,updated_at:new Date().toISOString()}).eq("id",employeeId);
   if(employmentError)return {status:"error",message:"Portal access was disabled but Employee Directory could not be retired. Email has not yet been released."};
 }
 const {error:renameError}=await admin.auth.admin.updateUserById(userId,{email:archiveEmail,email_confirm:true});
 if(renameError)return {status:"error",message:"Account archived, but Auth email could not be released. Retry after investigating; original email remains reserved."};

 // Profile/Employee contact fields are separate and must not reserve the old login email.
 const {error:profileEmailError}=await admin.from("profiles").update({email:null}).eq("id",userId).ilike("email",requested);
 if(profileEmailError)return {status:"error",message:"Auth email changed, but profile email cleanup failed. Do not create the replacement account yet."};
 if(employeeId){
   const {error:employeeEmailError}=await admin.from("employees").update({email:null,updated_by:actor.id,updated_at:new Date().toISOString()}).eq("id",employeeId).ilike("email",requested);
   if(employeeEmailError)return {status:"error",message:"Auth email changed, but employee email cleanup failed. Do not create the replacement account yet."};
 }
 const {data:verified,error:verificationError}=await admin.auth.admin.getUserById(userId);
 if(verificationError||normalize(verified.user?.email)!==archiveEmail)return {status:"error",message:"Release could not be verified. Do not create the replacement user yet."};
 const {error:completeAuditError}=await admin.from("audit_logs").insert({
   actor_id:actor.id,action:"it_email_released_for_new_user",table_name:"profiles",record_id:userId,
   new_data:{old_login_email:requested,archived_login:archiveEmail,history_preserved:true}
 });
 if(completeAuditError)return {status:"error",message:"Email released, but completion audit failed. Contact IT to reconcile before creating a new account."};
 revalidatePath("/users/auth-directory");revalidatePath("/users");revalidatePath("/employees");
 return {status:"success",message:`Email ${requested} is released for a NEW account. Old profile and historical policies/intakes remain preserved and inactive. Create a new account using User Management and assign the correct role; no new user was created automatically.`};
}
