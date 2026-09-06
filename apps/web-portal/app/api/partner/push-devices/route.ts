import { NextResponse } from "next/server";

import { createSupabaseWithAccessToken } from "@/lib/auth";
import { getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const EXPECTED_PROJECT_ID = "8ade82c1-4c96-4f09-b90b-802270fb406d";
const EXPECTED_APP_VERSION = "0.2.0";
const MAX_TOKEN_LENGTH = 512;

type PartnerIdentity =
  | { actor_kind: "employee"; profile_id: string }
  | { actor_kind: "intermediary"; portal_account_id: string; intermediary_id: string };

type RegisterBody = {
  action: "register";
  expo_push_token: string;
  platform: "android" | "ios";
  project_id: string;
  app_version: string;
};

type UnregisterBody = {
  action: "unregister";
  expo_push_token: string;
};

type RequestBody = RegisterBody | UnregisterBody;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  if (body.action === "register") return registerDevice(auth.identity, body);
  if (body.action === "unregister") return unregisterDevice(auth.identity, body);
  return json({ ok: false, error: "Unsupported request." }, 400);
}

async function registerDevice(identity: PartnerIdentity, body: RegisterBody) {
  const token = cleanToken(body.expo_push_token);
  if (!token) return json({ ok: false, error: "Invalid push token." }, 400);
  if (body.platform !== "android" && body.platform !== "ios") {
    return json({ ok: false, error: "Unsupported device platform." }, 400);
  }
  if (body.project_id !== EXPECTED_PROJECT_ID || body.app_version !== EXPECTED_APP_VERSION) {
    return json({ ok: false, error: "This Partner app build is not eligible for push registration." }, 409);
  }

  const actor = actorColumns(identity);
  const now = new Date().toISOString();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("partner_push_devices").upsert({
    expo_push_token: token,
    platform: body.platform,
    ...actor,
    eas_project_id: EXPECTED_PROJECT_ID,
    app_version: EXPECTED_APP_VERSION,
    active: true,
    last_seen_at: now,
    updated_at: now,
  }, { onConflict: "expo_push_token" });

  if (error) return json({ ok: false, error: "Push registration is temporarily unavailable." }, 503);
  return json({ ok: true, registered: true });
}

async function unregisterDevice(identity: PartnerIdentity, body: UnregisterBody) {
  const token = cleanToken(body.expo_push_token);
  if (!token) return json({ ok: false, error: "Invalid push token." }, 400);

  const actor = actorColumns(identity);
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("partner_push_devices")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("expo_push_token", token)
    .eq("actor_kind", actor.actor_kind)
    .eq("actor_id", actor.actor_id);

  if (actor.actor_kind === "intermediary" && actor.intermediary_id) {
    query = query.eq("intermediary_id", actor.intermediary_id);
  }

  await query;
  return json({ ok: true, registered: false });
}

async function authenticate(request: Request) {
  const token = bearerToken(request.headers.get("authorization")) ?? await getServerAccessToken();
  if (!token) return { ok: false as const, response: json({ ok: false, error: "Authentication required." }, 401) };

  const scoped = createSupabaseWithAccessToken(token);
  const { data: userData, error: userError } = await scoped.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false as const, response: json({ ok: false, error: "Authentication required." }, 401) };
  }

  const [{ data: identityData, error: identityError }, { data: scopeData, error: scopeError }] = await Promise.all([
    scoped.rpc("partner_app_current_identity"),
    scoped.rpc("partner_app_commercial_scope"),
  ]);
  if (identityError || scopeError || !identityData || !scopeData) {
    return { ok: false as const, response: json({ ok: false, error: "INSUREIT Partner access is unavailable." }, 403) };
  }

  return { ok: true as const, identity: identityData as PartnerIdentity };
}

function actorColumns(identity: PartnerIdentity) {
  return identity.actor_kind === "employee"
    ? { actor_kind: "employee" as const, actor_id: identity.profile_id, intermediary_id: null }
    : { actor_kind: "intermediary" as const, actor_id: identity.portal_account_id, intermediary_id: identity.intermediary_id };
}

function cleanToken(value: unknown) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  if (!/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token)) return null;
  return token;
}

function bearerToken(header: string | null) {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}
