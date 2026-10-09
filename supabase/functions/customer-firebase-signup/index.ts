import { cert, getApps, initializeApp } from "npm:firebase-admin@13.5.0/app";
import { getAuth } from "npm:firebase-admin@13.5.0/auth";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/**
 * Verified Firebase SMS registration for a truly NEW customer.
 * This does not sign in a customer, return a privileged token, or associate
 * an unverified email with Supabase Auth. The existing bind endpoint must
 * independently revalidate the Firebase token before authorizing access.
 *
 * verify_jwt=false is required for external Firebase tokens; the Firebase
 * Admin signature/revocation check below is mandatory on every request.
 */
const PROJECT = "insureit-customer-auth";
const ISSUER = `https://securetoken.google.com/${PROJECT}`;
const PHONE = /^\+91[6-9]\d{9}$/;
const canonicalIndianPhone = (value: unknown) => {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^0-9]/g, "");
  if (!/^(91)?[6-9][0-9]{9}$/.test(digits)) return null;
  return "+91" + digits.slice(-10);
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: {
    "content-type": "application/json", "cache-control": "no-store",
  } });
function trustedAuth() {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Firebase Admin not configured");
  const credentials = JSON.parse(raw);
  if (credentials.project_id !== PROJECT || !credentials.client_email || !credentials.private_key) {
    throw new Error("Firebase Admin project invalid");
  }
  const app = getApps().find((item) => item.name === "insureit-customer-phone-signup") ??
    initializeApp({ credential: cert(credentials), projectId: PROJECT }, "insureit-customer-phone-signup");
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
    if (typeof decoded.auth_time !== "number" || decoded.auth_time > now + 30 ||
        now - decoded.auth_time > 300) {
      return reply(401, { error: "reauthentication_required" });
    }

    // Only non-sensitive display metadata is accepted from the request.
    // Never accept profile ID, Firebase UID, phone or role from request JSON.
    const length = Number(request.headers.get("content-length") ?? "0");
    if (!Number.isFinite(length) || length > 2048) return reply(413, { error: "payload_too_large" });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return reply(400, { error: "invalid_signup_details" });
    }
    const record = body as Record<string, unknown>;
    if (Object.keys(record).some((key) => !["fullName", "email"].includes(key))) {
      return reply(400, { error: "unrecognized_signup_field" });
    }
    const fullName = typeof record.fullName === "string" ? record.fullName.trim() : "";
    if (fullName.length < 2 || fullName.length > 120 || /[\x00-\x1f]/.test(fullName)) {
      return reply(400, { error: "invalid_full_name" });
    }
    const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return reply(400, { error: "invalid_email" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase service credentials missing");
    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Do not create a new account when the verified phone already belongs to
    // ANY Supabase profile (including inactive/staff profiles). In that case
    // an existing-account flow or staff review must resolve the identity.
    const { data: profiles, error: profileError } = await db.from("profiles")
      .select("phone").limit(1000);
    if (profileError || !Array.isArray(profiles) || profiles.length === 1000) {
      throw new Error("Complete duplicate-phone check unavailable");
    }
    if (profiles.some((profile) => canonicalIndianPhone(profile.phone) === decoded.phone_number)) {
      return reply(409, { error: "phone_already_registered" });
    }

    // Create the Supabase Auth user for the existing profiles.id foreign key.
    // Its existing auth.users trigger creates the canonical customer profile.
    // Email is stored only as unverified contact metadata, NOT as a verified
    // login identity, to prevent caller-controlled email takeover.
    const { data, error: createError } = await db.auth.admin.createUser({
      phone: decoded.phone_number,
      phone_confirm: true,
      app_metadata: { app_role: "customer" },
      user_metadata: {
        full_name: fullName,
        phone: decoded.phone_number,
        ...(email ? { email } : {}),
      },
    });
    if (createError || !data.user) {
      // Never disclose whether Supabase Auth already held another user's phone.
      return reply(409, { error: "customer_registration_unavailable" });
    }

    // The caller must separately call customer-firebase-bind, which verifies
    // token revocation and creates an approved immutable Firebase UID mapping.
    // No customer data or Supabase session is returned by this endpoint.
    return reply(201, { status: "registered", requiresBinding: true });
  } catch (error) {
    console.error("customer-firebase-signup failed", error instanceof Error ? error.name : "unknown");
    return reply(503, { error: "registration_unavailable" });
  }
});
