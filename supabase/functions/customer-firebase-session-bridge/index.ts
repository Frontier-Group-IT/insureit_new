import { cert, getApps, initializeApp } from "npm:firebase-admin@13.5.0/app";
import { getAuth } from "npm:firebase-admin@13.5.0/auth";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { checkCustomerSessionEligibility, checkVerifiedFirebaseCustomerForSession, FIREBASE_CUSTOMER_PROJECT } from "../_shared/customer-firebase-session-policy.mjs";
import { issueExistingCustomerSessionChallenge } from "../_shared/customer-firebase-session-challenge.mjs";
import { checkCustomerFirebaseCanary } from "../_shared/customer-firebase-canary-gate.mjs";
import { provisionDisposableFirebaseCanaryAlias } from "../_shared/customer-firebase-canary-provision.mjs";

/**
 * UNDEPLOYED PHASE-2 CANDIDATE: Firebase SMS OTP -> native Supabase Auth session.
 *
 * NOT a Firebase data API authorization layer. This endpoint is deliberately
 * INOPERABLE for existing phone-only Customer Auth users until an approved,
 * UUID-preserving session identity method is verified.
 *
 * The Firebase Admin SDK checks signature, expiry, revocation, project,
 * SMS provider and recent auth_time. The returned token_hash is generated
 * by Supabase Auth itself and only for an existing verified email identity
 * belonging to the exact approved preexisting Customer Auth UUID.
 *
 * Deployment requires verify_jwt=false at Edge gateway because input JWT is
 * Firebase-signed; NEVER relax the in-function Admin verification.
 */
const PROJECT = FIREBASE_CUSTOMER_PROJECT;
const MAX_TOKEN = 16_384;
const response = (status: number, code: string, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify({ code, ...extra }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, private",
      pragma: "no-cache",
      "x-content-type-options": "nosniff",
    },
  });

