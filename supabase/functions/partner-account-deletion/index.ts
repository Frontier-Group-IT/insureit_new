// Supabase Edge replacement for the former Vercel Partner account-deletion API.
// Uses caller JWT for identity and a server-side service key for the restricted queue.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
type Identity =
  | { actor_kind: "employee"; auth_user_id: string; profile_id: string }
  | { actor_kind: "intermediary"; auth_user_id: string; portal_account_id: string; intermediary_id: string | null };

Deno.serve(async (request: Request) => {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+([^\s]+)$/i.exec(authHeader)?.[1];
  if (!token) return json({ error: "Partner sign-in required." }, 401);

  const endpoint = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!endpoint || !key || !serviceRole) return json({ error: "Account service is unavailable." }, 503);
  const client = createClient(endpoint, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userInfo, error: userError } = await client.auth.getUser(token);
  if (userError || !userInfo.user) return json({ error: "Partner session expired." }, 401);
  const [{ data: identityData, error: identityError }, { data: scopeData, error: scopeError }] = await Promise.all([
    client.rpc("partner_app_current_identity"),
    client.rpc("partner_app_commercial_scope"),
  ]);
  if (identityError || scopeError) return json({ error: "Identity verification temporarily unavailable." }, 503);
  const identity = identityData as Identity | null;
  if (!identity || !scopeData || identity.auth_user_id !== userInfo.user.id ||
      !["employee", "intermediary"].includes(identity.actor_kind) ||
      scopeData.actor_kind !== identity.actor_kind) {
    return json({ error: "Partner account access is not enabled." }, 403);
  }
  const actorId = identity.actor_kind === "employee" ? identity.profile_id : identity.portal_account_id;
  if (!actorId) return json({ error: "Partner account identity is incomplete." }, 403);
  const admin = createClient(endpoint, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (request.method === "GET") {
    const { data, error } = await admin.from("partner_account_deletion_requests")
      .select("id,status,requested_at,completed_at")
      .eq("auth_user_id", userInfo.user.id)
      .order("requested_at", { ascending: false }).limit(1);
    if (error) return json({ error: "Unable to load account deletion request." }, 503);
    return json({ request: data?.[0] ?? null });
  }
  let input: unknown;
  try { input = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (!input || typeof input !== "object" ||
      (input as Record<string, unknown>).confirmation !== "DELETE MY ACCOUNT") {
    return json({ error: "Explicit account deletion confirmation required." }, 400);
  }
  const { data: pending, error: pendingError } = await admin.from("partner_account_deletion_requests")
    .select("id,status,requested_at")
    .eq("auth_user_id", userInfo.user.id)
    .in("status", ["requested","under_review","fulfilling"]).limit(1);
  if (pendingError) return json({ error: "Unable to verify existing requests." }, 503);
  if (pending?.length) return json({ request: pending[0], already_requested: true });
  const { data, error } = await admin.from("partner_account_deletion_requests").insert({
    auth_user_id: userInfo.user.id,
    actor_kind: identity.actor_kind,
    actor_id: actorId,
    intermediary_id: identity.actor_kind === "intermediary" ? identity.intermediary_id : null,
  }).select("id,status,requested_at,completed_at").single();
  if (error?.code === "23505") return json({ error: "An account deletion request is already pending." }, 409);
  if (error || !data) return json({ error: "Unable to record account deletion request." }, 503);
  return json({ request: data }, 201);
});
