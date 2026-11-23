// Authenticated Expo push-token registration without any Vercel dependency.
// Queue storage is service-role-only; the caller's Supabase JWT establishes actor scope.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const PROJECT_ID = "8ade82c1-4c96-4f09-b90b-802270fb406d";
const APP_VERSION = "0.2.0";
const response = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), { status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
type Identity = {
  actor_kind: "employee" | "intermediary";
  auth_user_id: string;
  profile_id?: string;
  portal_account_id?: string;
  intermediary_id?: string | null;
};
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response({ ok: false, error: "Method not allowed." }, 405);
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!bearer) return response({ ok: false, error: "Authentication required." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !secret) return response({ ok: false, error: "Push registration unavailable." }, 503);
  const client = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await client.auth.getUser(bearer);
  if (userError || !userData.user) return response({ ok: false, error: "Session expired." }, 401);
  const [{ data: identityValue, error: identityError }, { data: scope, error: scopeError }] = await Promise.all([
    client.rpc("partner_app_current_identity"), client.rpc("partner_app_commercial_scope"),
  ]);
  if (identityError || scopeError) return response({ ok: false, error: "Partner identity temporarily unavailable." }, 503);
  const identity = identityValue as Identity | null;
  if (!identity || !scope || identity.auth_user_id !== userData.user.id ||
      identity.actor_kind !== scope.actor_kind ||
      (identity.actor_kind !== "employee" && identity.actor_kind !== "intermediary")) {
    return response({ ok: false, error: "Partner access unavailable." }, 403);
  }
  const actorId = identity.actor_kind === "employee" ? identity.profile_id : identity.portal_account_id;
  if (!actorId || (identity.actor_kind === "intermediary" && !identity.intermediary_id)) {
    return response({ ok: false, error: "Partner account identity incomplete." }, 403);
  }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return response({ ok: false, error: "Invalid request." }, 400); }
  const token = typeof body.expo_push_token === "string" ? body.expo_push_token.trim() : "";
  if (token.length > 512 || !/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token)) {
    return response({ ok: false, error: "Invalid Expo push token." }, 400);
  }
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const actor = { actor_kind: identity.actor_kind, actor_id: actorId,
    intermediary_id: identity.actor_kind === "intermediary" ? identity.intermediary_id : null };
  if (body.action === "register") {
    if (body.platform !== "android" && body.platform !== "ios") {
      return response({ ok: false, error: "Unsupported platform." }, 400);
    }
    if (body.project_id !== PROJECT_ID || body.app_version !== APP_VERSION) {
      return response({ ok: false, error: "Partner build is not eligible for push registration." }, 409);
    }
    const now = new Date().toISOString();
    const { error } = await admin.from("partner_push_devices").upsert({
      expo_push_token: token, platform: body.platform, ...actor,
      eas_project_id: PROJECT_ID, app_version: APP_VERSION,
      active: true, last_seen_at: now, updated_at: now,
    }, { onConflict: "expo_push_token" });
    if (error) return response({ ok: false, error: "Push registration temporarily unavailable." }, 503);
    return response({ ok: true, registered: true });
  }
  if (body.action === "unregister") {
    const { error } = await admin.from("partner_push_devices")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("expo_push_token", token).eq("actor_kind", actor.actor_kind).eq("actor_id", actor.actor_id);
    if (error) return response({ ok: false, error: "Push unregistration temporarily unavailable." }, 503);
    return response({ ok: true, registered: false });
  }
  return response({ ok: false, error: "Unsupported request." }, 400);
});
