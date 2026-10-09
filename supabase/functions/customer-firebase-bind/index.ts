import { cert, getApps, initializeApp } from "npm:firebase-admin@13.5.0/app";
import { getAuth } from "npm:firebase-admin@13.5.0/auth";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/**
 * Firebase phone -> canonical preexisting INSUREIT profile.
 *
 * External Firebase JWTs cannot be checked by Supabase Edge's legacy JWT
 * gateway: verify_jwt=false is mandatory, and every request below must
 * pass Admin SDK verification (signature, expiration, revocation).
 *
 * Never accepts profile UUID, approval, role, phone number or project ID
 * from request JSON. No elevated key leaves this server environment.
 */
const PROJECT = "insureit-customer-auth";
const ISSUER = `https://securetoken.google.com/${PROJECT}`;
const PHONE = /^\+91[6-9]\d{9}$/;
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function trustedAuth() {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Firebase Admin credentials not configured");
  const credentials = JSON.parse(raw);
  if (credentials.project_id !== PROJECT || !credentials.client_email || !credentials.private_key) {
    throw new Error("Firebase Admin credentials invalid");
  }
  const app = getApps().find((app) => app.name === "insureit-customer-phone-binding") ??
    initializeApp({ credential: cert(credentials), projectId: PROJECT }, "insureit-customer-phone-binding");
  return getAuth(app);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const bearer = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  if (!bearer || bearer[1].length > 16384) return reply(401, { error: "invalid_token" });
  try {
    const firebase = trustedAuth();
    const decoded = await firebase.verifyIdToken(bearer[1], true);
    if (decoded.aud !== PROJECT || decoded.iss !== ISSUER || !decoded.uid ||
        decoded.firebase?.sign_in_provider !== "phone" ||
        typeof decoded.phone_number !== "string" || !PHONE.test(decoded.phone_number)) {
      return reply(401, { error: "invalid_identity" });
    }
    const now = Math.floor(Date.now() / 1000);
    // Fresh phone reauthentication required for account enrollment.
    if (typeof decoded.auth_time !== "number" || decoded.auth_time > now + 30 ||
        now - decoded.auth_time > 300) {
      return reply(401, { error: "reauthentication_required" });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Backend Supabase credentials missing");
    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Fetch only the minimal profile fields; do not expose phone lists to callers.
    // Only 19 active customer profiles at previous read-only audit.
    const { data: profiles, error: profilesError } = await db
      .from("profiles").select("id,phone,role,is_active")
      .eq("role", "customer").eq("is_active", true);
    if (profilesError || !Array.isArray(profiles)) throw new Error("Profile lookup failed");
    const matches = profiles.filter((p) => p.phone === decoded.phone_number);
    if (matches.length !== 1) return reply(409, { error: "customer_requires_review" });
    const profileId = matches[0].id as string;
    const [uidLinks, profileLinks] = await Promise.all([
      db.from("customer_firebase_identity_links")
        .select("firebase_uid,profile_id,verified_phone_at_approval,is_approved,is_active")
        .eq("firebase_project_id", PROJECT).eq("firebase_uid", decoded.uid),
      db.from("customer_firebase_identity_links")
        .select("firebase_uid,profile_id,verified_phone_at_approval,is_approved,is_active")
        .eq("profile_id", profileId),
    ]);
    if (uidLinks.error || profileLinks.error || !Array.isArray(uidLinks.data) ||
        !Array.isArray(profileLinks.data)) throw new Error("Mapping lookup failed");
    const existing = [...uidLinks.data, ...profileLinks.data.filter(
      (l) => !uidLinks.data!.some((one) => one.firebase_uid === l.firebase_uid)
    )];
    if (existing.some((l) => l.profile_id !== profileId ||
          l.firebase_uid !== decoded.uid ||
          l.verified_phone_at_approval !== decoded.phone_number)) {
      return reply(409, { error: "identity_conflict" });
    }
    // Never activate an unapproved/disabled mapping.
    if (existing.some((l) => !l.is_approved || !l.is_active)) {
      return reply(409, { error: "identity_requires_approval" });
    }
    if (existing.length === 0) {
      const { error: insertError } = await db.from("customer_firebase_identity_links")
        .insert({
          firebase_project_id: PROJECT, firebase_uid: decoded.uid,
          profile_id: profileId,
          verified_phone_at_approval: decoded.phone_number,
          is_approved: true, is_active: true,
          approved_at: new Date().toISOString(),
        });
      if (insertError) return reply(409, { error: "customer_requires_review" });
    }
    // Only grant the Firebase authenticated role AFTER the protected database
    // mapping exists and is approved. Retain other Firebase custom claims.
    const user = await firebase.getUser(decoded.uid);
    await firebase.setCustomUserClaims(decoded.uid, {
      ...(user.customClaims ?? {}),
      role: "authenticated",
    });
    // Firebase client must force-refresh its ID token after role claim assignment.
    return reply(200, { status: "linked", requiresTokenRefresh: true });
  } catch (error) {
    console.error("customer-firebase-binding failed", error instanceof Error ? error.name : "unknown");
    return reply(503, { error: "verification_unavailable" });
  }
});
