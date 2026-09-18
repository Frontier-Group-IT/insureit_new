"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessIntermediary } from "@/lib/employee-access-scope";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PartnerRow = {
  id: string;
  application_id: string | null;
  intermediary_type: string;
  display_name: string;
  account_status: string;
};

type AdditionalUserRow = {
  id: string;
  intermediary_id: string;
  auth_user_id: string;
  email: string;
  status: "invited" | "active" | "disabled";
  activated_at: string | null;
};

export async function createAdditionalPartnerPortalLogin(formData: FormData) {
  const reviewer = await requirePospMispManager();
  const intermediaryId = value(formData, "intermediary_id");
  const email = (value(formData, "login_email") ?? "").toLowerCase();
  const returnPath = safeReturnPath(value(formData, "return_path"));

  if (!reviewer?.id || !intermediaryId || !email) redirect(`${returnPath}?error=partner_multi_login_invalid`);
  if (!/^\S+@\S+\.\S+$/.test(email)) redirect(`${returnPath}?error=partner_multi_login_email_invalid`);
  if (!(await hasEffectiveCapability(reviewer, "review_intermediary_application", "edit"))) {
    redirect(`${returnPath}?error=partner_multi_login_not_authorized`);
  }
  if (!(await canAccessIntermediary(reviewer.id, reviewer.role, intermediaryId))) {
    redirect(`${returnPath}?error=partner_multi_login_not_authorized`);
  }

  const admin = createSupabaseAdminClient();
  const { data: partner } = await admin
    .from("intermediaries")
    .select("id,application_id,intermediary_type,display_name,account_status")
    .eq("id", intermediaryId)
    .maybeSingle<PartnerRow>();

  if (!partner || partner.intermediary_type !== "partner" || partner.account_status !== "active") {
    redirect(`${returnPath}?error=partner_multi_login_not_available`);
  }

  const [
    { data: legacyAccount },
    { data: additionalAccount },
    { data: groupBranchAccount },
    { data: existingProfile },
  ] = await Promise.all([
    admin.from("intermediary_portal_accounts").select("id").ilike("email", email).maybeSingle(),
    admin.from("partner_portal_additional_users").select("id").ilike("email", email).maybeSingle(),
    admin.from("portal_access_identities").select("id").ilike("login_email", email).maybeSingle(),
    admin.from("profiles").select("id").ilike("email", email).maybeSingle(),
  ]);

  if (legacyAccount || additionalAccount || groupBranchAccount || existingProfile) {
    redirect(`${returnPath}?error=partner_multi_login_email_in_use`);
  }

  const { data: familyId, error: familyError } = await admin.rpc("partner_app_resolve_partner_family", {
    p_intermediary_id: intermediaryId,
  });
  if (familyError || !familyId) redirect(`${returnPath}?error=partner_multi_login_partner_family_unresolved`);

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : null);
  const inviteOptions = siteUrl
    ? {
        redirectTo: `${siteUrl}/auth/callback?next=/intermediary-portal`,
        data: { full_name: partner.display_name, role: "intermediary", portal_account_type: "partner_additional" },
      }
    : { data: { full_name: partner.display_name, role: "intermediary", portal_account_type: "partner_additional" } };

  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
  if (inviteError || !invite.user?.id) {
    redirect(`${returnPath}?error=${encodeURIComponent(inviteError?.message ?? "partner_multi_login_invite_failed")}`);
  }

  const now = new Date().toISOString();
  const profileId = invite.user.id;
  const { error: profileError } = await admin.from("profiles").upsert({
    id: profileId,
    full_name: partner.display_name,
    role: "intermediary",
    email,
    is_active: true,
    updated_at: now,
  }, { onConflict: "id" });

  if (profileError) {
    await admin.auth.admin.deleteUser(profileId);
    redirect(`${returnPath}?error=${encodeURIComponent(profileError.message)}`);
  }

  const { data: account, error: accountError } = await admin
    .from("partner_portal_additional_users")
    .insert({
      intermediary_id: intermediaryId,
      application_id: partner.application_id,
      auth_user_id: profileId,
      email,
      status: "invited",
      invited_at: now,
      invited_by: reviewer.id,
      updated_by: reviewer.id,
      updated_at: now,
    })
    .select("id")
    .single<{ id: string }>();

  if (accountError || !account) {
    await admin.from("profiles").delete().eq("id", profileId);
    await admin.auth.admin.deleteUser(profileId);
    redirect(`${returnPath}?error=${encodeURIComponent(accountError?.message ?? "partner_multi_login_create_failed")}`);
  }

  await admin.from("partner_portal_additional_user_audit").insert({
    partner_portal_user_id: account.id,
    intermediary_id: intermediaryId,
    auth_user_id: profileId,
    event_type: "invited",
    actor_profile_id: reviewer.id,
    details: { email, partner_family_id: familyId },
  });
  await admin.rpc("service_partner_portal_refresh_access_status", { p_intermediary_id: intermediaryId });

  revalidatePath("/intermediaries/portal-users");
  revalidatePath(returnPath);
  redirect(`${returnPath}?success=partner_multi_login_invited`);
}

