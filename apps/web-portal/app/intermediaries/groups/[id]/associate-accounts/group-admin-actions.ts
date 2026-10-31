"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireGroupAssociateManager } from "../../group-associate-access";
import { requireIntermediaryGroupManager } from "@/lib/intermediary-group-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendGroupBranchPortalPasswordReset, setGroupBranchPortalLoginStatus } from "../../group-branch-login-actions";

const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function updateGroupAdministratorContact(formData: FormData) {
  const groupId = String(formData.get("group_id") ?? "");
  if (!validId(groupId)) redirect("/access-denied");
  const actor = await requireGroupAssociateManager(groupId);
  await requireIntermediaryGroupManager();
  const name = String(formData.get("admin_name") ?? "").trim();
  const phone = String(formData.get("admin_mobile") ?? "").trim();
  const postal = String(formData.get("postal_code") ?? "").trim();
  if (!name || !/^[0-9+ ()-]{10,20}$/.test(phone) || (postal && !/^\d{6}$/.test(postal))) {
    redirect(`/intermediaries/groups/${groupId}?error=Invalid administrator details`);
  }
  const admin = createSupabaseAdminClient();
  const { data: group } = await admin.from("intermediary_groups").select("id").eq("id", groupId).eq("status", "active").maybeSingle();
  if (!group) redirect("/access-denied");
  const values = {
    admin_name: name, admin_mobile: phone,
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    postal_code: postal, updated_by: actor.actorId, updated_at: new Date().toISOString(),
  };
  // Contact rows can be absent on legacy Groups. Updates must prove a row was
  // written; inserts must include every mandatory linked-identity field.
  const {data:existing,error:readError}=await admin.from("group_administrator_contacts").select("group_id").eq("group_id",groupId).maybeSingle();
  if(readError) redirect(`/intermediaries/groups/${groupId}?error=Unable to read administrator details`);
  let saved:{group_id:string;admin_name:string;admin_mobile:string}|null=null;
  let error: {message:string}|null=null;
  if(existing){
    const result=await admin.from("group_administrator_contacts").update(values).eq("group_id",groupId).select("group_id,admin_name,admin_mobile").maybeSingle();
    saved=result.data;
    error=result.error;
  }else{
    const {data:identity,error:identityError}=await admin.from("portal_access_identities").select("profile_id,login_email").eq("entity_type","group").eq("entity_id",groupId).maybeSingle();
    if(identityError || !identity?.profile_id || !identity.login_email) redirect(`/intermediaries/groups/${groupId}?error=Administrator login mapping missing`);
    const result=await admin.from("group_administrator_contacts").insert({
      ...values,group_id:groupId,profile_id:identity.profile_id,admin_email:identity.login_email,
    }).select("group_id,admin_name,admin_mobile").maybeSingle();
    saved=result.data;
    error=result.error;
  }
  if(error || !saved || saved.group_id!==groupId || saved.admin_name!==name || saved.admin_mobile!==phone)
    redirect(`/intermediaries/groups/${groupId}?error=Unable to save administrator details`);
  revalidatePath(`/intermediaries/groups/${groupId}`);
  redirect(`/intermediaries/groups/${groupId}?success=Administrator updated`);
}

// Reuse existing authorized Group login actions; they validate the current mapping and hierarchy.
export async function changeGroupAdministratorAccess(formData: FormData) {
  const groupId = String(formData.get("group_id") ?? "");
  if (!validId(groupId)) redirect("/access-denied");
  await requireGroupAssociateManager(groupId);
  const next = String(formData.get("next_status") ?? "");
  if (next !== "active" && next !== "disabled") redirect("/access-denied");
  const actionData = new FormData();
  actionData.set("entity_type", "group");
  actionData.set("entity_id", groupId);
  actionData.set("next_status", next);
  actionData.set("return_path", `/intermediaries/groups/${groupId}`);
  return setGroupBranchPortalLoginStatus(actionData);
}
export async function resendGroupAdministratorInvite(formData: FormData) {
  const groupId = String(formData.get("group_id") ?? "");
  if (!validId(groupId)) redirect("/access-denied");
  await requireGroupAssociateManager(groupId);
  const actionData = new FormData();
  actionData.set("entity_type", "group");
  actionData.set("entity_id", groupId);
  actionData.set("return_path", `/intermediaries/groups/${groupId}`);
  return sendGroupBranchPortalPasswordReset(actionData);
}
