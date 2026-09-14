"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  canAccessIntermediaryGroupOwner,
  getIntermediaryGroupEmployeeScope,
  requireIntermediaryGroupManager,
} from "@/lib/intermediary-group-access";

type GroupRow = {
  id: string;
  status: string;
  group_mode: string | null;
  owner_employee_id: string | null;
  created_by: string | null;
};

type PartnerRow = {
  id: string;
  source_application_id: string | null;
};

type ParentIntermediaryRow = {
  application_id: string | null;
  associate_employee_id: string | null;
};

type OnboardingOwnerRow = {
  application_id: string;
  associate_employee_id: string | null;
};

const returnPath = "/intermediaries/groups";

export async function createBusinessGroup(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const groupName = text(formData, "group_name");
  const partnerIds = ids(formData, "partner_id");
  if (!groupName) return fail("Group name is required.");
  if (partnerIds.length && !(await canAccessPartners(profile, partnerIds))) {
    return fail("One or more selected Partners are outside your permitted hierarchy.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_create_business_intermediary_group", {
    p_group_name: groupName,
    p_description: text(formData, "description") || null,
    p_partner_ids: partnerIds,
    p_actor_profile_id: profile.id,
  });
  if (error) return fail(groupError(error.message));
  done("business_group_created");
}

export async function convertLegacyGroupToBusiness(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const groupId = text(formData, "group_id");
  if (!groupId) return fail("Group is required.");

  const group = await loadGroup(groupId);
  if (!group || group.status !== "active") return fail("The selected Group is not available.");
  if (group.group_mode === "business") return done("group_converted");
  if (!group.owner_employee_id || !(await canAccessIntermediaryGroupOwner(profile, group.owner_employee_id))) {
    return fail("The selected Group is outside your permitted hierarchy.");
  }
  const memberIds = await activeGroupPartnerIds(groupId);
  if (memberIds.length && !(await canAccessPartners(profile, memberIds))) {
    return fail("All Group Partners must be inside your permitted hierarchy before conversion.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_convert_intermediary_group_to_business", {
    p_group_id: groupId,
    p_actor_profile_id: profile.id,
  });
  if (error) return fail(groupError(error.message));
  done("group_converted");
}

export async function assignBusinessGroupMembers(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const groupId = text(formData, "group_id");
  const partnerIds = ids(formData, "partner_id");
  if (!groupId || !partnerIds.length) return fail("Choose a Group and at least one Partner.");
  if (!(await requireGroupMutationAccess(profile, groupId))) return fail("The selected Group is outside your permitted hierarchy.");
  if (!(await canAccessPartners(profile, partnerIds))) return fail("One or more selected Partners are outside your permitted hierarchy.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_assign_business_intermediary_group_members", {
    p_group_id: groupId,
    p_partner_ids: partnerIds,
    p_actor_profile_id: profile.id,
    p_reason: text(formData, "reason") || null,
  });
  if (error) return fail(groupError(error.message));
  done("business_members_moved");
}

export async function removeBusinessGroupMembers(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const groupId = text(formData, "group_id");
  const partnerIds = ids(formData, "partner_id");
  if (!groupId || !partnerIds.length) return fail("Choose at least one Partner to remove.");
  if (!(await requireGroupMutationAccess(profile, groupId))) return fail("The selected Group is outside your permitted hierarchy.");
  if (!(await canAccessPartners(profile, partnerIds))) return fail("One or more selected Partners are outside your permitted hierarchy.");

  const admin = createSupabaseAdminClient();
  const { data: activeRows } = await admin
    .from("intermediary_group_memberships")
    .select("partner_id")
    .eq("group_id", groupId)
    .in("partner_id", partnerIds)
    .is("effective_to", null)
    .returns<Array<{ partner_id: string }>>();
  const activePartnerIds = (activeRows ?? []).map((row) => row.partner_id);
  if (!activePartnerIds.length) return fail("None of the selected Partners are active members of this Group.");

  const { error } = await admin.rpc("service_remove_intermediary_group_members", {
    p_partner_ids: activePartnerIds,
    p_actor_profile_id: profile.id,
    p_reason: text(formData, "reason") || "Removed from business Group",
  });
  if (error) return fail(groupError(error.message));
  done("business_members_removed");
}

export async function renameBusinessGroup(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const groupId = text(formData, "group_id");
  const groupName = text(formData, "group_name");
  if (!groupId || !groupName) return fail("Group name is required.");
  if (!(await requireGroupMutationAccess(profile, groupId))) return fail("The selected Group is outside your permitted hierarchy.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_rename_intermediary_group", {
    p_group_id: groupId,
    p_group_name: groupName,
    p_description: text(formData, "description") || null,
    p_actor_profile_id: profile.id,
  });
  if (error) return fail(groupError(error.message));
  done("business_group_updated");
}

export async function archiveBusinessGroup(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const groupId = text(formData, "group_id");
  if (!groupId) return fail("Group is required.");
  if (!(await requireGroupMutationAccess(profile, groupId))) return fail("The selected Group is outside your permitted hierarchy.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_archive_intermediary_group", {
    p_group_id: groupId,
    p_actor_profile_id: profile.id,
  });
  if (error) return fail(groupError(error.message));
  done("business_group_archived");
}

export async function assignPartnerBranch(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const parentPartnerId = text(formData, "parent_partner_id");
  const branchPartnerId = text(formData, "branch_partner_id");
  if (!parentPartnerId || !branchPartnerId) return fail("Parent Partner and Branch are required.");
  if (!(await canAccessPartners(profile, [parentPartnerId, branchPartnerId]))) {
    return fail("One or more selected Partners are outside your permitted hierarchy.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_assign_partner_branch", {
    p_parent_partner_id: parentPartnerId,
    p_branch_partner_id: branchPartnerId,
    p_actor_profile_id: profile.id,
  });
  if (error) return fail(groupError(error.message));
  done("branch_assigned");
}

export async function removePartnerBranch(formData: FormData) {
  const profile = await requireIntermediaryGroupManager();
  const branchPartnerId = text(formData, "branch_partner_id");
  if (!branchPartnerId) return fail("Branch is required.");
  if (!(await canAccessPartners(profile, [branchPartnerId]))) return fail("The selected Branch is outside your permitted hierarchy.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("service_remove_partner_branch", {
    p_branch_partner_id: branchPartnerId,
    p_actor_profile_id: profile.id,
  });
  if (error) return fail(groupError(error.message));
  done("branch_removed");
}

async function requireGroupMutationAccess(
  profile: Awaited<ReturnType<typeof requireIntermediaryGroupManager>>,
  groupId: string,
) {
  const group = await loadGroup(groupId);
  if (!group || group.status !== "active") return false;

  if ((group.group_mode ?? "legacy_employee") === "legacy_employee") {
    return Boolean(group.owner_employee_id && await canAccessIntermediaryGroupOwner(profile, group.owner_employee_id));
  }

  const scope = await getIntermediaryGroupEmployeeScope(profile);
  if (scope.mode === "organization" || group.created_by === profile.id) return true;
  const memberIds = await activeGroupPartnerIds(groupId);
  return memberIds.length > 0 && await canAccessPartners(profile, memberIds);
}

async function loadGroup(groupId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("intermediary_groups")
    .select("id,status,group_mode,owner_employee_id,created_by")
    .eq("id", groupId)
    .maybeSingle<GroupRow>();
  return data ?? null;
}

async function activeGroupPartnerIds(groupId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("intermediary_group_memberships")
    .select("partner_id")
    .eq("group_id", groupId)
    .is("effective_to", null)
    .returns<Array<{ partner_id: string }>>();
  return (data ?? []).map((row) => row.partner_id);
}

async function canAccessPartners(
  profile: Awaited<ReturnType<typeof requireIntermediaryGroupManager>>,
  partnerIds: string[],
) {
  if (!partnerIds.length) return true;
  const scope = await getIntermediaryGroupEmployeeScope(profile);
  if (scope.mode === "organization") return true;
  if (!scope.employeeIds.length) return false;

  const admin = createSupabaseAdminClient();
  const { data: partners } = await admin
    .from("partners")
    .select("id,source_application_id")
    .in("id", partnerIds)
    .returns<PartnerRow[]>();
  if ((partners ?? []).length !== new Set(partnerIds).size) return false;

  const applicationIds = (partners ?? [])
    .map((row) => row.source_application_id)
    .filter((value): value is string => Boolean(value));
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

  const ownerByApplication = new Map((intermediaryRows ?? []).map((row) => [row.application_id, row.associate_employee_id]));
  const onboardingOwnerByApplication = new Map((onboardingOwners ?? []).map((row) => [row.application_id, row.associate_employee_id]));
  const allowed = new Set(scope.employeeIds);
  return applicationIds.every((applicationId) => {
    const ownerId = ownerByApplication.get(applicationId) ?? onboardingOwnerByApplication.get(applicationId) ?? null;
    return Boolean(ownerId && allowed.has(ownerId));
  });
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function ids(formData: FormData, key: string) {
  return Array.from(new Set(formData.getAll(key).filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value))));
}

function groupError(message: string) {
  if (/business_group_name_active|duplicate key/i.test(message)) return "An active business Group with this name already exists.";
  if (/root Partner|root partner|branch cannot/i.test(message)) return message;
  if (/active members before archiving/i.test(message)) return "Move or remove all active Partners before archiving this Group.";
  if (/function .* does not exist|schema cache/i.test(message)) return "The business Group migration has not been applied yet.";
  return message || "The Group hierarchy action could not be completed.";
}

function done(event: string): never {
  revalidatePath(returnPath);
  revalidatePath("/intermediaries");
  redirect(`${returnPath}?success=${encodeURIComponent(event)}`);
}

function fail(message: string): never {
  redirect(`${returnPath}?error=${encodeURIComponent(message)}`);
}
