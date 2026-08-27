"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  canAccessIntermediaryGroupOwner,
  requireIntermediaryGroupManager,
  requireIntermediaryGroupTransferManager,
} from "@/lib/intermediary-group-access";

type GroupRow = { id: string; owner_employee_id: string; status: string };
type PartnerRow = { id: string; source_application_id: string | null };
type ParentIntermediaryRow = { application_id: string | null; associate_employee_id: string | null };
type OnboardingOwnerRow = { application_id: string; associate_employee_id: string | null };

const returnPath = "/intermediaries/groups";

export async function createIntermediaryGroup(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const ownerEmployeeId = text(formData, "owner_employee_id") || profile.employee_id || "";
  const groupName = text(formData, "group_name");
  const description = text(formData, "description");
  const partnerIds = ids(formData, "partner_id");
  if (!ownerEmployeeId || !groupName) return fail("Group owner and Group name are required.");
  if (!(await canAccessIntermediaryGroupOwner(profile, ownerEmployeeId))) return fail("You cannot create a Group for that employee.");
  if (partnerIds.length && !(await partnersBelongToOwner(partnerIds, ownerEmployeeId))) {
    return fail("Every selected Partner must belong to the Group owner.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_create_intermediary_group", {
    p_owner_employee_id: ownerEmployeeId,
    p_group_name: groupName,
    p_description: description || null,
    p_partner_ids: partnerIds,
    p_actor_profile_id: profile.id,
  });
  if (error) return fail(groupError(error.message));
  done("group_created");
}

export async function assignIntermediaryGroupMembers(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const groupId = text(formData, "group_id");
  const partnerIds = ids(formData, "partner_id");
  if (!groupId || !partnerIds.length) return fail("Choose at least one Partner to move.");

  const group = await requireAccessibleGroup(profile, groupId);
  if (!group || group.status !== "active") return fail("The selected Group is not available.");
  if (!(await partnersBelongToOwner(partnerIds, group.owner_employee_id))) return fail("Every selected Partner must belong to the same sales employee as the Group.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_assign_intermediary_group_members", {
    p_group_id: groupId,
    p_partner_ids: partnerIds,
    p_actor_profile_id: profile.id,
    p_reason: text(formData, "reason") || null,
  });
  if (error) return fail(groupError(error.message));
  done("members_moved");
}

export async function removeIntermediaryGroupMembers(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const partnerIds = ids(formData, "partner_id");
  if (!partnerIds.length) return fail("Choose at least one Partner to remove.");

  const admin = createSupabaseAdminClient();
  const { data: memberships } = await admin
    .from("intermediary_group_memberships")
    .select("group_id")
    .in("partner_id", partnerIds)
    .is("effective_to", null)
    .returns<Array<{ group_id: string }>>();
  const groupIds = Array.from(new Set((memberships ?? []).map((row) => row.group_id)));
  if (groupIds.length) {
    const { data: groups } = await admin
      .from("intermediary_groups")
      .select("id,owner_employee_id,status")
      .in("id", groupIds)
      .returns<GroupRow[]>();
    for (const group of groups ?? []) {
      if (!(await canAccessIntermediaryGroupOwner(profile, group.owner_employee_id))) return fail("One or more selected Partners are outside your permitted hierarchy.");
    }
  }

  const { error } = await admin.rpc("service_remove_intermediary_group_members", {
    p_partner_ids: partnerIds,
    p_actor_profile_id: profile.id,
    p_reason: text(formData, "reason") || null,
  });
  if (error) return fail(groupError(error.message));
  done("members_ungrouped");
}

export async function renameIntermediaryGroup(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const groupId = text(formData, "group_id");
  const groupName = text(formData, "group_name");
  if (!groupId || !groupName) return fail("Group name is required.");
  const group = await requireAccessibleGroup(profile, groupId);
  if (!group) return fail("The selected Group is outside your permitted hierarchy.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_rename_intermediary_group", {
    p_group_id: groupId,
    p_group_name: groupName,
    p_description: text(formData, "description") || null,
    p_actor_profile_id: profile.id,
  });
  if (error) return fail(groupError(error.message));
  done("group_updated");
}

export async function archiveIntermediaryGroup(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const groupId = text(formData, "group_id");
  if (!groupId) return fail("Group is required.");
  const group = await requireAccessibleGroup(profile, groupId);
  if (!group) return fail("The selected Group is outside your permitted hierarchy.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_archive_intermediary_group", {
    p_group_id: groupId,
    p_actor_profile_id: profile.id,
  });
  if (error) return fail(groupError(error.message));
  done("group_archived");
}

export async function transferIntermediaryGroup(formData: FormData) {
  const profile = await requireIntermediaryGroupTransferManager();
  const groupId = text(formData, "group_id");
  const newOwnerEmployeeId = text(formData, "new_owner_employee_id");
  if (!groupId || !newOwnerEmployeeId) return fail("Group and new owner are required.");

  const group = await requireAccessibleGroup(profile, groupId);
  if (!group) return fail("The selected Group is outside your permitted hierarchy.");
  if (!(await canAccessIntermediaryGroupOwner(profile, newOwnerEmployeeId))) return fail("The new owner is outside your permitted hierarchy.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_transfer_intermediary_group", {
    p_group_id: groupId,
    p_new_owner_employee_id: newOwnerEmployeeId,
    p_actor_profile_id: profile.id,
    p_reason: text(formData, "reason") || null,
  });
  if (error) return fail(groupError(error.message));
  done("group_transferred");
}

async function requireAccessibleGroup(profile: Awaited<ReturnType<typeof requireIntermediaryGroupManager>>, groupId: string) {
  const admin = createSupabaseAdminClient();
  const { data: group } = await admin
    .from("intermediary_groups")
    .select("id,owner_employee_id,status")
    .eq("id", groupId)
    .maybeSingle<GroupRow>();
  if (!group || !(await canAccessIntermediaryGroupOwner(profile, group.owner_employee_id))) return null;
  return group;
}

async function partnersBelongToOwner(partnerIds: string[], ownerEmployeeId: string) {
  const admin = createSupabaseAdminClient();
  const { data: partners } = await admin
    .from("partners")
    .select("id,source_application_id")
    .in("id", partnerIds)
    .returns<PartnerRow[]>();
  if ((partners ?? []).length !== partnerIds.length) return false;
  const applicationIds = (partners ?? []).map((row) => row.source_application_id).filter((value): value is string => Boolean(value));
  if (applicationIds.length !== partnerIds.length) return false;
  const [{ data: intermediaryRows }, { data: onboardingOwners }] = await Promise.all([
    admin
      .from("intermediaries")
      .select("application_id,associate_employee_id")
      .eq("intermediary_type", "partner")
      .in("application_id", applicationIds)
      .returns<ParentIntermediaryRow[]>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("application_id,associate_employee_id")
      .in("application_id", applicationIds)
      .returns<OnboardingOwnerRow[]>(),
  ]);
  const rootOwnerByApplication = new Map((intermediaryRows ?? []).map((row) => [row.application_id, row.associate_employee_id]));
  const onboardingOwnerByApplication = new Map((onboardingOwners ?? []).map((row) => [row.application_id, row.associate_employee_id]));
  return applicationIds.every((applicationId) =>
    (rootOwnerByApplication.get(applicationId) ?? onboardingOwnerByApplication.get(applicationId) ?? null) === ownerEmployeeId
  );
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function ids(formData: FormData, key: string) {
  return Array.from(new Set(formData.getAll(key).filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value))));
}

function groupError(message: string) {
  if (/duplicate key|owner_name_active/i.test(message)) return "An active Group with this name already exists under that employee.";
  if (/same sales employee owner/i.test(message)) return "The Partner and Group must belong to the same sales employee.";
  if (/active members before archiving/i.test(message)) return "Move or ungroup all members before archiving this Group.";
  return message || "The Intermediary Group action could not be completed.";
}

function done(event: string): never {
  revalidatePath(returnPath);
  revalidatePath("/intermediaries");
  redirect(`${returnPath}?success=${encodeURIComponent(event)}`);
}

function fail(message: string): never {
  redirect(`${returnPath}?error=${encodeURIComponent(message)}`);
}
