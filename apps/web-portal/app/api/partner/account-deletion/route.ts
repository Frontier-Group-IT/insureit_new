import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
type Identity = { actor_kind: "employee"; profile_id: string } |
  { actor_kind: "intermediary"; portal_account_id: string; intermediary_id: string };
function reply(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
async function identityFrom(request: Request) {
  // Bearer-only: reject ambient cookies to prevent cross-site request forgery.
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return null;
  const client = createSupabaseWithAccessToken(token);
  const { data: user, error } = await client.auth.getUser(token);
  if (error || !user.user) return null;
  const { data: identity, error: identityError } = await client.rpc("partner_app_current_identity");
  if (identityError || !identity) return null;
  if (identity.actor_kind !== "employee" && identity.actor_kind !== "intermediary") return null;
  return { userId: user.user.id, identity: identity as Identity };
}
export async function GET(request: Request) {
  const auth = await identityFrom(request);
  if (!auth) return reply({ error: "Authorized Partner login required." }, 401);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("partner_account_deletion_requests")
    .select("id,status,requested_at,completed_at")
    .eq("auth_user_id", auth.userId).order("requested_at", { ascending: false }).limit(1);
  if (error) return reply({ error: "Unable to load request status." }, 503);
  return reply({ request: data?.[0] ?? null });
}
export async function POST(request: Request) {
  const auth = await identityFrom(request);
  if (!auth) return reply({ error: "Authorized Partner login required." }, 401);
  let input: unknown;
  try { input = await request.json(); } catch { return reply({ error: "Invalid request." }, 400); }
  if (!input || typeof input !== "object" || (input as { confirmation?: unknown }).confirmation !== "DELETE MY ACCOUNT") {
    return reply({ error: "Explicit account deletion confirmation required." }, 400);
  }
  const identity = auth.identity;
  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin.from("partner_account_deletion_requests")
    .select("id,status,requested_at").eq("auth_user_id", auth.userId)
    .in("status", ["requested","under_review","fulfilling"]).limit(1);
  if (existingError) return reply({ error: "Unable to verify existing requests." }, 503);
  if (existing?.length) return reply({ request: existing[0], already_requested: true });
  const { data, error } = await admin.from("partner_account_deletion_requests").insert({
    auth_user_id: auth.userId,
    actor_kind: identity.actor_kind,
    actor_id: identity.actor_kind === "employee" ? identity.profile_id : identity.portal_account_id,
    intermediary_id: identity.actor_kind === "intermediary" ? identity.intermediary_id : null,
  }).select("id,status,requested_at").single();
  if (error?.code === "23505") return reply({ error: "An account deletion request is already pending. Refresh to view its status." }, 409);
  if (error || !data) return reply({ error: "Unable to record account deletion request." }, 503);
  return reply({ request: data }, 201);
}
