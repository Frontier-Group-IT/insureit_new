"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canAccessIntermediary } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { hasCapability } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function createIntermediaryPortalLogin(formData: FormData) {
  const reviewer = await requirePospMispManager();
  const intermediaryId = text(formData, "intermediary_id");
  const returnPath = safeReturnPath(text(formData, "return_path"));
  if (!reviewer?.id || !intermediaryId) redirect(`${returnPath}?error=portal_login_invalid`);
  if (!hasCapability(reviewer.role, "review_intermediary_application")) redirect(`${returnPath}?error=portal_login_not_authorized`);
  if (!(await canAccessIntermediary(reviewer.id, reviewer.role, intermediaryId))) redirect(`${returnPath}?error=portal_login_not_authorized`);

  const admin = createSupabaseAdminClient();
  const { data: intermediary } = await admin.from("intermediaries")
    .select("id,application_id,intermediary_type,display_name,email,portal_access_status")
    .eq("id", intermediaryId)
    .maybeSingle<{ id:string; application_id:string|null; intermediary_type:"posp"|"misp"|"partner"; display_name:string; email:string|null; portal_access_status:string }>();

  if (!intermediary || intermediary.intermediary_type === "partner") redirect(`${returnPath}?error=portal_login_not_available`);
  if (!intermediary.email) redirect(`${returnPath}?error=portal_login_email_required`);
  if (intermediary.portal_access_status !== "not_created") redirect(`${returnPath}?error=portal_login_exists`);

  const { data: application } = intermediary.application_id ? await admin.from("intermediary_onboarding_applications")
    .select("registration_status").eq("id", intermediary.application_id).maybeSingle<{ registration_status:string }>() : { data:null };
  const eligible = ["training_pending","training_assigned","training_in_progress","training_completed","exam_pending","exam_allotted","exam_in_progress","exam_failed","exam_passed","agreement_pending","agreement_sent","agreement_signed","iib_submission_pending","iib_submitted","iib_registered"].includes(application?.registration_status ?? "");
  if (!eligible) redirect(`${returnPath}?error=portal_login_stage_locked`);

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : null);
  const inviteOptions = siteUrl ? { redirectTo: `${siteUrl}/auth/callback?next=/intermediary-portal`, data: { full_name: intermediary.display_name, role: "intermediary" } } : { data: { full_name: intermediary.display_name, role: "intermediary" } };
  const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(intermediary.email, inviteOptions);
  if (inviteError || !invite.user?.id) redirect(`${returnPath}?error=${encodeURIComponent(inviteError?.message ?? "portal_login_invite_failed")}`);

  const now = new Date().toISOString();
  const { error: profileError } = await admin.from("profiles").upsert({ id: invite.user.id, full_name: intermediary.display_name, role: "intermediary", is_active: true, updated_at: now }, { onConflict: "id" });
  if (profileError) { await admin.auth.admin.deleteUser(invite.user.id); redirect(`${returnPath}?error=${encodeURIComponent(profileError.message)}`); }
  const { error: accountError } = await admin.from("intermediary_portal_accounts").insert({ intermediary_id: intermediary.id, application_id: intermediary.application_id, auth_user_id: invite.user.id, email: intermediary.email, status: "invited", invited_at: now, invited_by: reviewer.id, updated_by: reviewer.id, updated_at: now });
  if (accountError) { await admin.from("profiles").delete().eq("id", invite.user.id); await admin.auth.admin.deleteUser(invite.user.id); redirect(`${returnPath}?error=${encodeURIComponent(accountError.message)}`); }
  await admin.from("intermediaries").update({ portal_access_status: "invited", updated_at: now }).eq("id", intermediary.id);
  revalidatePath(returnPath);redirect(`${returnPath}?success=portal_login_invited`);
}
function text(formData: FormData, key: string) { const value = formData.get(key); return typeof value === "string" && value.trim() ? value.trim() : null; }
function safeReturnPath(value: string | null) { return value && /^\/intermediaries(?:\/(?:posp|misp|partner))?$/.test(value) ? value : "/intermediaries"; }
