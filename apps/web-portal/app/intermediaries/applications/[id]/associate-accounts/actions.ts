"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessIntermediary } from "@/lib/employee-access-scope";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedRoles = new Set(["claim_head", "insurance_head", "bodyshop_manager"]);

type AssociateRole = "claim_head" | "insurance_head" | "bodyshop_manager";
type AssociateStatus = "invited" | "active" | "disabled";
type ManagedAssociate = {
  id: string;
  intermediary_id: string;
  application_id: string | null;
  auth_user_id: string;
  name: string;
  phone_number: string;
  email: string;
  designation: string;
  role: AssociateRole | "admin";
  status: AssociateStatus;
  activated_at: string | null;
};

export async function createPartnerAssociateAccount(formData: FormData) {
  const reviewer = await requirePospMispManager();
  const applicationId = value(formData, "application_id");
  const intermediaryId = value(formData, "intermediary_id");
  const name = value(formData, "name");
  const phone = normalizePhone(value(formData, "phone_number"));
  const email = (value(formData, "email") ?? "").toLowerCase();
  const designation = value(formData, "designation");
  const role = value(formData, "role");
  const returnPath = safeReturnPath(value(formData, "return_path"), applicationId);

  if (!reviewer?.id || !applicationId || !intermediaryId || !name || !phone || !email || !designation || !role) {
    redirect(`${returnPath}?error=associate_account_invalid`);
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect(`${returnPath}?error=associate_email_invalid`);
  if (!/^\+?[0-9]{7,15}$/.test(phone)) redirect(`${returnPath}?error=associate_phone_invalid`);
  if (role === "admin" || !allowedRoles.has(role)) redirect(`${returnPath}?error=associate_role_blocked`);

  await assertPartnerAccess(reviewer.id, reviewer.role, applicationId, intermediaryId, returnPath);

  const admin = createSupabaseAdminClient();
  const [{ data: primary }, { data: associate }, { data: groupBranch }, { data: profile }] = await Promise.all([
    admin.from("intermediary_portal_accounts").select("id").ilike("email", email).maybeSingle(),
    admin.from("partner_portal_associate_accounts").select("id").ilike("email", email).maybeSingle(),
    admin.from("portal_access_identities").select("id").ilike("login_email", email).maybeSingle(),
    admin.from("profiles").select("id").ilike("email", email).maybeSingle(),
  ]);
  if (primary || associate || groupBranch || profile) redirect(`${returnPath}?error=associate_email_in_use`);

  const inviteOptions = associateInviteOptions(name, role as AssociateRole);
  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
  if (inviteError || !invite.user?.id) {
    redirectAuthEmailError(returnPath, inviteError?.message ?? "associate_invite_failed");
  }

  const now = new Date().toISOString();
  const authUserId = invite.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: authUserId,
    full_name: name,
    role: "intermediary",
    email,
    phone,
    is_active: true,
    updated_at: now,
  }, { onConflict: "id" });

  if (profileError) {
    await admin.auth.admin.deleteUser(authUserId);
    redirect(`${returnPath}?error=${encodeURIComponent(profileError.message)}`);
  }

  const { data: account, error: accountError } = await admin.from("partner_portal_associate_accounts")
    .insert({
      intermediary_id: intermediaryId,
      application_id: applicationId,
      auth_user_id: authUserId,
      name,
      phone_number: phone,
      email,
      designation,
      role,
      status: "invited",
      invited_at: now,
      invited_by: reviewer.id,
      updated_by: reviewer.id,
      updated_at: now,
    })
    .select("id")
    .single<{ id:string }>();

  if (accountError || !account) {
    await admin.from("profiles").delete().eq("id", authUserId);
    await admin.auth.admin.deleteUser(authUserId);
    redirect(`${returnPath}?error=${encodeURIComponent(accountError?.message ?? "associate_create_failed")}`);
  }

  await admin.from("partner_portal_associate_account_audit").insert({
    associate_account_id: account.id,
    intermediary_id: intermediaryId,
    auth_user_id: authUserId,
    event_type: "invited",
    actor_profile_id: reviewer.id,
    details: { email, role, designation, phone_number: phone },
  });

  finish(returnPath, applicationId, "associate_account_invited");
}

