import { NextResponse } from "next/server";

import { createSupabaseWithAccessToken } from "@/lib/auth";
import { accessTokenCookie, refreshTokenCookie, sessionRoleCookie } from "@/lib/auth-config";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  BRIDGE_INTENT_COOKIE, bridgeCodeHash, bridgeCookieOptions, openBridgePayload,
  responseNoCache, sealBridgePayload, type BridgeIntent, type BridgeSession,
} from "@/lib/partner-intake-web-bridge";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin) {
    return responseNoCache(NextResponse.json({ ok: false, error: "Invalid handoff origin." }, { status: 403 }));
  }
  const fail = (status: number) => responseNoCache(NextResponse.json({
    ok: false, error: "This secure handoff expired or was already used. Return to the Partner App and try again.",
  }, { status }));

  let input: { code?: string };
  try { input = await request.json() as typeof input; }
  catch { return fail(400); }
  let code_hash: string;
  try { code_hash = await bridgeCodeHash(input.code ?? ""); }
  catch { return fail(400); }

  const admin = createSupabaseAdminClient();
  // Atomic DELETE RETURNING: two browsers cannot redeem the same handoff.
  const { data: ticket, error } = await admin.from("partner_policy_intake_web_handoff_tickets")
    .delete().eq("code_hash", code_hash).gt("expires_at", new Date().toISOString())
    .select("intake_id,auth_user_id,expected_reviewer_id,take_over,sealed_session").maybeSingle<{
      intake_id: string; auth_user_id: string; expected_reviewer_id: string | null; take_over: boolean; sealed_session: string;
    }>();
  if (error || !ticket) return fail(410);

  let session: BridgeSession;
  try { session = await openBridgePayload<BridgeSession>(ticket.sealed_session); }
  catch { return fail(410); }
  if (session.user_id !== ticket.auth_user_id || session.expires_at < Date.now()) return fail(410);
  const supabase = createSupabaseWithAccessToken(session.access_token);
  const { data: { user }, error: userError } = await supabase.auth.getUser(session.access_token);
  if (userError || !user || user.id !== ticket.auth_user_id) return fail(401);
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("role,is_active").eq("id", user.id)
    .maybeSingle<{ role: string; is_active: boolean }>();
  if (profileError || !profile?.is_active || profile.role === "customer") return fail(403);

  const intent: BridgeIntent = {
    intake_id: ticket.intake_id, user_id: ticket.auth_user_id,
    expected_reviewer_id: ticket.expected_reviewer_id, take_over: ticket.take_over,
    expires_at: Date.now() + 60_000,
  };
  const response = responseNoCache(NextResponse.json({ ok: true }, { status: 200 }));
  response.cookies.set(accessTokenCookie, session.access_token, { ...bridgeCookieOptions, maxAge: 3600 });
  response.cookies.set(refreshTokenCookie, session.refresh_token, { ...bridgeCookieOptions, maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set(sessionRoleCookie, profile.role, { ...bridgeCookieOptions, maxAge: 3600 });
  response.cookies.set(BRIDGE_INTENT_COOKIE, await sealBridgePayload(intent), {
    ...bridgeCookieOptions, maxAge: 60,
  });
  return response;
}
