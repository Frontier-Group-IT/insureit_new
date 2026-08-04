"use server";

import { hasEffectiveCapability, hasAnyEffectiveCapability } from "@/lib/effective-permissions";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessIntermediary } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { hasCapability } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function resendIntermediaryPortalInvite(formData: FormData) {
  const reviewer = await requirePospMispManager();
  const intermediaryId = value(formData, "intermediary_id");
  const returnPath = safeReturnPath(value(formData, "return_path"));
  if (!reviewer?.id || !intermediaryId) redirect(`${returnPath}?error=portal_login_invalid`);
  if (!(await hasEffectiveCapability(reviewer, "review_intermediary_application", "edit"))) redirect(`${returnPath}?error=portal_login_not_authorized`);
  if (!(await canAccessIntermediary(reviewer.id, reviewer.role, intermediaryId))) redirect(`${returnPath}?error=portal_login_not_authorized`);

  const admin = createSupabaseAdminClient();
  const { data: intermediary } = await admin.from("intermediaries")
    .select("id,application_id,intermediary_type,email,account_status,portal_access_status")
    .eq("id", intermediaryId)
    .maybeSingle<{id:string;application_id:string|null;intermediary_type:"posp"|"misp"|"partner";email:string|null;account_status:string;portal_access_status:string}>();

  if (!intermediary || intermediary.portal_access_status !== "invited") redirect(`${returnPath}?error=portal_resend_not_available`);
  if (!intermediary.email) redirect(`${returnPath}?error=portal_login_email_required`);
  const { data: application } = intermediary.application_id ? await admin.from("intermediary_onboarding_applications")
    .select("partner_status").eq("id", intermediary.application_id).maybeSingle<{ partner_status:string|null }>() : { data:null };
  const activePartner = intermediary.intermediary_type === "partner" || application?.partner_status === "active_partner";
  if (!activePartner && intermediary.account_status !== "active") redirect(`${returnPath}?error=portal_resend_not_available`);

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : undefined);
  const redirectTo = siteUrl ? `${siteUrl}/auth/callback?next=/intermediary-portal` : undefined;
  const { error } = await admin.auth.resetPasswordForEmail(intermediary.email, redirectTo ? { redirectTo } : undefined);
  if (error) redirect(`${returnPath}?error=${encodeURIComponent(error.message)}`);

  const now = new Date().toISOString();
  await admin.from("intermediary_portal_accounts").update({ invited_at: now, invited_by: reviewer.id, updated_by: reviewer.id, updated_at: now }).eq("intermediary_id", intermediary.id).eq("status", "invited");
  revalidatePath(returnPath);
  redirect(`${returnPath}?success=portal_invite_resent`);
}
function value(formData: FormData, key: string) { const entry = formData.get(key); return typeof entry === "string" && entry.trim() ? entry.trim() : null; }
function safeReturnPath(path: string | null) { return path && /^\/intermediaries(?:\/(?:posp|misp|partner)|\/applications\/[0-9a-f-]+)?$/i.test(path) ? path : "/intermediaries"; }