export async function updatePartnerAssociateAccount(formData: FormData) {
  const context = await loadManagedAssociate(formData);
  const name = value(formData, "name");
  const phone = normalizePhone(value(formData, "phone_number"));
  const designation = value(formData, "designation");
  const role = value(formData, "role");

  if (!name || !phone || !designation || !role) redirect(`${context.returnPath}?error=associate_account_invalid`);
  if (!/^\+?[0-9]{7,15}$/.test(phone)) redirect(`${context.returnPath}?error=associate_phone_invalid`);
  if (role === "admin" || !allowedRoles.has(role)) redirect(`${context.returnPath}?error=associate_role_blocked`);

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: oldProfile } = await admin.from("profiles")
    .select("full_name,phone")
    .eq("id", context.associate.auth_user_id)
    .maybeSingle<{ full_name: string | null; phone: string | null }>();
  const { data: authData } = await admin.auth.admin.getUserById(context.associate.auth_user_id);

  const { error: accountError } = await admin.from("partner_portal_associate_accounts").update({
    name,
    phone_number: phone,
    designation,
    role,
    updated_by: context.reviewerId,
    updated_at: now,
  }).eq("id", context.associate.id);
  if (accountError) redirect(`${context.returnPath}?error=associate_update_failed`);

  const { error: profileError } = await admin.from("profiles").update({
    full_name: name,
    phone,
    updated_at: now,
  }).eq("id", context.associate.auth_user_id);

  const currentMetadata = authData.user?.user_metadata ?? {};
  const { error: authError } = await admin.auth.admin.updateUserById(context.associate.auth_user_id, {
    user_metadata: {
      ...currentMetadata,
      full_name: name,
      partner_associate_role: role,
    },
  });

  if (profileError || authError) {
    await admin.from("partner_portal_associate_accounts").update({
      name: context.associate.name,
      phone_number: context.associate.phone_number,
      designation: context.associate.designation,
      role: context.associate.role,
      updated_at: now,
    }).eq("id", context.associate.id);
    if (oldProfile) {
      await admin.from("profiles").update({
        full_name: oldProfile.full_name,
        phone: oldProfile.phone,
        updated_at: now,
      }).eq("id", context.associate.auth_user_id);
    }
    redirect(`${context.returnPath}?error=associate_update_failed`);
  }

  finish(context.returnPath, context.applicationId, "associate_account_updated");
}

export async function togglePartnerAssociateAccountStatus(formData: FormData) {
  const context = await loadManagedAssociate(formData);
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const disabling = context.associate.status !== "disabled";
  const nextStatus: AssociateStatus = disabling
    ? "disabled"
    : context.associate.activated_at
      ? "active"
      : "invited";

  const { error: accountError } = await admin.from("partner_portal_associate_accounts").update({
    status: nextStatus,
    disabled_at: disabling ? now : null,
    updated_by: context.reviewerId,
    updated_at: now,
  }).eq("id", context.associate.id);
  if (accountError) redirect(`${context.returnPath}?error=associate_status_failed`);

  const { error: profileError } = await admin.from("profiles").update({
    is_active: !disabling,
    updated_at: now,
  }).eq("id", context.associate.auth_user_id);

  if (profileError) {
    await admin.from("partner_portal_associate_accounts").update({
      status: context.associate.status,
      disabled_at: context.associate.status === "disabled" ? now : null,
      updated_at: now,
    }).eq("id", context.associate.id);
    redirect(`${context.returnPath}?error=associate_status_failed`);
  }

  await admin.from("partner_portal_associate_account_audit").insert({
    associate_account_id: context.associate.id,
    intermediary_id: context.intermediaryId,
    auth_user_id: context.associate.auth_user_id,
    event_type: disabling ? "disabled" : "enabled",
    actor_profile_id: context.reviewerId,
    details: { previous_status: context.associate.status, next_status: nextStatus },
  });

  finish(context.returnPath, context.applicationId, disabling ? "associate_account_disabled" : "associate_account_enabled");
}

export async function deletePartnerAssociateAccount(formData: FormData) {
  const context = await loadManagedAssociate(formData);
  const admin = createSupabaseAdminClient();

  const { error: authError } = await admin.auth.admin.deleteUser(context.associate.auth_user_id);
  if (authError) redirect(`${context.returnPath}?error=associate_delete_failed`);

  // auth.users is the ownership root. The account FK cascades on auth deletion;
  // explicit cleanup is idempotent and covers environments where the profile is not cascaded.
  await admin.from("partner_portal_associate_accounts").delete().eq("id", context.associate.id);
  await admin.from("profiles").delete().eq("id", context.associate.auth_user_id);

  finish(context.returnPath, context.applicationId, "associate_account_deleted");
}

