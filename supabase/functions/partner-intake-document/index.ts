// Read-only Partner Policy Intake document service.
// Migration staging: DO NOT connect the app until employee hierarchy read parity
// and authenticated role-based UAT are complete. No unsigned/public Storage URLs.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return json({ ok: false, error: "Authentication required." }, 401);
  let input: { id?: unknown };
  try { input = await request.json(); }
  catch { return json({ ok: false, error: "Invalid request." }, 400); }
  if (typeof input.id !== "string" || !uuid.test(input.id))
    return json({ ok: false, error: "Invalid Policy Intake reference." }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !secret)
    return json({ ok: false, error: "Policy document service unavailable." }, 503);
  const scoped = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user, error: userError } = await scoped.auth.getUser(token);
  if (userError || !user.user)
    return json({ ok: false, error: "Session expired." }, 401);
  const [{ data: identity, error: identityError }, { data: scope, error: scopeError }] = await Promise.all([
    scoped.rpc("partner_app_current_identity"),
    scoped.rpc("partner_app_commercial_scope"),
  ]);
  if (identityError || scopeError)
    return json({ ok: false, error: "Partner access temporarily unavailable." }, 503);
  if (!identity || !scope || identity.auth_user_id !== user.user.id ||
      identity.actor_kind !== scope.actor_kind ||
      !["employee", "intermediary"].includes(identity.actor_kind))
    return json({ ok: false, error: "Partner account access unavailable." }, 403);

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // This staged endpoint supports submitters, authorized intermediary
  // lead-source scope, and active assigned in-review employee reviewers.
  // Wider employee organization, RM hierarchy and Operations Head visibility
  // remain intentionally unsupported until canonical read-scope parity is proven
  // BEFORE this replaces the mobile API.
  // Never infer global read access from a capability or client-provided ID.
  let ownerField: "submitted_by_profile_id" | "submitted_by_portal_account_id";
  let ownerId: string | null = null;
  let canReadAssignedReview = false;
  let sourceIds: string[] = [];
  if (identity.actor_kind === "employee") {
    const { data: grants, error: grantsError } = await scoped.rpc("partner_app_effective_permissions");
    if (grantsError) return json({ ok: false, error: "Intake permissions unavailable." }, 503);
    const capabilities = grants?.capabilities ?? {};
    if (!["view", "edit", "approve"].includes(capabilities.view_policy_intakes) &&
        !["edit", "approve"].includes(capabilities.review_policy_intakes) &&
        capabilities.finalize_policy_intakes !== "approve")
      return json({ ok: false, error: "Intake access unavailable." }, 403);
    if (identity.profile_id !== user.user.id)
      return json({ ok: false, error: "Account identity unavailable." }, 403);
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id,is_active").eq("id", identity.profile_id).maybeSingle();
    if (profileError) return json({ ok: false, error: "Employee profile temporarily unavailable." }, 503);
    if (!profile || profile.is_active !== true)
      return json({ ok: false, error: "Employee account unavailable." }, 403);
    ownerField = "submitted_by_profile_id";
    ownerId = identity.profile_id;
    canReadAssignedReview = ["edit", "approve"].includes(capabilities.review_policy_intakes) ||
      capabilities.finalize_policy_intakes === "approve";
  } else {
    // Match the canonical website document route: ordinary intermediary
    // accounts see their own lead source, while branch/group accounts use
    // only intermediary IDs from the authenticated commercial-scope RPC.
    // Validate identifiers before placing them in PostgREST OR predicates.
    const scopedIds = identity.portal_access_type
      ? (scope.intermediary_ids ?? [])
      : [identity.intermediary_id].filter((id: unknown) => id !== null && id !== undefined);
    if (!Array.isArray(scopedIds) || scopedIds.some((id: unknown) =>
      typeof id !== "string" || !uuid.test(id)))
      return json({ ok: false, error: "Lead-source scope unavailable." }, 503);
    sourceIds = [...new Set(scopedIds)];
    if (identity.portal_access_type === "branch" || identity.portal_access_type === "group") {
      ownerField = "submitted_by_profile_id";
      ownerId = identity.profile_id || identity.auth_user_id || null;
    } else if (identity.portal_account_source === "associate" &&
               identity.profile_id === identity.auth_user_id) {
      ownerField = "submitted_by_profile_id";
      ownerId = identity.profile_id;
    } else {
      ownerField = "submitted_by_portal_account_id";
      ownerId = identity.portal_account_id || null;
    }
  }
  // Identity and scope values must be server-verified UUIDs before they are
  // interpolated into a PostgREST expression. The client controls only id.
  if (ownerId && !uuid.test(ownerId))
    return json({ ok: false, error: "Partner identity unavailable." }, 403);
  const predicates: string[] = [];
  if (ownerId) predicates.push(`${ownerField}.eq.${ownerId}`);
  if (identity.actor_kind === "employee" && canReadAssignedReview && ownerId) {
    predicates.push(`and(assigned_to_profile_id.eq.${ownerId},status.eq.in_review)`);
  }
  if (identity.actor_kind === "intermediary" && sourceIds.length) {
    predicates.push(`lead_source_id.in.(${sourceIds.join(",")})`);
  }
  if (!predicates.length) return json({ ok: false, error: "Partner access unavailable." }, 403);
  let intakeQuery = admin.from("policy_intake_requests")
    .select("storage_bucket,storage_path").eq("id", input.id)
    .or(predicates.join(","));
  const { data: intake, error: intakeError } = await intakeQuery.maybeSingle();
  if (intakeError) return json({ ok: false, error: "Policy document lookup unavailable." }, 503);
  if (!intake) return json({ ok: false, error: "Policy Intake not available to this account." }, 404);
  if (typeof intake.storage_bucket !== "string" || !intake.storage_bucket ||
      typeof intake.storage_path !== "string" || !intake.storage_path)
    return json({ ok: false, error: "Policy copy unavailable." }, 404);
  const { data: signed, error: signedError } = await admin.storage
    .from(intake.storage_bucket).createSignedUrl(intake.storage_path, 300);
  if (signedError || !signed?.signedUrl)
    return json({ ok: false, error: "Could not open policy copy." }, 503);
  return json({ ok: true, url: signed.signedUrl });
});
