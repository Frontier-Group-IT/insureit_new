"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getIntermediaryGroupEmployeeScope,
  requireIntermediaryGroupManager,
} from "@/lib/intermediary-group-access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type AccessEntityType = "group" | "branch";
type ManagerProfile = Awaited<ReturnType<typeof requireIntermediaryGroupManager>>;
type PartnerRow = { id: string; source_application_id: string | null };
type ParentIntermediaryRow = { application_id: string | null; associate_employee_id: string | null };
type OnboardingOwnerRow = { application_id: string; associate_employee_id: string | null };

type PortalAccessRow = {
  profile_id: string;
  entity_type: AccessEntityType;
  entity_id: string;
  status: "active" | "disabled";
  login_email: string;
};

const returnPath = "/intermediaries/groups/login-access";

export async function createGroupBranchPortalLogin(formData: FormData) {
  const manager = await requireIntermediaryGroupManager();
  const entityType = entityTypeValue(formData);
  const entityId = text(formData, "entity_id");
  const loginEmail = text(formData, "login_email").toLowerCase();
  const phone = text(formData, "phone");

  if (!entityType || !uuid(entityId) || !email(loginEmail)) fail("Enter a valid Group/Branch and login email.");
  if (!phoneNumber(phone)) fail("Enter a valid phone number.");
  if (!(await canManageEntity(manager, entityType, entityId))) fail("The selected Group or Branch is outside your permitted hierarchy.");

  const admin = createSupabaseAdminClient();
  const [{ data: existingEntity }, { data: existingEmail }, { data: existingProfileEmail }] = await Promise.all([
    admin.from("portal_access_identities").select("profile_id").eq("entity_type", entityType).eq("entity_id", entityId).maybeSingle(),
    admin.from("portal_access_identities").select("profile_id").ilike("login_email", loginEmail).maybeSingle(),
    admin.from("profiles").select("id").ilike("email", loginEmail).maybeSingle(),
  ]);
  if (existingEntity) fail("Portal login already exists for this Group or Branch.");
  if (existingEmail || existingProfileEmail) fail("That login email is already assigned to another portal user.");

  const displayName = await entityDisplayName(entityType, entityId);
  if (!displayName) fail("The selected Group or Branch is not available.");

  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(loginEmail, inviteOptions(displayName, entityType));
  if (inviteError || !invite.user?.id) fail(inviteError?.message || "Unable to send the portal invitation.");

  const profileId = invite.user.id;
  const now = new Date().toISOString();
  const { error: profileError } = await admin.from("profiles").upsert({
    id: profileId,
    full_name: displayName,
    role: "intermediary",
    email: loginEmail,
    phone,
    is_active: true,
    updated_at: now,
  }, { onConflict: "id" });
  if (profileError) {
    await admin.auth.admin.deleteUser(profileId);
    fail(profileError.message);
  }

  const { error: mappingError } = await admin.from("portal_access_identities").insert({
    profile_id: profileId,
    entity_type: entityType,
    entity_id: entityId,
    status: "active",
    login_email: loginEmail,
    created_by: manager.id,
    updated_by: manager.id,
    updated_at: now,
  });
  if (mappingError) {
    await admin.from("profiles").delete().eq("id", profileId);
    await admin.auth.admin.deleteUser(profileId);
    fail(mappingError.message);
  }

  done("portal_invite_sent");
}

