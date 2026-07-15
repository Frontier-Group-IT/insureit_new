"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function addGroupMember(formData: FormData) {
  const reviewer = await requireMasterDataManager();
  const groupId = value(formData,"group_id"); const childId = value(formData,"child_customer_id");
  if (!reviewer?.id || !groupId || !childId) redirect("/customers?error=invalid_group_link");
  const admin = createSupabaseAdminClient();
  const { data: group } = await admin.from("customers").select("id,partner_type").eq("id",groupId).maybeSingle<{id:string;partner_type:string|null}>();
  const { data: child } = await admin.from("customers").select("id,partner_type").eq("id",childId).maybeSingle<{id:string;partner_type:string|null}>();
  if (!group || group.partner_type !== "group" || !child || child.partner_type === "group" || groupId === childId) redirect(`/customers/groups/${groupId}/members?error=invalid_relationship`);
  const { error } = await admin.rpc("link_customer_to_group", { p_group_customer_id: groupId, p_child_customer_id: childId, p_actor_profile_id: reviewer.id });
  if (error) redirect(`/customers/groups/${groupId}/members?error=link_failed`);
  revalidatePath(`/customers/groups/${groupId}/members`);
}

export async function removeGroupMember(formData: FormData) {
  const reviewer = await requireMasterDataManager(); const groupId=value(formData,"group_id"); const relationshipId=value(formData,"relationship_id");
  if (!reviewer?.id || !groupId || !relationshipId) redirect("/customers");
  const admin=createSupabaseAdminClient();
  const { data: relationship, error: relationshipError } = await admin.from("customer_relationships").select("child_customer_id").eq("id",relationshipId).eq("parent_customer_id",groupId).eq("relationship_type","group_member").eq("is_active",true).maybeSingle<{child_customer_id:string}>();
  if (relationshipError || !relationship) redirect(`/customers/groups/${groupId}/members?error=unlink_failed`);
  const { error } = await admin.rpc("unlink_customer_from_group", { p_child_customer_id: relationship.child_customer_id, p_actor_profile_id: reviewer.id });
  if (error) redirect(`/customers/groups/${groupId}/members?error=unlink_failed`);
  revalidatePath(`/customers/groups/${groupId}/members`);
}
function value(data:FormData,name:string){const item=data.get(name);return typeof item==="string"&&item.trim()?item.trim():null;}
