"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PermanentDeleteKind = "user" | "branch" | "partner";
export type PermanentDeleteResult = { status: "success" | "error"; message: string };

type Blocker = { table: string; column: string; delete_rule: string; count: number };

async function requireItSuperUser() {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || profile.role !== "it_super_user") {
    throw new Error("Only an IT Super User can permanently delete records.");
  }
  return profile;
}

async function blockers(targetTable: "profiles" | "employees" | "partners" | "intermediaries", id: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("admin_hard_delete_blockers", {
    p_target_table: targetTable,
    p_target_id: id,
  });
  if (error) throw new Error("Deletion safety check could not be completed.");
  return (Array.isArray(data) ? data : []) as Blocker[];
}

function formatBlockers(items: Blocker[]) {
  if (!items.length) return "";
  const names = [...new Set(items.map((item) => item.table.replaceAll("_", " ")))].slice(0, 4);
  const suffix = items.length > names.length ? " and other protected records" : "";
  return \`\${names.join(", ")}\${suffix}\`;
}

async function deleteAuthBackedProfile(profileId: string) {
  const admin = createSupabaseAdminClient();
  const { data: authLookup } = await admin.auth.admin.getUserById(profileId);
  if (authLookup?.user) {
    const { error } = await admin.auth.admin.deleteUser(profileId);
    if (error) throw new Error("The portal login could not be permanently removed.");
    return;
  }
  const { error } = await admin.from("profiles").delete().eq("id", profileId);
  if (error) throw new Error("The portal profile could not be permanently removed.");
}

async function deleteUser(profileId: string, actorId: string): Promise<PermanentDeleteResult> {
  if (profileId === actorId) return { status: "error", message: "You cannot permanently delete your own IT Super User account." };

  const admin = createSupabaseAdminClient();
  const { data: target, error } = await admin
    .from("profiles")
    .select("id,full_name,role,employee_id")
    .eq("id", profileId)
    .maybeSingle<{ id: string; full_name: string; role: string; employee_id: string | null }>();
  if (error || !target) return { status: "error", message: "The employee record could not be found." };
  if (target.role === "customer" || target.role === "intermediary") {
    return { status: "error", message: "This record is not an employee portal user and cannot be deleted from User Management." };
  }

  const profileBlockers = await blockers("profiles", profileId);
  if (profileBlockers.length) {
    return { status: "error", message: \`Cannot permanently delete this employee because protected history exists in \${formatBlockers(profileBlockers)}. Deactivate the employee instead.\` };
  }

  if (target.employee_id) {
    const employeeBlockers = await blockers("employees", target.employee_id);
    if (employeeBlockers.length) {
      return { status: "error", message: \`Cannot permanently delete this employee because protected business history exists in \${formatBlockers(employeeBlockers)}. Deactivate the employee instead.\` };
    }
  }

  await deleteAuthBackedProfile(profileId);

  if (target.employee_id) {
    const { error: employeeDeleteError } = await admin.from("employees").delete().eq("id", target.employee_id);
    if (employeeDeleteError) {
      return { status: "error", message: "The portal login was removed, but the employee directory record could not be removed. Refresh and contact the IT administrator." };
    }
  }

  revalidatePath("/users");
  revalidatePath("/employees");
  revalidatePath("/organization");
  revalidatePath("/system/access-control");
  return { status: "success", message: \`\${target.full_name} was permanently deleted.\` };
}

async function deleteBranch(partnerId: string): Promise<PermanentDeleteResult> {
  const admin = createSupabaseAdminClient();
  const { data: branch } = await admin
    .from("partners")
    .select("id,display_name,partner_branch_profiles!inner(id)")
    .eq("id", partnerId)
    .maybeSingle<{ id: string; display_name: string; partner_branch_profiles: Array<{ id: string }> }>();
  if (!branch) return { status: "error", message: "The branch record could not be found." };

  const allBlockers = await blockers("partners", partnerId);
  const blocking = allBlockers.filter((item) => item.table !== "partner_branch_profiles");
  if (blocking.length) {
    return { status: "error", message: \`Cannot permanently delete this branch because protected history exists in \${formatBlockers(blocking)}.\` };
  }

  const { data: portal } = await admin
    .from("portal_access_identities")
    .select("profile_id")
    .eq("entity_type", "branch")
    .eq("entity_id", partnerId)
    .maybeSingle<{ profile_id: string }>();

  if (portal?.profile_id) {
    const profileBlockers = await blockers("profiles", portal.profile_id);
    if (profileBlockers.length) {
      return { status: "error", message: "This branch has a portal login referenced by protected history. Disable the login instead of deleting the branch." };
    }
    await deleteAuthBackedProfile(portal.profile_id);
  }

  const { error: profileError } = await admin.from("partner_branch_profiles").delete().eq("partner_id", partnerId);
  if (profileError) return { status: "error", message: "The branch profile could not be removed." };

  const { error: partnerError } = await admin.from("partners").delete().eq("id", partnerId);
  if (partnerError) return { status: "error", message: "The branch is still referenced by protected records and cannot be permanently deleted." };

  revalidatePath("/intermediaries/groups/branches");
  revalidatePath("/intermediaries/groups");
  return { status: "success", message: \`\${branch.display_name} was permanently deleted.\` };
}

async function deletePartner(intermediaryId: string, partnerRecordId?: string): Promise<PermanentDeleteResult> {
  const admin = createSupabaseAdminClient();
  const { data: intermediary } = await admin
    .from("intermediaries")
    .select("id,display_name,intermediary_type,application_id")
    .eq("id", intermediaryId)
    .eq("intermediary_type", "partner")
    .maybeSingle<{ id: string; display_name: string; intermediary_type: string; application_id: string | null }>();
  if (!intermediary) return { status: "error", message: "The partner record could not be found." };

  const intermediaryBlockers = await blockers("intermediaries", intermediaryId);
  if (intermediaryBlockers.length) {
    return { status: "error", message: \`Cannot permanently delete this partner because protected business history exists in \${formatBlockers(intermediaryBlockers)}.\` };
  }

  if (partnerRecordId) {
    const partnerBlockers = await blockers("partners", partnerRecordId);
    const cleanupTables = new Set(["intermediary_onboarding_applications", "posp_misp_onboarding_profiles", "intermediary_group_memberships"]);
    const blocking = partnerBlockers.filter((item) => !cleanupTables.has(item.table));
    if (blocking.length) {
      return { status: "error", message: \`Cannot permanently delete this partner because protected business history exists in \${formatBlockers(blocking)}.\` };
    }

    await admin.from("intermediary_group_memberships").delete().eq("partner_id", partnerRecordId);
    await admin.from("intermediary_onboarding_applications").update({ partner_record_id: null }).eq("partner_record_id", partnerRecordId);
    await admin.from("posp_misp_onboarding_profiles").update({ partner_record_id: null }).eq("partner_record_id", partnerRecordId);

    const { error: partnerDeleteError } = await admin.from("partners").delete().eq("id", partnerRecordId);
    if (partnerDeleteError) return { status: "error", message: "The partner remains linked to protected business records and cannot be permanently deleted." };
  }

  const { error: intermediaryDeleteError } = await admin.from("intermediaries").delete().eq("id", intermediaryId);
  if (intermediaryDeleteError) {
    return { status: "error", message: "The partner account could not be permanently removed because protected history still references it." };
  }

  revalidatePath("/intermediaries/partner");
  revalidatePath("/intermediaries");
  return { status: "success", message: \`\${intermediary.display_name} was permanently deleted.\` };
}

export async function permanentDeleteEntity(
  kind: PermanentDeleteKind,
  id: string,
  relatedId?: string,
): Promise<PermanentDeleteResult> {
  try {
    const actor = await requireItSuperUser();
    if (!id) return { status: "error", message: "The record identifier is missing." };
    if (kind === "user") return deleteUser(id, actor.id);
    if (kind === "branch") return deleteBranch(id);
    if (kind === "partner") return deletePartner(id, relatedId);
    return { status: "error", message: "Unsupported permanent-delete request." };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Permanent deletion could not be completed." };
  }
}
