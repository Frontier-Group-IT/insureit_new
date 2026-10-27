"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireIntermediaryGroupManager } from "@/lib/intermediary-group-access";

async function requireSuper() {
  const manager = await requireIntermediaryGroupManager();
  if (manager.role !== "it_super_user") throw new Error("IT Super User permission required.");
  return manager;
}

function field(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
function id(form: FormData) {
  const value = field(form, "entity_id");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)) throw new Error("Invalid branch ID");
  return value;
}
function refresh() {
  revalidatePath("/intermediaries/groups/branches");
  revalidatePath("/intermediaries/groups/login-access");
  revalidatePath("/intermediaries/portal-users");
}

export async function setSuperBranchLoginStatus(form: FormData) {
  const actor = await requireSuper();
  const branchId = id(form);
  const nextStatus = field(form, "next_status");
  if (nextStatus !== "active" && nextStatus !== "disabled") throw new Error("Invalid status");
  const admin = createSupabaseAdminClient();
  const { data: identity, error } = await admin.from("portal_access_identities")
    .select("profile_id,status").eq("entity_type","branch").eq("entity_id",branchId).single();
  if (error || !identity) throw new Error("Branch login mapping not found");
  if (nextStatus === "disabled") {
    if (identity.status !== "active") throw new Error("Only Active branches can be disabled.");
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(identity.profile_id);
    if (userError || !userData.user?.last_sign_in_at) {
      throw new Error("This branch has not activated its invitation. Only Active branches can be disabled.");
    }
  }
  const { error: updateError } = await admin.from("portal_access_identities")
    .update({ status: nextStatus, updated_by: actor.id, updated_at: new Date().toISOString() })
    .eq("entity_type","branch").eq("entity_id",branchId);
  if (updateError) throw new Error(updateError.message);
  const { error: profileError } = await admin.from("profiles").update({is_active: nextStatus === "active"})
    .eq("id",identity.profile_id);
  if (profileError) {
    await admin.from("portal_access_identities").update({status:identity.status}).eq("entity_type","branch").eq("entity_id",branchId);
    throw new Error(profileError.message);
  }
  refresh();
}

export async function resendSuperBranchLink(form: FormData) {
  await requireSuper();
  const branchId = id(form);
  const admin = createSupabaseAdminClient();
  const { data: identity } = await admin.from("portal_access_identities")
    .select("login_email,status").eq("entity_type","branch").eq("entity_id",branchId).single();
  if (!identity || identity.status !== "active") throw new Error("Enable branch login before resending.");
  const { error } = await admin.auth.resetPasswordForEmail(identity.login_email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://portal.insureit.in"}/auth/callback?next=/intermediary-portal`,
  });
  if (error) throw new Error(error.message);
  refresh();
}

export async function editSuperBranch(form: FormData) {
  await requireSuper();
  const branchId = id(form);
  const branchName = field(form,"branch_name");
  const phone = field(form,"phone");
  const contactName = field(form,"contact_name");
  const address = field(form,"address");
  if (branchName.length < 2 || branchName.length > 120 || contactName.length < 2 || contactName.length > 120 || address.length < 3 || address.length > 500 || !/^\+?[0-9 ()-]{7,20}$/.test(phone)) throw new Error("Enter valid branch details.");
  const admin = createSupabaseAdminClient();
  const { data: current } = await admin.from("partner_branch_profiles").select("partner_id").eq("partner_id",branchId).single();
  if (!current) throw new Error("Branch profile not found.");
  const { error } = await admin.from("partner_branch_profiles")
    .update({branch_name:branchName,phone,contact_name:contactName,address})
    .eq("partner_id",branchId);
  if (error) throw new Error(error.message);
  const { error: partnerError } = await admin.from("partners").update({display_name:branchName}).eq("id",branchId);
  if (partnerError) throw new Error(partnerError.message);
  refresh();
}

export async function editSuperBranchSafely(form: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    await editSuperBranch(form);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "IT Super User permission required.") return { ok: false, error: "You do not have permission to edit this branch." };
    if (message === "Enter valid branch details.") return { ok: false, error: message };
    if (message === "Branch profile not found." || message === "Invalid branch ID") return { ok: false, error: "Branch record not found. Refresh and retry." };
    console.error("Branch edit failed", error);
    return { ok: false, error: "Could not save branch changes. Please retry or contact support." };
  }
}
