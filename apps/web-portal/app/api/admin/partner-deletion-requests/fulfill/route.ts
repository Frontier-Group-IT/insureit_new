import { NextResponse } from "next/server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendResendEmail } from "@/lib/resend-email";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (body: Record<string,unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Deliberately limited to an isolated PRIMARY INTERMEDIARY login with no
 * shared, associate, learning or business ownership dependency. Never run
 * generic profile deletion, and never delete a partner business entity.
 * This is an irreversible operation. Use only with approved test identities
 * until end-to-end verified in a controlled environment.
 */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Same-origin only." }, 403);
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || profile.role !== "it_super_user") return reply({ error: "Access denied." }, 403);
  const input = await request.json().catch(() => null) as { id?: unknown; confirmation?: unknown; retentionConfirmed?: unknown } | null;
  if (!input || typeof input.id !== "string" || !UUID.test(input.id) || input.confirmation !== "DELETE LOGIN IDENTITY" || input.retentionConfirmed !== true) return reply({ error: "Request ID, exact confirmation and retention approval required." }, 400);
  if (process.env.PARTNER_DELETION_EXECUTION_ENABLED !== "true") return reply({ error:"Identity deletion execution is disabled until test verification and explicit rollout." },503);
  const admin = createSupabaseAdminClient();
  const { data: row, error: rowError } = await admin.from("partner_account_deletion_requests")
    .select("id,auth_user_id,actor_kind,actor_id,intermediary_id,status").eq("id", input.id).maybeSingle();
  if (rowError || !row || row.status !== "under_review" || row.actor_kind !== "intermediary") return reply({ error: "Not an eligible reviewed intermediary request." }, 409);
  if (row.auth_user_id === profile.id) return reply({ error: "Self-deletion forbidden for an IT administrator." }, 403);

  const [{ data: portals, error: pe }, { data: associates, error: ae }, { data: groups, error: ge }, { data: profiles, error: pre }, { count: learning, error: le }, { data: blockers, error: be }] = await Promise.all([
    admin.from("intermediary_portal_accounts").select("id,status,intermediary_id").eq("auth_user_id",row.auth_user_id),
    admin.from("partner_portal_associate_accounts").select("id").eq("auth_user_id",row.auth_user_id),
    admin.from("group_portal_associate_accounts").select("id").eq("auth_user_id",row.auth_user_id),
    admin.from("profiles").select("id,role,employee_id").eq("id",row.auth_user_id),
    admin.from("partner_learning_attempts").select("id",{head:true,count:"exact"}).eq("auth_user_id",row.auth_user_id),
    admin.rpc("admin_hard_delete_blockers",{p_target_table:"profiles",p_target_id:row.auth_user_id}),
  ]);
  if (pe || ae || ge || pre || le || be) return reply({ error:"Dependency preflight unavailable: no changes made." },503);
  if (profiles?.length !== 1 || profiles[0].role !== "intermediary" || profiles[0].employee_id || associates?.length || groups?.length || learning || (Array.isArray(blockers) && blockers.length) ||
    portals?.length !== 1 || portals[0].id !== row.actor_id || portals[0].intermediary_id !== row.intermediary_id) {
    return reply({ error:"Shared identity or protected data detected. Manual retention remediation is required; nothing was deleted." },409);
  }
  // Insurance intake requests may RESTRICT portal record deletion, so NEVER
  // delete the portal account. Detach its Auth reference only.
  const { data: user, error: userError } = await admin.auth.admin.getUserById(row.auth_user_id);
  if (userError || !user?.user?.email) return reply({ error:"Verified identity and notification email required." },409);
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return reply({ error:"Completion notification provider must be configured." },503);

  // Atomic claim: only one administrator may execute any given request.
  const { data: claimed, error: claimError } = await admin.from("partner_account_deletion_requests")
    .update({ status:"fulfilling", updated_at:new Date().toISOString(), fulfillment_authorized_by:profile.id, fulfillment_authorized_at:new Date().toISOString(), retention_reviewed_at:new Date().toISOString(), identity_verified_at:new Date().toISOString() })
    .eq("id",row.id).eq("status","under_review").select("id").maybeSingle();
  if (claimError || !claimed) return reply({ error:"Request already claimed, changed, or could not be reserved. No deletion performed." },409);

  const { error: claimAuditError } = await admin.from("partner_account_deletion_events").insert({
    request_id:row.id, actor_profile_id:profile.id, action:"fulfillment_authorized",
    details:{ mode:"auth_soft_delete", actor_kind:row.actor_kind },
  });
  if (claimAuditError) return reply({ error:"Claim reserved, but audit write failed. IT reconciliation required; no identity deletion performed." },503);

  // Freeze the login before any irreversible operation. A failed delete leaves
  // a suspended identity for manual investigation rather than an active account.
  const { error: banError } = await admin.auth.admin.updateUserById(row.auth_user_id,{ ban_duration:"876000h" });
  if (banError) return reply({ error:"Unable to suspend identity; no deletion performed." },503);
  const { error: detachError } = await admin.from("intermediary_portal_accounts")
    .update({auth_user_id:null,status:"disabled"}).eq("id",row.actor_id).eq("auth_user_id",row.auth_user_id).select("id").single();
  if (detachError) return reply({ error:"Identity suspended, but could not detach portal account. Contact IT." },503);
  // Soft-delete preserves the auth.users primary key, preventing cascades into historical business records.
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(row.auth_user_id, true);
  if (authDeleteError) return reply({ error:"Portal access detached and identity suspended; Auth deletion needs manual recovery." },503);
  // Preserve the profile FK identity but remove redundant personal contact details.
  // Only this isolated intermediary profile is eligible for this branch.
  const { error: profileMaskError } = await admin.from("profiles").update({
    full_name:"Deleted Partner Account", email:null, is_active:false, updated_at:new Date().toISOString(),
  }).eq("id",row.auth_user_id).eq("role","intermediary");
  if (profileMaskError) return reply({ error:"Auth identity deleted but profile minimization failed. IT reconciliation required." },503);
  const { error: identityEventError } = await admin.from("partner_account_deletion_events").insert({
    request_id:row.id, actor_profile_id:profile.id, action:"identity_revoked",
    details:{ mode:"auth_soft_delete", portal_account_id:row.actor_id },
  });
  if (identityEventError) return reply({ error:"Identity soft-deleted but audit event failed. IT reconciliation required." },503);

  // Any notify failure stays under_review, requiring manual notification retry.
  try {
    const email = await sendResendEmail({
      to:user.user.email, subject:"INSUREIT Partner account deletion completed",
      text:"Your individual INSUREIT Partner sign-in identity has been removed following your request. Insurance, legal, financial and audit records are retained only where applicable. If you need assistance, contact insureit@frontiergroup.in.",
      idempotencyKey:`partner-account-deletion-completed-${row.id}`,
    });
    const now = new Date().toISOString();
    const { error: completedError } = await admin.from("partner_account_deletion_requests").update({
      status:"fulfilled",completed_at:now,updated_at:now,identity_verified_at:now,retention_reviewed_at:now,
      fulfillment_authorized_by:profile.id,fulfillment_authorized_at:now,notification_sent_at:now,fulfillment_reference:email.id,
      resolution_note:"Primary intermediary Auth identity soft-deleted (irreversible), portal login disabled, business FK history preserved; completion email accepted by provider.",
    }).eq("id",row.id).eq("status","fulfilling");
    if (completedError) return reply({ error:"Identity deleted and notification accepted, but request audit finalization requires IT reconciliation." },503);
    await admin.from("partner_account_deletion_events").insert({ request_id:row.id, actor_profile_id:profile.id,
      action:"fulfilled", details:{ notification_id:email.id } });
    return reply({ ok:true,request_id:row.id,status:"fulfilled" });
  } catch {
    return reply({ error:"Identity deleted but completion notification failed. IT must retry notification and reconcile request status." },503);
  }
}
