"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function updateGroupAffiliation(customerId: string, formData: FormData) {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || !canManageMasterData(profile.role)) {
    redirect(`/customers/${customerId}/edit?error=group_affiliation_unauthorized`);
  }

  const admin = createSupabaseAdminClient();
  const selectedGroupId = text(formData, "parent_group_id");

  const { data: child, error: childError } = await admin
    .from("customers")
    .select("id,partner_type,onboarding_status")
    .eq("id", customerId)
    .maybeSingle<{ id: string; partner_type: string | null; onboarding_status: string }>();

  if (childError || !child || !["corporate", "individual_proprietor", "dealership"].includes(child.partner_type ?? "")) {
    redirect(`/customers/${customerId}/edit?error=invalid_group_child`);
  }

  if (selectedGroupId) {
    const { data: group, error: groupError } = await admin
      .from("customers")
      .select("id")
      .eq("id", selectedGroupId)
      .eq("partner_type", "group")
      .eq("onboarding_status", "active")
      .maybeSingle<{ id: string }>();

    if (groupError || !group) {
      redirect(`/customers/${customerId}/edit?error=invalid_parent_group`);
    }
  }

  const now = new Date().toISOString();
  const { error: endError } = await admin
    .from("customer_relationships")
    .update({ is_active: false, status: "ended", effective_to: now, updated_at: now })
    .eq("child_customer_id", customerId)
    .eq("relationship_type", "group_member")
    .eq("is_active", true);

  if (endError) redirect(`/customers/${customerId}/edit?error=group_affiliation_update_failed`);

  if (selectedGroupId) {
    const { error: linkError } = await admin.from("customer_relationships").upsert({
      parent_customer_id: selectedGroupId,
      child_customer_id: customerId,
      relationship_type: "group_member",
      is_active: true,
      status: "active",
      effective_from: now,
      effective_to: null,
      created_by: profile.id,
      approved_by: profile.id,
      updated_at: now,
    }, { onConflict: "parent_customer_id,child_customer_id,relationship_type" });

    if (linkError) redirect(`/customers/${customerId}/edit?error=group_affiliation_update_failed`);
  }

  revalidatePath(`/customers/${customerId}/edit`);
  revalidatePath("/customers");
  redirect(`/customers/${customerId}/edit?success=group_affiliation_updated`);
}
