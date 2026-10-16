import { NextResponse } from "next/server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
function response(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
async function requireSuperUser() {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  return profile?.id && profile.role === "it_super_user" ? profile.id : null;
}
/** Queue is restricted to existing IT Super Users. No destructive actions are exposed. */
export async function GET() {
  const actor = await requireSuperUser();
  if (!actor) return response({ error: "Access denied." }, 403);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("partner_account_deletion_requests")
    .select("id,actor_kind,status,requested_at,updated_at,completed_at")
    .order("requested_at", { ascending: false }).limit(100);
  if (error) return response({ error: "Unable to load privacy requests." }, 503);
  return response({ requests: data ?? [] });
}
export async function PATCH(request: Request) {
  const actor = await requireSuperUser();
  if (!actor) return response({ error: "Access denied." }, 403);
  const body = await request.json().catch(() => null) as { id?: unknown; action?: unknown; note?: unknown } | null;
  if (!body || typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) {
    return response({ error: "Invalid request ID." }, 400);
  }
  // Fulfillment is deliberately unavailable until an audited identity/retention deletion service exists.
  if (body.action !== "start_review" && body.action !== "decline") {
    return response({ error: "Unsupported administrative action." }, 400);
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (body.action === "decline" && (note.length < 10 || note.length > 500)) {
    return response({ error: "A 10–500 character explanation is required." }, 400);
  }
  const admin = createSupabaseAdminClient();
  const nextStatus = body.action === "start_review" ? "under_review" : "declined";
  const { data, error } = await admin.from("partner_account_deletion_requests")
    .update({ status: nextStatus, updated_at: new Date().toISOString(),
      ...(body.action === "decline" ? { resolution_note: note } : {}) })
    .eq("id", body.id).eq("status", body.action === "start_review" ? "requested" : "under_review")
    .select("id,status,updated_at").maybeSingle();
  if (error) return response({ error: "Unable to update deletion request." }, 503);
  if (!data) return response({ error: "Request has changed status. Refresh before proceeding." }, 409);
  return response({ request: data });
}
