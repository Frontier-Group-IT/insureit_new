import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { preparePolicyIntakeHandoff } from "@/app/policy-intakes/handoff-actions";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { accessTokenCookie } from "@/lib/auth-config";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  BRIDGE_INTENT_COOKIE, bridgeCookieOptions, openBridgePayload,
  responseNoCache, type BridgeIntent,
} from "@/lib/partner-intake-web-bridge";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin) {
    return responseNoCache(NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 }));
  }
  const store = await cookies();
  const sealed = store.get(BRIDGE_INTENT_COOKIE)?.value;
  const token = store.get(accessTokenCookie)?.value;
  const reply = (data: unknown, status: number) => {
    const response = responseNoCache(NextResponse.json(data, { status }));
    // Clear one-time intent even when the intake changed or the handoff failed.
    response.cookies.set(BRIDGE_INTENT_COOKIE, "", { ...bridgeCookieOptions, maxAge: 0 });
    return response;
  };
  if (!sealed || !token) return reply({ ok: false, error: "Secure onboarding session expired." }, 401);
  let intent: BridgeIntent;
  try { intent = await openBridgePayload<BridgeIntent>(sealed); }
  catch { return reply({ ok: false, error: "Invalid onboarding confirmation." }, 401); }
  if (intent.expires_at < Date.now()) return reply({ ok: false, error: "Onboarding confirmation expired." }, 410);
  const scoped = createSupabaseWithAccessToken(token);
  const { data: { user }, error: authError } = await scoped.auth.getUser(token);
  if (authError || !user || user.id !== intent.user_id) {
    return reply({ ok: false, error: "The Partner and website identities do not match." }, 403);
  }

  // Don't silently transfer a reviewer who changed after the user confirmed.
  const admin = createSupabaseAdminClient();
  const { data: intake, error: intakeError } = await admin.from("policy_intake_requests")
    .select("assigned_to_profile_id,status").eq("id", intent.intake_id)
    .maybeSingle<{ assigned_to_profile_id: string | null; status: string }>();
  if (intakeError || !intake || intake.assigned_to_profile_id !== intent.expected_reviewer_id) {
    return reply({ ok: false, error: "The reviewer changed. Return to the app and confirm again." }, 409);
  }
  if (!["ready_for_review", "in_review", "processing"].includes(intake.status)) {
    return reply({ ok: false, error: "This intake is no longer available for onboarding." }, 409);
  }
  try {
    // Existing action enforces finalizer/reviewer access, duplicate protection,
    // atomic assignment and draft creation/restoration. The caller has already
    // explicitly approved takeover in the Partner App when take_over=true.
    const result = await preparePolicyIntakeHandoff(intent.intake_id, intent.take_over);
    if (!result.ok) return reply({ ok: false, error: result.error }, result.conflict ? 409 : 403);
    const {data:draft}=await admin.from("policy_intake_onboarding_drafts")
      .select("draft_payload").eq("intake_id",intent.intake_id)
      .maybeSingle<{draft_payload:{businessLine?:string}}>();
    const route=draft?.draft_payload?.businessLine==="Non Motor"
      ?"/policies/new/non-motor":"/policies/new";
    return reply({ ok:true,path:`${route}?intake_id=${encodeURIComponent(intent.intake_id)}` }, 200);
  } catch {
    return reply({ ok: false, error: "Operations authorization failed. Please reopen the intake." }, 403);
  }
}
