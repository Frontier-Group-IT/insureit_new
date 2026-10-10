import { cert, getApps, initializeApp } from "npm:firebase-admin@13.5.0/app";
import { getAuth } from "npm:firebase-admin@13.5.0/auth";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

/**
 * Read-only, short-lived document access for approved Firebase customers.
 * Not a generic Storage proxy: only canonical, DB-registered documents can
 * be signed, and the document's owning customer/profile is verified.
 *
 * JWT gateway verification disabled ONLY because Firebase Admin verifies the
 * external signed bearer token + revocation on every request.
 */
const PROJECT = "insureit-customer-auth";
const ISSUER = `https://securetoken.google.com/${PROJECT}`;
const PHONE = /^\+91[6-9]\d{9}$/;
const CANONICAL = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^0-9]/g, "");
  return /^(91)?[6-9][0-9]{9}$/.test(digits) ? "+91" + digits.slice(-10) : null;
};
const reply = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function firebaseAdmin() {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Firebase Admin unavailable");
  const credentials = JSON.parse(raw);
  if (credentials.project_id !== PROJECT || !credentials.client_email || !credentials.private_key) {
    throw new Error("Firebase Admin configuration mismatch");
  }
  const app = getApps().find((item) => item.name === "insureit-customer-documents") ??
    initializeApp({ credential: cert(credentials), projectId: PROJECT }, "insureit-customer-documents");
  return getAuth(app);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const bearer = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "");
  if (!bearer || bearer[1].length > 16384) return reply(401, { error: "invalid_token" });
  try {
    const firebase = firebaseAdmin();
    const decoded = await firebase.verifyIdToken(bearer[1], true);
    if (decoded.aud !== PROJECT || decoded.iss !== ISSUER ||
      decoded.firebase?.sign_in_provider !== "phone" ||
      typeof decoded.phone_number !== "string" || !PHONE.test(decoded.phone_number) ||
      decoded.role !== "authenticated") return reply(401, { error: "invalid_identity" });
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { error: "invalid_request" });
    const decoder = new TextDecoder();
    let raw = "";
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2048) {
        await reader.cancel();
        return reply(413, { error: "payload_too_large" });
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(400, { error: "invalid_request" });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply(400, { error: "invalid_request" });
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((field) => !["bucket", "path"].includes(field))) {
      return reply(400, { error: "invalid_request" });
    }
    const bucket = input.bucket;
    const documentPath = input.path;
    if (typeof bucket !== "string" || typeof documentPath !== "string" ||
      documentPath.length < 3 || documentPath.length > 1024 ||
      /[\x00-\x1f]/.test(documentPath) || documentPath.startsWith("/") ||
      documentPath.split("/").some((part) => part === ".." || part === "." || part === "")) {
      return reply(400, { error: "invalid_document" });
    }
    if (!["claim-documents", "customer-documents", "policy-documents"].includes(bucket)) {
      return reply(403, { error: "bucket_not_allowed" });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Supabase credentials missing");
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: links, error: linkError } = await db
      .from("customer_firebase_identity_links")
      .select("profile_id,verified_phone_at_approval,is_approved,is_active,approved_at")
      .eq("firebase_project_id", PROJECT).eq("firebase_uid", decoded.uid).limit(2);
    if (linkError || !Array.isArray(links)) throw new Error("Identity lookup failed");
    if (links.length !== 1 || !links[0].is_approved || !links[0].is_active ||
      !links[0].approved_at || links[0].verified_phone_at_approval !== decoded.phone_number) {
      return reply(403, { error: "identity_not_authorized" });
    }
    const profileId = links[0].profile_id as string;
    const { data: profile, error: profileError } = await db.from("profiles")
      .select("id,phone,role,is_active").eq("id", profileId).maybeSingle();
    if (profileError) throw new Error("Profile lookup failed");
    if (!profile || !profile.is_active || profile.role !== "customer" ||
      CANONICAL(profile.phone) !== decoded.phone_number) {
      return reply(403, { error: "identity_not_authorized" });
    }

    let allowed = false;
    if (bucket === "claim-documents") {
      const { data: docs, error } = await db.from("claim_documents")
        .select("id,claim_id,customer_id")
        .eq("storage_bucket", bucket).eq("storage_path", documentPath).limit(2);
      if (error) throw new Error("Document lookup failed");
      if (docs?.length === 1) {
        const d = docs[0];
        const [{ data: claim, error: claimError }, { data: customer, error: customerError }] = await Promise.all([
          db.from("claims").select("id,customer_id").eq("id", d.claim_id).maybeSingle(),
          db.from("customers").select("id,profile_id").eq("id", d.customer_id).maybeSingle(),
        ]);
        if (claimError || customerError) throw new Error("Document owner lookup failed");
        if (claim?.customer_id === d.customer_id && customer?.id === d.customer_id) {
          allowed = customer.profile_id === profileId;
          if (!allowed) {
            const { data: memberships, error: membershipError } = await db
              .from("customer_memberships").select("customer_id")
              .eq("customer_id", d.customer_id).eq("profile_id", profileId)
              .eq("status", "active").limit(1);
            if (membershipError) throw new Error("Membership lookup failed");
            allowed = Boolean(memberships?.length);
          }
        }
      }
    } else if (bucket === "policy-documents") {
      const { data: docs, error } = await db.from("policy_documents")
        .select("id,policy_id").eq("storage_bucket", bucket).eq("storage_path", documentPath).limit(2);
      if (error) throw new Error("Policy document lookup failed");
      if (docs?.length === 1) {
        const { data: policy, error: policyError } = await db.from("policies")
          .select("id,customer_id").eq("id", docs[0].policy_id).maybeSingle();
        if (policyError) throw new Error("Policy owner lookup failed");
        if (policy?.customer_id) {
          const { data: customer, error: customerError } = await db.from("customers")
            .select("id,profile_id").eq("id", policy.customer_id).maybeSingle();
          if (customerError) throw new Error("Policy customer lookup failed");
          allowed = customer?.profile_id === profileId;
          if (!allowed && customer?.id === policy.customer_id) {
            const { data: memberships, error: membershipError } = await db
              .from("customer_memberships").select("customer_id")
              .eq("customer_id", policy.customer_id).eq("profile_id", profileId)
              .eq("status", "active").limit(1);
            if (membershipError) throw new Error("Policy membership lookup failed");
            allowed = Boolean(memberships?.length);
          }
        }
      }
    } else {
      const { data: docs, error } = await db.from("customer_onboarding_documents")
        .select("id,application_id").eq("storage_bucket", bucket)
        .eq("storage_path", documentPath).limit(2);
      if (error) throw new Error("Onboarding document lookup failed");
      if (docs?.length === 1) {
        const { data: application, error: appError } = await db
          .from("customer_onboarding_applications").select("profile_id,source")
          .eq("id", docs[0].application_id).maybeSingle();
        if (appError) throw new Error("Onboarding owner lookup failed");
        allowed = application?.profile_id === profileId && application.source === "customer_app";
      }

      // Customer profile photos and attached policies use a different
      // canonical metadata table from onboarding documents. Never infer
      // ownership from storage paths alone.
      if (!allowed) {
        const { data: files, error: fileError } = await db.from("customer_documents")
          .select("id,customer_id").eq("storage_bucket", bucket)
          .eq("storage_path", documentPath).limit(2);
        if (fileError) throw new Error("Customer document lookup failed");
        if (files?.length === 1) {
          const customerId = files[0].customer_id;
          const { data: customer, error: customerError } = await db.from("customers")
            .select("id,profile_id").eq("id", customerId).maybeSingle();
          if (customerError) throw new Error("Customer document owner lookup failed");
          allowed = customer?.id === customerId && customer?.profile_id === profileId;
          if (!allowed && customer?.id === customerId) {
            const { data: memberships, error: membershipError } = await db
              .from("customer_memberships").select("customer_id")
              .eq("customer_id", customerId).eq("profile_id", profileId)
              .eq("status", "active").limit(1);
            if (membershipError) throw new Error("Customer document membership lookup failed");
            allowed = Boolean(memberships?.length);
          }
        }
      }
    }
    if (!allowed) return reply(404, { error: "document_unavailable" });

    // An approved one-minute signed link only; no generic bucket listing,
    // upload, delete, arbitrary path or server credentials exposed.
    const { data: signed, error: signError } = await db.storage.from(bucket)
      .createSignedUrl(documentPath, 60);
    if (signError || !signed?.signedUrl) throw new Error("Signed read unavailable");
    return reply(200, { url: signed.signedUrl, expiresIn: 60 });
  } catch (error) {
    console.error("customer-firebase-doc-read failed", error instanceof Error ? error.name : "unknown");
    return reply(503, { error: "document_service_unavailable" });
  }
});
