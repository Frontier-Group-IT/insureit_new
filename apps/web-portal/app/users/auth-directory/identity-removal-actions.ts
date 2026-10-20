"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { permanentDeleteEntity } from "@/lib/admin-permanent-delete";

export type IdentityRemovalMode = "login_only" | "complete";
export type IdentityRemovalResult = { status: "success" | "error"; message: string };

export async function removeAuthDirectoryIdentity(targetId:string, mode:IdentityRemovalMode, typedConfirmation:string):Promise<IdentityRemovalResult> {
  const {profile}=await getAuthenticatedProfile(await getServerAccessToken());
  if(!profile || !profile.is_active || profile.role!=="it_super_user")return {status:"error",message:"Only an active IT Super User may manage identity deletion."};
  if(!/^[0-9a-f-]{36}$/i.test(targetId))return {status:"error",message:"Invalid identity ID."};
  if(targetId===profile.id)return {status:"error",message:"You cannot remove your own IT Super User access."};
  const expected=mode==="complete"?"DELETE IDENTITY":"DISABLE LOGIN";
  if(typedConfirmation!==expected)return {status:"error",message:"Confirmation text does not match."};

  const admin=createSupabaseAdminClient();
  const {data:auth,error:lookupError}=await admin.auth.admin.getUserById(targetId);
  if(lookupError || !auth.user)return {status:"error",message:"Auth user no longer exists."};
  const {data:targetProfile,error:profileError}=await admin.from("profiles").select("id,role").eq("id",targetId).maybeSingle<{id:string;role:string}>();
  if(profileError)return {status:"error",message:"Could not verify the linked profile."};
  if(targetProfile?.role==="it_super_user")return {status:"error",message:"IT Super User identities require separate protected recovery handling."};

  if(mode==="complete"){
    if(!targetProfile)return {status:"error",message:"No linked portal profile. This account requires an explicit dependency review before permanent Auth deletion."};
    const result=await permanentDeleteEntity("user",targetId);
    if(result.status==="success")revalidatePath("/users/auth-directory");
    return result;
  }
  if(mode!=="login_only")return {status:"error",message:"Unsupported removal mode."};

  const {error:auditError}=await admin.from("audit_logs").insert({
    actor_id:profile.id,action:"it_super_user_login_access_revocation",
    table_name:"auth.users",record_id:targetId,
    new_data:{operation:"disable_login",identity_preserved:true}
  });
  if(auditError)return {status:"error",message:"Audit logging unavailable; access was not changed."};
  // Ban blocks new Supabase Auth logins while preserving all rows and historical foreign keys.
  const {error}=await admin.auth.admin.updateUserById(targetId,{ban_duration:"876000h"});
  if(error)return {status:"error",message:"Login access could not be disabled; no identity data was deleted."};
  revalidatePath("/users/auth-directory");
  return {status:"success",message:"Login access disabled. The Auth identity, profile, roles and business history remain preserved. Existing access tokens may remain valid until expiry."};
}
