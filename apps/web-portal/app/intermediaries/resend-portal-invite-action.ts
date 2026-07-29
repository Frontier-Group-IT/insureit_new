"use server";

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
  if (!hasCapability(reviewer.role, "review_intermediary_application")) redirect(`${returnPath}?error=portal_login_not_authorized`);
  if (!(await canAccessIntermediary(reviewer.id, reviewer.role, intermediaryId))) redirect(`${returnPath}?error=portal_login_not_authorized`);

  const admin = createSupabaseAdminClient();
  const { data: intermediary } = await admin.from("intermediaries")
    .select("id,email,account_status,portal_access_status")
    .eq("id", intermediaryId)
    .maybeSingle<{id:string;email:string|null;account_status:string;portal_access_status:string}>();

  if (!intermediary || intermediary.account_status !== "active" || intermediary.portal_access_status !== "invited") redirect(`${returnPath}?error=portal_resend_not_available`);
  if (!intermediary.email) redirect(`${returnPath}?error=portal_login_email_required`);

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
function safeReturnPath(path: string | null) { return path && /^\/intermediaries(?:\/(?:posp|misp|partner))?$/.test(path) ? path : "/intermediaries"; }
