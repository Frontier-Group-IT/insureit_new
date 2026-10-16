import { NextResponse } from "next/server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function respond(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}
/**
 * Read-only preflight. Never delete or detach a login in this handler.
 * Relevant business/auth linkages must be manually reviewed before fulfillment.
 */
export async function GET(request: Request) {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || profile.role !== "it_super_user") return respond({ error: "Access denied." }, 403);
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !uuid.test(id)) return respond({ error: "Valid request ID required." }, 400);

  const admin = createSupabaseAdminClient();
  const { data: item, error } = await admin.from("partner_account_deletion_requests")
    .select("id,auth_user_id,actor_kind,actor_id,intermediary_id,status,requested_at")
    .eq("id", id).maybeSingle();
  if (error || !item) return respond({ error: "Request not found." }, 404);
  // Existing admin_hard_delete_blockers is intentionally used as an observation, never an authorization to delete.
  const { data: blockers, error: blockerError } = await admin.rpc("admin_hard_delete_blockers", {
    p_target_table: "profiles",
    p_target_id: item.auth_user_id,
  });
  if (blockerError) return respond({ error: "Unable to complete dependency review." }, 503);
  const [{ data: portal, error: portalError }, { data: associate, error: associateError }, { data: employee, error: employeeError }, { data: groupAssociate, error: groupError }, { count: learningCount, error: learningError }] = await Promise.all([
    admin.from("intermediary_portal_accounts").select("id,status,intermediary_id").eq("auth_user_id", item.auth_user_id),
    admin.from("partner_portal_associate_accounts").select("id,status,intermediary_id").eq("auth_user_id", item.auth_user_id),
    admin.from("profiles").select("id,role,employee_id,is_active").eq("id", item.auth_user_id),
    admin.from("group_portal_associate_accounts").select("id").eq("auth_user_id", item.auth_user_id),
    admin.from("partner_learning_attempts").select("id", { count: "exact", head: true }).eq("auth_user_id", item.auth_user_id),
  ]);
  if (portalError || associateError || employeeError || groupError || learningError) return respond({ error: "Unable to complete identity review." }, 503);
  return respond({
    request: { id: item.id, status: item.status, actor_kind: item.actor_kind },
    preflight_only: true,
    safe_to_auto_delete: false,
    profile_dependencies: blockers ?? [],
    partner_portal_accounts: portal ?? [],
    associate_accounts: associate ?? [],
    group_associate_account_count: groupAssociate?.length ?? 0,
    learning_attempt_count: learningCount ?? 0,
    auth_delete_cascade_risks: ["profiles", "partner_portal_associate_accounts", "group_portal_associate_accounts", "partner_learning_attempts"],
    profile: employee?.[0] ?? null,
    required_checks: [
      "Verify identity and any shared Operations/employee login.",
      "Review Auth delete cascading relationships: profiles, partner/group associates and learning attempts.",
      "Review foreign-key dependencies and legally retained records.",
      "Confirm retention, anonymization and profile/photo cleanup.",
      "Disable login and revoke tokens through separately approved fulfillment procedure.",
      "Confirm requester notification before closing request.",
    ],
  });
}