function firebaseVerifier() {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Firebase verifier missing");
  const creds = JSON.parse(raw);
  if (creds.project_id !== PROJECT || !creds.client_email || !creds.private_key) {
    throw new Error("Invalid Firebase verifier project");
  }
  const appName = "insureit-customer-session-exchange";
  const app = getApps().find((candidate) => candidate.name === appName) ??
    initializeApp({ credential: cert(creds), projectId: PROJECT }, appName);
  return getAuth(app);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return response(405, "method_not_allowed");
  // The global bridge remains disabled. Only exact owner-authorized disposable
  // Customer identities may pass the later server-verified canary gate.
  // No user-selectable profile UUID, email or phone in the payload.
  const bearer = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  if (!bearer || bearer[1].length > MAX_TOKEN) return response(401, "invalid_token");

  try {
    const decoded = await firebaseVerifier().verifyIdToken(bearer[1], true);
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Reject wrong-project and long-lived tokens before using the service key.
    if (decoded.aud !== PROJECT ||
      decoded.iss !== `https://securetoken.google.com/${PROJECT}` ||
      decoded.firebase?.sign_in_provider !== "phone" ||
      typeof decoded.phone_number !== "string" ||
      !/^\+91[6-9]\d{9}$/.test(decoded.phone_number) ||
      typeof decoded.auth_time !== "number" ||
      decoded.auth_time > nowSeconds + 30 ||
      nowSeconds - decoded.auth_time > 300) {
      return response(401, "invalid_phone_identity");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Backend not configured");

    // The privileged key never leaves the server. Every candidate is
    // restricted through the existing approved immutable Firebase UID link.
    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: links, error: linksError } = await db
      .from("customer_firebase_identity_links")
      .select("firebase_project_id,firebase_uid,profile_id,verified_phone_at_approval,is_approved,is_active")
      .eq("firebase_project_id", PROJECT)
      .eq("firebase_uid", decoded.uid)
      .limit(2);

    if (linksError) throw new Error("Identity link lookup failed");
    if (!links || links.length !== 1) return response(403, "customer_identity_unavailable");

    const [profileResult, authResult] = await Promise.all([
      db.from("profiles")
        .select("id,phone,role,is_active")
        .eq("id", links[0].profile_id)
        .maybeSingle(),
      db.auth.admin.getUserById(links[0].profile_id),
    ]);
    if (profileResult.error || authResult.error) {
      throw new Error("Customer authentication lookup failed");
    }
    // Deny everyone outside the two owner-approved canonical Customer UUIDs.
    // Staff sharing either mobile number are NEVER eligible.
    if (!checkCustomerFirebaseCanary({
      profile: profileResult.data,
      authUser: authResult.data.user,
      link: links[0],
      phone: decoded.phone_number,
    }).ok) return response(403, "outside_approved_canary");

    // Global rollout stays disabled even if a stale deployment flag is true.
    // Only the two exact Customer UUIDs are eligible for this canary.
    // 1. Verify the canonical identity *independently* of any Auth email.
    const originalPrincipal = {
      firebase: decoded,
      link: links[0],
      profile: profileResult.data,
      authUser: authResult.data.user,
      nowSeconds,
    };
    const verified = checkVerifiedFirebaseCustomerForSession(originalPrincipal);
    if (!verified.ok) return response(403, verified.reason);

    // 3. Existing phone-only Customers may receive the deterministic
    // non-deliverable alias on the SAME original Auth user UUID. This is
    // explicitly disabled in every environment unless separately approved.
    const provision = await provisionDisposableFirebaseCanaryAlias({
      db,
      profile: profileResult.data,
      authUser: authResult.data.user,
      link: links[0],
      verifiedPhone: decoded.phone_number,
      explicitCanaryApproval: true,
    });
    if (!provision.ok) {
      // Only fixed internal denial reasons; never log phone, UID, email, OTP or token.
      console.warn("customer-firebase-canary-provision-denied", provision.reason);
      return response(409, "session_identity_not_provisioned");
    }

    // Consume the signed phone event only AFTER a verified pre-existing Auth
    // identity is ready, so failed first-time provisioning does not burn the
    // whole SMS event. Replay remains blocked before challenge issuance.
    // Atomically consume this recent Firebase sign-in event before any challenge. A refreshed Firebase ID
    // token retains auth_time, so event replay must fail even after cooldown.
    // Missing DB migration = deny, not bypass.
    const limit = await db.rpc("customer_firebase_session_exchange_consume", {
      p_firebase_uid: decoded.uid,
      p_auth_time: decoded.auth_time,
      p_interval_seconds: 120,
    });
    if (limit.error) throw new Error("Session issuance limit unavailable");
    if (limit.data !== true) return response(429, "too_many_attempts");



    // 4. Demand the strict Auth-email policy again with the persisted state.
    const gate = checkCustomerSessionEligibility({
      ...originalPrincipal,
      authUser: provision.authUser,
    });
    if (!gate.ok) return response(403, "customer_identity_unavailable");

    // Supabase Auth, NOT Firebase, issues the legitimate one-time sign-in
    // challenge. Email MUST preexist on this exact Auth UUID. generateLink
    // can create a new user for unknown emails, therefore NEVER accept a
    // client-provided email and NEVER call for an unprovisioned identity.
    const challenge = await issueExistingCustomerSessionChallenge(db, gate);
    if (!challenge.ok) {
      console.warn("customer-firebase-challenge-denied", challenge.reason);
      return response(503, "session_challenge_unavailable");
    }
    // Client exchanges the one-use challenge with Supabase Auth, verifies
    // getUser() and the canonical active Customer profile before using data.
    return response(200, "exchange_ready", {
      token_hash: challenge.token_hash,
      profile_id: challenge.profile_id,
    });
  } catch (error) {
    // Only exception class, never raw SMS, token hash, phone or token.
    console.error("customer-firebase-session-bridge failed",
      error instanceof Error ? error.name : "unknown");
    return response(503, "session_bridge_unavailable");
  }
});