export async function resendPartnerAssociateInvite(formData: FormData) {
  const context = await loadManagedAssociate(formData);
  if (context.associate.status === "disabled") {
    redirect(`${context.returnPath}?error=associate_enable_before_resend`);
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.resetPasswordForEmail(context.associate.email, resetOptions());
  if (error) redirectAuthEmailError(context.returnPath, error.message);

  const now = new Date().toISOString();
  await admin.from("partner_portal_associate_accounts").update({
    invited_at: now,
    updated_by: context.reviewerId,
    updated_at: now,
  }).eq("id", context.associate.id);

  await admin.from("partner_portal_associate_account_audit").insert({
    associate_account_id: context.associate.id,
    intermediary_id: context.intermediaryId,
    auth_user_id: context.associate.auth_user_id,
    event_type: "invited",
    actor_profile_id: context.reviewerId,
    details: { email: context.associate.email, resent: true },
  });

  finish(context.returnPath, context.applicationId, "associate_invite_resent");
}

async function loadManagedAssociate(formData: FormData) {
  const reviewer = await requirePospMispManager();
  const applicationId = value(formData, "application_id");
  const intermediaryId = value(formData, "intermediary_id");
  const associateId = value(formData, "associate_id");
  const returnPath = safeReturnPath(value(formData, "return_path"), applicationId);

  if (!reviewer?.id || !applicationId || !intermediaryId || !associateId) {
    redirect(`${returnPath}?error=associate_account_invalid`);
  }

  await assertPartnerAccess(reviewer.id, reviewer.role, applicationId, intermediaryId, returnPath);

  const admin = createSupabaseAdminClient();
  const { data: associate } = await admin.from("partner_portal_associate_accounts")
    .select("id,intermediary_id,application_id,auth_user_id,name,phone_number,email,designation,role,status,activated_at")
    .eq("id", associateId)
    .eq("intermediary_id", intermediaryId)
    .eq("application_id", applicationId)
    .maybeSingle<ManagedAssociate>();

  if (!associate) redirect(`${returnPath}?error=associate_not_found`);

  return {
    reviewerId: reviewer.id,
    applicationId,
    intermediaryId,
    returnPath,
    associate,
  };
}

async function assertPartnerAccess(
  reviewerId: string,
  reviewerRole: string,
  applicationId: string,
  intermediaryId: string,
  returnPath: string,
) {
  if (!(await hasEffectiveCapability({ id: reviewerId, role: reviewerRole } as never, "review_intermediary_application", "edit"))) {
    redirect(`${returnPath}?error=associate_not_authorized`);
  }
  if (!(await canAccessIntermediary(reviewerId, reviewerRole, intermediaryId))) {
    redirect(`${returnPath}?error=associate_not_authorized`);
  }

  const admin = createSupabaseAdminClient();
  const { data: partner } = await admin.from("intermediaries")
    .select("id,application_id,intermediary_type,account_status")
    .eq("id", intermediaryId)
    .maybeSingle<{ id:string; application_id:string|null; intermediary_type:string; account_status:string }>();

  if (!partner || partner.intermediary_type !== "partner" || partner.account_status !== "active" || partner.application_id !== applicationId) {
    redirect(`${returnPath}?error=associate_partner_not_available`);
  }
}

function associateInviteOptions(name: string, role: AssociateRole) {
  const redirectTo = authRedirectTo();
  const data = { full_name: name, role: "intermediary", portal_account_type: "partner_associate", partner_associate_role: role };
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

function redirectAuthEmailError(returnPath: string, message: string): never {
  const retry = message.match(/after\s+(\d+)\s+seconds?/i);
  if (retry?.[1]) {
    redirect(`${returnPath}?error=associate_email_cooldown&retry_after=${encodeURIComponent(retry[1])}`);
  }
  redirect(`${returnPath}?error=${encodeURIComponent(message)}`);
}

function finish(returnPath: string, applicationId: string, event: string): never {
  revalidatePath(returnPath);
  revalidatePath(`/intermediaries/applications/${applicationId}`);
  redirect(`${returnPath}?success=${encodeURIComponent(event)}`);
}

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" && entry.trim() ? entry.trim() : null;
}

function normalizePhone(input: string | null) {
  if (!input) return null;
  const plus = input.trim().startsWith("+") ? "+" : "";
  const digits = input.replace(/\D/g, "");
  return digits ? `${plus}${digits}` : null;
}

function safeReturnPath(path: string | null, applicationId: string | null) {
  const expected = applicationId ? `/intermediaries/applications/${applicationId}/associate-accounts` : null;
  return path && expected && path === expected ? path : "/intermediaries";
}
