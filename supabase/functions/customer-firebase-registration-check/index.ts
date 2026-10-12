import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/**
 * Pre-SMS check against canonical customer identity and legacy customer master.
 * No direct public table grants, no secrets sent to app. SQL RPC enforces
 * service-role-only rate limits and fail-closed ambiguous old accounts.
 *
 * Since the user's product requirement explicitly displays "sign up first",
 * the endpoint necessarily reveals a limited registration status. Keep
 * Supabase edge gateway/WAF abuse protections on and monitor request rate.
 */
const reply = (status: number, result: Record<string, unknown>) =>
  new Response(JSON.stringify(result), { status, headers: {
    "content-type": "application/json", "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  } });
const pattern = /^\+91[6-9][0-9]{9}$/;

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    return reply(415, { error: "invalid_content_type" });
  }
  try {
    const body = await request.text();
    if (body.length > 256) return reply(413, { error: "request_too_large" });
    const data = JSON.parse(body);
    if (!data || Array.isArray(data) || typeof data !== "object" ||
        Object.keys(data).length !== 1 || typeof data.phone !== "string" ||
        !pattern.test(data.phone)) return reply(400, { error: "invalid_phone" });

    // Hash caller network identity using the server's existing secret.
    // x-forwarded-for must be set by a trusted gateway. Ignore any direct
    // user-provided custom identity headers; no raw IP is stored in database.
    const ip = (request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key || !ip || ip.length > 80) {
      return reply(503, { error: "registration_lookup_unavailable" });
    }
    const cryptoKey = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const digest = async (value: string) => {
      const hash = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
      return [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, "0")).join("");
    };
    const fingerprint = await digest("ip:" + ip);
    const phoneFingerprint = await digest("phone:" + data.phone);
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: status, error } = await db.rpc("customer_firebase_registration_preflight", {
      p_phone: data.phone, p_identity_hash: fingerprint, p_phone_hash: phoneFingerprint,
    });
    if (error || typeof status !== "string") {
      console.error("Firebase registration preflight denied", error?.code ?? "unknown");
      return reply(503, { error: "registration_lookup_unavailable" });
    }
    if (status === "rate_limited") return reply(429, { error: "rate_limited" });
    if (!["registered", "not_registered", "signup_incomplete", "account_requires_review"].includes(status)) {
      return reply(503, { error: "registration_lookup_unavailable" });
    }
    return reply(200, { status });
  } catch {
    return reply(503, { error: "registration_lookup_unavailable" });
  }
});
