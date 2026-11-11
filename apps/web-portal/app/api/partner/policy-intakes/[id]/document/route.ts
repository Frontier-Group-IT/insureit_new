import { NextResponse } from "next/server";

import { createSupabaseWithAccessToken } from "@/lib/auth";
import { getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPartnerEmployeeIntakeReadScope } from "@/lib/partner-policy-intake-read-access";

type PartnerIdentity =
  | { actor_kind: "employee"; profile_id: string }
  | { actor_kind: "intermediary"; portal_account_id: string | null; intermediary_id: string | null; profile_id?: string; auth_user_id?: string; portal_account_source?: "associate"; portal_access_type?: "group" | "branch"; portal_access_entity_id?: string };

function intakeOwner(identity: PartnerIdentity) {
  if (identity.actor_kind === "employee") return { field: "submitted_by_profile_id", id: identity.profile_id };
  if (identity.portal_access_type === "branch" || identity.portal_access_type === "group") {
    return { field: "submitted_by_profile_id", id: identity.profile_id || identity.auth_user_id || "" };
  }
  if (identity.portal_account_source === "associate" &&
      identity.profile_id && identity.profile_id === identity.auth_user_id) {
    return { field: "submitted_by_profile_id", id: identity.profile_id };
  }
  return { field: "submitted_by_portal_account_id", id: identity.portal_account_id || "" };
}

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const bearer = request.headers.get("authorization");
  const token = bearer?.match(/^Bearer\s+(.+)$/i)?.[1] ?? await getServerAccessToken();
  if (!token) return json({ ok: false, error: "Authentication required." }, 401);

  const scoped = createSupabaseWithAccessToken(token);
  const { data: userData, error: userError } = await scoped.auth.getUser(token);
  if (userError || !userData.user) return json({ ok: false, error: "Authentication required." }, 401);

  const [{ data: identityData, error: identityError }, { data: scopeData, error: scopeError }] = await Promise.all([
    scoped.rpc("partner_app_current_identity"),
    scoped.rpc("partner_app_commercial_scope"),
  ]);
  if (identityError || scopeError || !identityData || !scopeData) return json({ ok: false, error: "INSUREIT Partner access is unavailable." }, 403);

  const identity = identityData as PartnerIdentity;
  const scope = scopeData as { intermediary_ids?: string[] };
  const { id } = await params;
  const owner = intakeOwner(identity);
  const employeeRead = identity.actor_kind === "employee"
    ? await getPartnerEmployeeIntakeReadScope(identity)
    : null;
  if (employeeRead?.mode === "none") return json({ ok: false, error: "Partner account access is unavailable." }, 403);
  // The intake list/detail API allows authorized lead-source reads as well as
  // the submitter. Use that same scope when issuing a short-lived document URL.
  const sourceIds = identity.actor_kind === "intermediary" && !identity.portal_access_type
    ? [identity.intermediary_id].filter((value): value is string => Boolean(value))
    : (scope.intermediary_ids ?? []);
  const predicates = [
    ...(sourceIds.length ? [`lead_source_id.in.(${sourceIds.join(",")})`] : []),
    ...(owner.field === "submitted_by_profile_id" && owner.id ? [`submitted_by_profile_id.eq.${owner.id}`] : []),
    ...(owner.field === "submitted_by_portal_account_id" && owner.id ? [`submitted_by_portal_account_id.eq.${owner.id}`] : []),
  ];
  if (!employeeRead && !predicates.length) return json({ ok: false, error: "Partner account access is unavailable." }, 403);
  const admin = createSupabaseAdminClient();

  let query = admin
    .from("policy_intake_requests")
    .select("storage_bucket,storage_path")
    .eq("id", id);

  if (employeeRead?.mode === "or") query = query.or(employeeRead.predicates);
  else if (employeeRead?.mode === "submitter") query = query.eq("submitted_by_profile_id",employeeRead.profileId);
  else if (!employeeRead) query = query.or(predicates.join(","));

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
