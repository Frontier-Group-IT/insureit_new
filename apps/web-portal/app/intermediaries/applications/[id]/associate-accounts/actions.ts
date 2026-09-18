"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessIntermediary } from "@/lib/employee-access-scope";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedRoles = new Set(["claim_head", "insurance_head", "bodyshop_manager"]);

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

  if (!(await hasEffectiveCapability(reviewer, "review_intermediary_application", "edit"))) {
    redirect(`${returnPath}?error=associate_not_authorized`);
  }
  if (!(await canAccessIntermediary(reviewer.id, reviewer.role, intermediaryId))) {
    redirect(`${returnPath}?error=associate_not_authorized`);
  }

  const admin = createSupabaseAdminClient();
  const { data: partner } = await admin.from("intermediaries")
    .select("id,application_id,intermediary_type,display_name,account_status")
    .eq("id", intermediaryId)
    .maybeSingle<{ id:string; application_id:string|null; intermediary_type:string; display_name:string; account_status:string }>();

  if (!partner || partner.intermediary_type !== "partner" || partner.account_status !== "active" || partner.application_id !== applicationId) {
    redirect(`${returnPath}?error=associate_partner_not_available`);
  }

  const [{ data: primary }, { data: associate }, { data: groupBranch }, { data: profile }] = await Promise.all([
    admin.from("intermediary_portal_accounts").select("id").ilike("email", email).maybeSingle(),
    admin.from("partner_portal_associate_accounts").select("id").ilike("email", email).maybeSingle(),
    admin.from("portal_access_identities").select("id").ilike("login_email", email).maybeSingle(),
    admin.from("profiles").select("id").ilike("email", email).maybeSingle(),
  ]);
  if (primary || associate || groupBranch || profile) redirect(`${returnPath}?error=associate_email_in_use`);

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : null);
  const inviteOptions = siteUrl
    ? {
        redirectTo: `${siteUrl}/auth/callback?next=/intermediary-portal`,
        data: { full_name: name, role: "intermediary", portal_account_type: "partner_associate", partner_associate_role: role },
      }
    : { data: { full_name: name, role: "intermediary", portal_account_type: "partner_associate", partner_associate_role: role } };

  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, inviteOptions);
  if (inviteError || !invite.user?.id) {
    redirect(`${returnPath}?error=${encodeURIComponent(inviteError?.message ?? "associate_invite_failed")}`);
  }

  const now = new Date().toISOString();
  const authUserId = invite.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: authUserId,
    full_name: name,
    role: "intermediary",
    email,
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

  revalidatePath(returnPath);
  revalidatePath(`/intermediaries/applications/${applicationId}`);
  redirect(`${returnPath}?success=associate_account_invited`);
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
