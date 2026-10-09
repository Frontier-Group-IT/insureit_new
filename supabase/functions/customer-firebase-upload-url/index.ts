import { cert, getApps, initializeApp } from "npm:firebase-admin@13.5.0/app";
import { getAuth } from "npm:firebase-admin@13.5.0/auth";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/** Firebase-verified, account-scoped Storage upload tickets only.
 * No client receives a service-role key; Storage validates the signed ticket.
 * This is not a generic upload proxy or an authority to modify metadata.
 */
const PROJECT = "insureit-customer-auth";
const ISSUER = `https://securetoken.google.com/${PROJECT}`;
const PHONE = /^\+91[6-9]\d{9}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const canonicalPhone = (v: unknown) => {
  if (typeof v !== "string") return null;
  const d = v.replace(/[^0-9]/g, "");
  return /^(91)?[6-9][0-9]{9}$/.test(d) ? "+91" + d.slice(-10) : null;
};
const reply = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
function auth() {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Admin credentials unavailable");
  const c = JSON.parse(raw);
  if (c.project_id !== PROJECT || !c.client_email || !c.private_key) {
    throw new Error("Admin credentials invalid");
  }
  const app = getApps().find((a) => a.name === "insureit-customer-storage-ticket") ??
    initializeApp({ credential: cert(c), projectId: PROJECT }, "insureit-customer-storage-ticket");
  return getAuth(app);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const bearer = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  if (!bearer || bearer[1].length > 16384) return reply(401, { error: "invalid_token" });
  try {
    const decoded = await auth().verifyIdToken(bearer[1], true);
    if (decoded.aud !== PROJECT || decoded.iss !== ISSUER ||
        decoded.firebase?.sign_in_provider !== "phone" ||
        typeof decoded.phone_number !== "string" || !PHONE.test(decoded.phone_number) ||
        decoded.role !== "authenticated") {
      return reply(401, { error: "invalid_identity" });
    }

    const reader = request.body?.getReader();
    if (!reader) return reply(400, { error: "invalid_request" });
    const decoder = new TextDecoder();
    let raw = "";
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        return reply(413, { error: "payload_too_large" });
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return reply(400, { error: "invalid_request" }); }
    if (!data || typeof data !== "object" || Array.isArray(data)) return reply(400, { error: "invalid_request" });
    const input = data as Record<string, unknown>;
    if (Object.keys(input).some((key) => !["bucket", "path"].includes(key))) {
      return reply(400, { error: "invalid_request" });
    }
    const bucket = input.bucket;
    const objectPath = input.path;
    if ((bucket !== "claim-documents" && bucket !== "customer-documents") ||
        typeof objectPath !== "string" || objectPath.length > 1024 ||
        objectPath.length < 38 || /[\x00-\x1f]/.test(objectPath) ||
        objectPath.startsWith("/") || objectPath.includes("%") || objectPath.includes("\\\\") ||
        objectPath.split("/").some((v) => !v || v === "." || v === "..")) {
      return reply(400, { error: "invalid_document_path" });
    }
    const segments = objectPath.split("/");
    if (!UUID.test(segments[0]) || !segments[1]) return reply(400, { error: "invalid_document_path" });
    if (bucket === "claim-documents" && (segments.length < 3 || !UUID.test(segments[1]))) {
      return reply(400, { error: "invalid_claim_document_path" });
    }
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Database unavailable");
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: links, error: linkError } = await db.from("customer_firebase_identity_links")
      .select("profile_id,verified_phone_at_approval,is_approved,is_active,approved_at")
      .eq("firebase_project_id", PROJECT).eq("firebase_uid", decoded.uid).limit(2);
    if (linkError || !Array.isArray(links)) throw new Error("Identity lookup unavailable");
    if (links.length !== 1 || !links[0].is_approved || !links[0].is_active ||
        !links[0].approved_at || links[0].verified_phone_at_approval !== decoded.phone_number) {
      return reply(403, { error: "identity_not_authorized" });
    }
    const profileId = links[0].profile_id as string;
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("id,phone,role,is_active").eq("id", profileId).maybeSingle();
    if (profileError) throw new Error("Customer profile lookup failed");
    if (!profile || !profile.is_active || profile.role !== "customer" ||
        canonicalPhone(profile.phone) !== decoded.phone_number) {
      return reply(403, { error: "identity_not_authorized" });
    }

    let allowed = false;
    if (bucket === "claim-documents") {
      const customerId = segments[0];
      const claimId = segments[1];
      const { data: claim, error: claimError } = await db.from("claims")
        .select("customer_id").eq("id", claimId).maybeSingle();
      const { data: customer, error: customerError } = await db.from("customers")
        .select("id,profile_id").eq("id", customerId).maybeSingle();
      if (claimError || customerError) throw new Error("Claim ownership lookup failed");
      if (customer?.id === customerId && claim?.customer_id === customerId) {
        allowed = customer.profile_id === profileId;
        if (!allowed) {
          const { data: memberships, error: membershipError } = await db
            .from("customer_memberships").select("customer_id")
            .eq("customer_id", customerId).eq("profile_id", profileId)
            .eq("status", "active").limit(1);
          if (membershipError) throw new Error("Membership lookup failed");
          allowed = Boolean(memberships?.length);
        }
      }
    } else {
      // The same bucket stores pending onboarding uploads in application-ID
      // folders and live customer files in customer-ID folders.
      const folderId = segments[0];
      const { data: application, error: applicationError } = await db
        .from("customer_onboarding_applications")
        .select("profile_id,status,source").eq("id", folderId).maybeSingle();
      if (applicationError) throw new Error("Onboarding owner lookup failed");
      if (application) {
        allowed = application.profile_id === profileId &&
          application.source === "customer_app" &&
          ["not_started", "in_progress", "changes_requested"].includes(application.status);
      } else {
        const { data: customer, error: customerError } = await db.from("customers")
          .select("profile_id").eq("id", folderId).maybeSingle();
        if (customerError) throw new Error("Customer owner lookup failed");
        allowed = customer?.profile_id === profileId;
      }
    }
    if (!allowed) return reply(403, { error: "document_upload_not_authorized" });

    // Signed tickets are path-bound, non-upsert, and cannot list or delete
    // objects. The bucket enforces configured maximum upload size.
    const { data: ticket, error: uploadError } = await db.storage.from(bucket)
      .createSignedUploadUrl(objectPath, { upsert: false });
    if (uploadError || !ticket?.token || !ticket.signedUrl) {
      throw new Error("Signed upload ticket unavailable");
    }
    return reply(200, {
      bucket, path: objectPath, token: ticket.token, signedUrl: ticket.signedUrl,
    });
  } catch (error) {
    console.error("customer-firebase-upload-url failed", error instanceof Error ? error.name : "unknown");
    return reply(503, { error: "upload_authorization_unavailable" });
  }
});
