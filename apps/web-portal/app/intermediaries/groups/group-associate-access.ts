import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getIntermediaryGroupManager, canAccessIntermediaryGroupOwner } from "@/lib/intermediary-group-access";
export async function requireGroupAssociateManager(groupId:string){
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(groupId))redirect("/access-denied");
 const admin=createSupabaseAdminClient();
 const {data:group}=await admin.from("intermediary_groups").select("id,status,group_mode,owner_employee_id,created_by").eq("id",groupId).maybeSingle();
 if(!group||group.status!=="active")redirect("/access-denied");
 const manager=await getIntermediaryGroupManager();
 if(manager){
  if(group.group_mode==="legacy_employee"&&group.owner_employee_id&&await canAccessIntermediaryGroupOwner(manager,group.owner_employee_id))return {actorId:manager.id,isOperations:true};
  if(group.group_mode==="business"&&group.created_by===manager.id)return {actorId:manager.id,isOperations:true};
  // Organisation-wide admins may manage business groups they can view.
  const {getIntermediaryGroupEmployeeScope}=await import("@/lib/intermediary-group-access");
  const scope=await getIntermediaryGroupEmployeeScope(manager);
  if(scope.mode==="organization")return {actorId:manager.id,isOperations:true};
 }
 const token=await getServerAccessToken();
 const {user,profile}=await getAuthenticatedProfile(token);
 if(!user?.id||!profile?.id||!profile.is_active)redirect("/access-denied");
 const [{data:primary},{data:associate}]=await Promise.all([
   admin.from("portal_access_identities").select("profile_id").eq("profile_id",user.id).eq("entity_type","group").eq("entity_id",groupId).eq("status","active").maybeSingle(),
   admin.from("group_portal_associate_accounts").select("id").eq("role","group_admin").eq("auth_user_id",user.id).eq("group_id",groupId).eq("status","active").maybeSingle()
 ]);
 if(!primary&&!associate)redirect("/access-denied");
 return {actorId:user.id,isOperations:false};
}
