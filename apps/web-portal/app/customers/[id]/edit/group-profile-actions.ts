"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function phone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? `+91${digits}` : null;
}

async function requireManager() {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || !canManageMasterData(profile.role)) return null;
  return profile;
}

export async function updateGroupProfile(groupCustomerId: string, data: FormData) {
  const profile = await requireManager();
  if (!profile) redirect(`/customers/${groupCustomerId}/edit?error=unauthorized`);

  const groupName = text(data, "group_name");
  const ownerName = text(data, "owner_name");
  const contactNumber = phone(text(data, "phone"));
  const email = text(data, "email");
  const status = text(data, "onboarding_status") ?? "active";

  if (!groupName || !ownerName || !contactNumber) {
    redirect(`/customers/${groupCustomerId}/edit?error=invalid_group_details`);
  }

  const admin = createSupabaseAdminClient();
  const { data: groupCustomer } = await admin
    .from("customers")
    .select("id")
    .eq("id", groupCustomerId)
    .eq("partner_type", "group")
    .maybeSingle<{ id: string }>();
  if (!groupCustomer) redirect(`/customers/${groupCustomerId}/edit?error=invalid_group`);

  const { error: customerError } = await admin.from("customers").update({
    company_name: groupName,
    legal_trade_name: groupName,
    contact_name: ownerName,
    phone: contactNumber,
    email,
    onboarding_status: status,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  }).eq("id", groupCustomerId);
  if (customerError) redirect(`/customers/${groupCustomerId}/edit?error=group_update_failed`);

  const { error: profileError } = await admin.from("group_profiles").upsert({
    customer_id: groupCustomerId,
    group_name: groupName,
    owner_name: ownerName,
    company_name: groupName,
    updated_at: new Date().toISOString(),
  }, { onConflict: "customer_id" });
  if (profileError) redirect(`/customers/${groupCustomerId}/edit?error=group_profile_update_failed`);

  const { data: membership } = await admin.from("customer_memberships")
    .select("id")
    .eq("customer_id", groupCustomerId)
    .eq("membership_role", "group_owner")
    .maybeSingle<{ id: string }>();
  if (membership) {
    await admin.from("customer_memberships").update({
      invited_phone: contactNumber,
      invited_email: email,
      updated_at: new Date().toISOString(),
    }).eq("id", membership.id);
  }

  revalidatePath(`/customers/${groupCustomerId}/edit`);
  revalidatePath("/customers");
  redirect(`/customers/${groupCustomerId}/edit?success=group_updated`);
}

export async function addGroupMember(groupCustomerId: string, data: FormData) {
  const profile = await requireManager();
  if (!profile) redirect(`/customers/${groupCustomerId}/edit?error=unauthorized`);
  const childCustomerId = text(data, "child_customer_id");
  if (!childCustomerId) redirect(`/customers/${groupCustomerId}/edit?error=select_child_customer`);

  const admin = createSupabaseAdminClient();
  const [{ data: group }, { data: child }] = await Promise.all([
    admin.from("customers").select("id").eq("id", groupCustomerId).eq("partner_type", "group").eq("onboarding_status", "active").maybeSingle<{ id: string }>(),
    admin.from("customers").select("id,partner_type,onboarding_status").eq("id", childCustomerId).maybeSingle<{ id: string; partner_type: string; onboarding_status: string }>(),
  ]);
  if (!group) redirect(`/customers/${groupCustomerId}/edit?error=group_not_active`);
  if (!child || !["corporate", "individual_proprietor", "dealership"].includes(child.partner_type) || child.onboarding_status !== "active") {
    redirect(`/customers/${groupCustomerId}/edit?error=invalid_child_customer`);
  }

  await admin.from("customer_relationships").update({
    is_active: false,
    status: "ended",
    effective_to: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("child_customer_id", childCustomerId).eq("relationship_type", "group_member").eq("is_active", true);

  const { error } = await admin.from("customer_relationships").upsert({
    parent_customer_id: groupCustomerId,
    child_customer_id: childCustomerId,
    relationship_type: "group_member",
    is_active: true,
    status: "active",
    effective_from: new Date().toISOString(),
    effective_to: null,
    created_by: profile.id,
    approved_by: profile.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "parent_customer_id,child_customer_id,relationship_type" });
  if (error) redirect(`/customers/${groupCustomerId}/edit?error=member_link_failed`);

  revalidatePath(`/customers/${groupCustomerId}/edit`);
  redirect(`/customers/${groupCustomerId}/edit?success=member_added`);
}

export async function removeGroupMember(groupCustomerId: string, data: FormData) {
  const profile = await requireManager();
  if (!profile) redirect(`/customers/${groupCustomerId}/edit?error=unauthorized`);
  const childCustomerId = text(data, "child_customer_id");
  if (!childCustomerId) redirect(`/customers/${groupCustomerId}/edit?error=invalid_child_customer`);

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("customer_relationships").update({
    is_active: false,
    status: "ended",
    effective_to: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("parent_customer_id", groupCustomerId).eq("child_customer_id", childCustomerId).eq("relationship_type", "group_member").eq("is_active", true);
  if (error) redirect(`/customers/${groupCustomerId}/edit?error=member_remove_failed`);

  revalidatePath(`/customers/${groupCustomerId}/edit`);
  redirect(`/customers/${groupCustomerId}/edit?success=member_removed`);
}
