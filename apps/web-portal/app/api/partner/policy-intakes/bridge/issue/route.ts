import { NextResponse } from "next/server";

import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getPartnerEmployeeIntakeReadScope } from "@/lib/partner-policy-intake-read-access";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { bridgeCodeHash, bridgeExpiry, bridgeReady, newBridgeCode, responseNoCache, sealBridgePayload } from "@/lib/partner-intake-web-bridge";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reply(body: unknown, status: number) {
  return responseNoCache(NextResponse.json(body, { status }));
}

export async function POST(request: Request) {
  if (!bridgeReady()) return reply({ ok: false, error: "Secure onboarding handoff is not configured." }, 503);
  const token = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return reply({ ok: false, error: "Partner authentication required." }, 401);

  let body: { intake_id?: string; refresh_token?: string; take_over?: boolean; expected_reviewer_id?: string | null };
  try { body = await request.json() as typeof body; }
  catch { return reply({ ok: false, error: "Invalid onboarding request." }, 400); }
  if (!uuid.test(body.intake_id ?? "") || typeof body.refresh_token !== "string" || body.refresh_token.length < 20 ||
      typeof body.take_over !== "boolean" ||
      (body.expected_reviewer_id != null && !uuid.test(body.expected_reviewer_id))) {
    return reply({ ok: false, error: "Invalid onboarding request." }, 400);
  }

  const scoped = createSupabaseWithAccessToken(token);
  const { data: { user }, error: authError } = await scoped.auth.getUser(token);
  if (authError || !user) return reply({ ok: false, error: "Partner session expired." }, 401);
  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,role,is_active").eq("id", user.id)
    .maybeSingle<{ id: string; role: string; is_active: boolean }>();
  if (profileError || !profile?.is_active) return reply({ ok: false, error: "Operations access is unavailable." }, 403);
  const head = profile.role === "operations_head_life";
  const [review, finalize] = await Promise.all([
    head ? Promise.resolve(true) : hasEffectiveCapability(profile, "review_policy_intakes", "edit"),
    head ? Promise.resolve(true) : hasEffectiveCapability(profile, "finalize_policy_intakes", "approve"),
  ]);
  if (!review || !finalize) return reply({ ok: false, error: "Operations finalization permission is required." }, 403);

  const scope = await getPartnerEmployeeIntakeReadScope({ actor_kind: "employee", profile_id: user.id });
  if (scope.mode === "none") return reply({ ok: false, error: "This intake is outside your permitted scope." }, 403);
  let query = admin.from("policy_intake_requests")
    .select("id,status,assigned_to_profile_id,ocr_fields,intake_number,created_at").eq("id", body.intake_id as string);
  if (scope.mode === "or") query = query.or(scope.predicates);
  else if (scope.mode === "submitter") query = query.eq("submitted_by_profile_id", scope.profileId);
  const { data: intake, error: intakeError } = await query.maybeSingle();
  if (intakeError || !intake || !["in_review", "ready_for_review", "processing"].includes(intake.status)) {
    return reply({ ok: false, error: "This intake is not available for onboarding." }, 409);
  }
  const duplicates = await loadPolicyIntakeDuplicateMatches(admin, [intake]);
  if (!duplicates.ok) return reply({ ok: false, error: "Duplicate verification is unavailable." }, 503);
  if (duplicates.matches.has(intake.id)) return reply({ ok: false, error: "Duplicate intakes cannot be onboarded." }, 409);

  const conflict = Boolean(intake.assigned_to_profile_id && intake.assigned_to_profile_id !== user.id);
  if (conflict && (!body.take_over || body.expected_reviewer_id !== intake.assigned_to_profile_id)) {
    return reply({ ok: false, error: "The reviewer has changed. Refresh the intake and confirm again." }, 409);
  }
  if (!conflict && body.take_over) {
    return reply({ ok: false, error: "The reviewer assignment changed. Refresh the intake." }, 409);
  }

  const code = newBridgeCode();
  const expires_at = bridgeExpiry();
  const sealed_session = await sealBridgePayload({
    access_token: token,
    refresh_token: body.refresh_token,
    user_id: user.id,
    expires_at: Date.now() + 90_000,
  });
  const { error: insertError } = await admin.from("partner_policy_intake_web_handoff_tickets").insert({
    code_hash: await bridgeCodeHash(code),
    intake_id: intake.id,
    auth_user_id: user.id,
    expected_reviewer_id: intake.assigned_to_profile_id,
    take_over: conflict,
    sealed_session,
    expires_at,
  });
  if (insertError) return reply({ ok: false, error: "Secure onboarding handoff is unavailable." }, 503);
  return reply({ ok: true, code }, 200);
}
