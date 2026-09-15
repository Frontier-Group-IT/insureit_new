import { NextResponse } from "next/server";

import { createSupabaseWithAccessToken } from "@/lib/auth";
import { getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PartnerIdentity =
  | { actor_kind: "employee"; profile_id: string }
  | { actor_kind: "intermediary"; portal_account_id: string; intermediary_id: string };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getServerAccessToken();
  if (!token) return json({ ok: false, error: "Authentication required." }, 401);

  const scoped = createSupabaseWithAccessToken(token);
  const { data: userData, error: userError } = await scoped.auth.getUser(token);
  if (userError || !userData.user) return json({ ok: false, error: "Authentication required." }, 401);

  const { data: identityData, error: identityError } = await scoped.rpc("partner_app_current_identity");
  if (identityError || !identityData) return json({ ok: false, error: "INSUREIT Partner access is unavailable." }, 403);

  const identity = identityData as PartnerIdentity;
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  let query = admin
    .from("policy_intake_requests")
    .select("storage_bucket,storage_path")
    .eq("id", id);

  query = identity.actor_kind === "employee"
    ? query.eq("submitted_by_profile_id", identity.profile_id)
    : query.eq("submitted_by_portal_account_id", identity.portal_account_id);

  const { data: intake, error: intakeError } = await query.maybeSingle<{ storage_bucket: string; storage_path: string }>();
  if (intakeError) return json({ ok: false, error: "Policy copy could not be loaded." }, 500);
  if (!intake) return json({ ok: false, error: "This Policy Intake is not available in your Partner account." }, 404);

  const { data: signed, error: signedError } = await admin.storage
    .from(intake.storage_bucket)
    .createSignedUrl(intake.storage_path, 300);

  if (signedError || !signed?.signedUrl) return json({ ok: false, error: "Could not open the policy copy." }, 500);
  return json({ ok: true, url: signed.signedUrl });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}
