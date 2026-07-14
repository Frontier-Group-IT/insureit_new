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
  const { error } = await admin.from("customer_relationships").upsert({parent_customer_id:groupId,child_customer_id:childId,relationship_type:"group_member",is_active:true,created_by:reviewer.id},{onConflict:"parent_customer_id,child_customer_id,relationship_type"});
  if (error) redirect(`/customers/groups/${groupId}/members?error=link_failed`);
  revalidatePath(`/customers/groups/${groupId}/members`);
}

export async function removeGroupMember(formData: FormData) {
  await requireMasterDataManager(); const groupId=value(formData,"group_id"); const relationshipId=value(formData,"relationship_id");
  if (!groupId || !relationshipId) redirect("/customers");
  const admin=createSupabaseAdminClient(); await admin.from("customer_relationships").delete().eq("id",relationshipId).eq("parent_customer_id",groupId);
  revalidatePath(`/customers/groups/${groupId}/members`);
}
function value(data:FormData,name:string){const item=data.get(name);return typeof item==="string"&&item.trim()?item.trim():null;}