export async function resendGroupBranchPortalInvite(formData: FormData) {
  const manager = await requireIntermediaryGroupManager();
  const mapping = await loadAuthorizedMapping(manager, formData);
  if (mapping.status !== "active") fail("Enable this login before resending its invitation.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(mapping.login_email, resetOptions());
  if (error) fail(error.message);
  done("portal_invite_resent");
}

export async function sendGroupBranchPortalPasswordReset(formData: FormData) {
  const manager = await requireIntermediaryGroupManager();
  const mapping = await loadAuthorizedMapping(manager, formData);
  if (mapping.status !== "active") fail("Enable this login before sending a password reset.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(mapping.login_email, resetOptions());
  if (error) fail(error.message);
  done("portal_password_email_sent");
}

export async function setGroupBranchPortalLoginStatus(formData: FormData) {
  const manager = await requireIntermediaryGroupManager();
  const mapping = await loadAuthorizedMapping(manager, formData);
  const nextStatus = text(formData, "next_status") === "active" ? "active" : "disabled";
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { error: mappingError } = await admin.from("portal_access_identities").update({
    status: nextStatus,
    updated_by: manager.id,
    updated_at: now,
  }).eq("profile_id", mapping.profile_id);
  if (mappingError) fail(mappingError.message);

  const { error: profileError } = await admin.from("profiles").update({
    is_active: nextStatus === "active",
    updated_at: now,
  }).eq("id", mapping.profile_id);
  if (profileError) {
    await admin.from("portal_access_identities").update({
      status: mapping.status,
      updated_by: manager.id,
      updated_at: now,
    }).eq("profile_id", mapping.profile_id);
    fail(profileError.message);
  }

  done(nextStatus === "active" ? "portal_login_enabled" : "portal_login_disabled");
}

async function loadAuthorizedMapping(manager: ManagerProfile, formData: FormData) {
  const entityType = entityTypeValue(formData);
  const entityId = text(formData, "entity_id");
  if (!entityType || !uuid(entityId)) fail("Portal login mapping is invalid.");
  if (!(await canManageEntity(manager, entityType, entityId))) fail("The selected Group or Branch is outside your permitted hierarchy.");

  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("portal_access_identities")
    .select("profile_id,entity_type,entity_id,status,login_email")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle<PortalAccessRow>();
  if (!data) fail("Portal login has not been created for this Group or Branch.");
  return data;
}

async function canManageEntity(manager: ManagerProfile, entityType: AccessEntityType, entityId: string) {
  const scope = await getIntermediaryGroupEmployeeScope(manager);
  const admin = createSupabaseAdminClient();
  if (scope.mode === "organization") return true;

  if (entityType === "branch") {
    const { data: branch } = await admin.from("partners")
      .select("id,parent_partner_id,partner_branch_profiles!inner(created_by)")
      .eq("id", entityId)
      .eq("partner_status", "active_partner")
      .maybeSingle<{ id: string; parent_partner_id: string | null; partner_branch_profiles: Array<{ created_by: string | null }> | null }>();
    if (!branch) return false;
    if (branch.parent_partner_id) return canAccessPartners(manager, [branch.parent_partner_id]);
    return branch.partner_branch_profiles?.[0]?.created_by === manager.id;
  }

  const { data: group } = await admin.from("intermediary_groups")
    .select("id,status,group_mode,owner_employee_id,created_by")
    .eq("id", entityId)
    .maybeSingle<{ id: string; status: string; group_mode: string | null; owner_employee_id: string | null; created_by: string | null }>();
  if (!group || group.status !== "active") return false;
  if ((group.group_mode ?? "legacy_employee") === "legacy_employee") {
    return Boolean(group.owner_employee_id && scope.employeeIds.includes(group.owner_employee_id));
  }
  if (group.created_by === manager.id) return true;

  const { data: memberships } = await admin.from("intermediary_group_memberships")
    .select("partner_id")
    .eq("group_id", entityId)
    .is("effective_to", null)
    .returns<Array<{ partner_id: string }>>();
  const partnerIds = (memberships ?? []).map((row) => row.partner_id);
  return partnerIds.length > 0 && canAccessPartners(manager, partnerIds);
}

async function canAccessPartners(manager: ManagerProfile, partnerIds: string[]) {
  if (!partnerIds.length) return true;
  const scope = await getIntermediaryGroupEmployeeScope(manager);
  if (scope.mode === "organization") return true;
  if (!scope.employeeIds.length) return false;

  const admin = createSupabaseAdminClient();
  const { data: partners } = await admin.from("partners")
    .select("id,source_application_id")
    .in("id", partnerIds)
    .returns<PartnerRow[]>();
  if ((partners ?? []).length !== new Set(partnerIds).size) return false;
  const applicationIds = (partners ?? []).map((row) => row.source_application_id).filter((value): value is string => Boolean(value));
  if (applicationIds.length !== partnerIds.length) return false;

  const [{ data: intermediaryRows }, { data: onboardingOwners }] = await Promise.all([
    admin.from("intermediaries")
      .select("application_id,associate_employee_id")
      .eq("intermediary_type", "partner")
      .in("application_id", applicationIds)
      .returns<ParentIntermediaryRow[]>(),
    admin.from("posp_misp_onboarding_profiles")
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

async function entityDisplayName(entityType: AccessEntityType, entityId: string) {
  const admin = createSupabaseAdminClient();
  if (entityType === "group") {
    const { data } = await admin.from("intermediary_groups").select("group_name").eq("id", entityId).eq("status", "active").maybeSingle<{ group_name: string }>();
    return data?.group_name ?? null;
  }
  const { data } = await admin.from("partners").select("display_name,partner_branch_profiles!inner(partner_id)").eq("id", entityId).maybeSingle<{ display_name: string }>();
  return data?.display_name ?? null;
}

function inviteOptions(displayName: string, entityType: AccessEntityType) {
  const redirectTo = authRedirectTo();
  const data = { full_name: displayName, role: "intermediary", portal_account_type: entityType };
  return redirectTo ? { redirectTo, data } : { data };
}

function resetOptions() {
  const redirectTo = authRedirectTo();
  return redirectTo ? { redirectTo } : undefined;
}

function authRedirectTo() {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : null);
  return siteUrl ? `${siteUrl}/auth/callback?next=/intermediary-portal` : undefined;
}

function entityTypeValue(formData: FormData): AccessEntityType | null {
  const value = text(formData, "entity_type");
  return value === "group" || value === "branch" ? value : null;
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function email(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function phoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function done(event: string): never {
  revalidatePath(returnPath);
  revalidatePath("/intermediaries/groups");
  revalidatePath("/intermediaries/groups/branches");
  redirect(`${returnPath}?success=${encodeURIComponent(event)}`);
}

function fail(message: string): never {
  redirect(`${returnPath}?error=${encodeURIComponent(message || "Portal login action failed.")}`);
}