export async function resendAdditionalPartnerPortalInvite(formData: FormData) {
  const { reviewer, account, returnPath, admin } = await requireManageableAdditionalUser(formData);
  if (account.status !== "invited") redirect(`${returnPath}?error=partner_multi_login_resend_not_available`);

  const origin = siteUrl();
  const redirectTo = origin ? `${origin}/auth/callback?next=/intermediary-portal` : undefined;
  const { error } = await admin.auth.resetPasswordForEmail(account.email, redirectTo ? { redirectTo } : undefined);
  if (error) redirect(`${returnPath}?error=${encodeURIComponent(error.message)}`);

  const now = new Date().toISOString();
  await admin.from("partner_portal_additional_users").update({
    invited_at: now,
    invited_by: reviewer.id,
    updated_by: reviewer.id,
    updated_at: now,
  }).eq("id", account.id);

  await admin.from("partner_portal_additional_user_audit").insert({
    partner_portal_user_id: account.id,
    intermediary_id: account.intermediary_id,
    auth_user_id: account.auth_user_id,
    event_type: "invite_resent",
    actor_profile_id: reviewer.id,
  });

  revalidatePath(returnPath);
  redirect(`${returnPath}?success=partner_multi_login_invite_resent`);
}

export async function resetAdditionalPartnerPortalPassword(formData: FormData) {
  const { reviewer, account, returnPath, admin } = await requireManageableAdditionalUser(formData);
  if (account.status !== "active") redirect(`${returnPath}?error=partner_multi_login_reset_not_available`);

  const origin = siteUrl();
  const redirectTo = origin ? `${origin}/auth/callback?next=/intermediary-portal` : undefined;
  const { error } = await admin.auth.resetPasswordForEmail(account.email, redirectTo ? { redirectTo } : undefined);
  if (error) redirect(`${returnPath}?error=${encodeURIComponent(error.message)}`);

  await admin.from("partner_portal_additional_user_audit").insert({
    partner_portal_user_id: account.id,
    intermediary_id: account.intermediary_id,
    auth_user_id: account.auth_user_id,
    event_type: "password_reset",
    actor_profile_id: reviewer.id,
  });

  revalidatePath(returnPath);
  redirect(`${returnPath}?success=partner_multi_login_password_reset`);
}

export async function setAdditionalPartnerPortalLoginStatus(formData: FormData) {
  const { reviewer, account, returnPath, admin } = await requireManageableAdditionalUser(formData);
  const next = value(formData, "next_status");
  if (next !== "disabled" && next !== "enabled") redirect(`${returnPath}?error=partner_multi_login_invalid`);

  const now = new Date().toISOString();
  const nextStatus = next === "disabled" ? "disabled" : account.activated_at ? "active" : "invited";
  const { error } = await admin.from("partner_portal_additional_users").update({
    status: nextStatus,
    disabled_at: next === "disabled" ? now : null,
    updated_by: reviewer.id,
    updated_at: now,
  }).eq("id", account.id);

  if (error) redirect(`${returnPath}?error=${encodeURIComponent(error.message)}`);

  await admin.from("partner_portal_additional_user_audit").insert({
    partner_portal_user_id: account.id,
    intermediary_id: account.intermediary_id,
    auth_user_id: account.auth_user_id,
    event_type: next === "disabled" ? "disabled" : "enabled",
    actor_profile_id: reviewer.id,
  });
  await admin.rpc("service_partner_portal_refresh_access_status", {
    p_intermediary_id: account.intermediary_id,
  });

  revalidatePath("/intermediaries/portal-users");
  revalidatePath(returnPath);
  redirect(`${returnPath}?success=${next === "disabled" ? "partner_multi_login_disabled" : "partner_multi_login_enabled"}`);
}

async function requireManageableAdditionalUser(formData: FormData) {
  const reviewer = await requirePospMispManager();
  const accountId = value(formData, "account_id");
  const returnPath = safeReturnPath(value(formData, "return_path"));
  if (!reviewer?.id || !accountId) redirect(`${returnPath}?error=partner_multi_login_invalid`);
  if (!(await hasEffectiveCapability(reviewer, "review_intermediary_application", "edit"))) {
    redirect(`${returnPath}?error=partner_multi_login_not_authorized`);
  }

  const admin = createSupabaseAdminClient();
  const { data: account } = await admin.from("partner_portal_additional_users")
    .select("id,intermediary_id,auth_user_id,email,status,activated_at")
    .eq("id", accountId)
    .maybeSingle<AdditionalUserRow>();

  if (!account) redirect(`${returnPath}?error=partner_multi_login_not_available`);
  if (!(await canAccessIntermediary(reviewer.id, reviewer.role, account.intermediary_id))) {
    redirect(`${returnPath}?error=partner_multi_login_not_authorized`);
  }
  return { reviewer, account, returnPath, admin };
}

function siteUrl() {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : null);
}

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" && entry.trim() ? entry.trim() : null;
}

function safeReturnPath(path: string | null) {
  return path && /^\/intermediaries\/portal-users\/[0-9a-f-]+$/i.test(path)
    ? path
    : "/intermediaries/portal-users";
}
