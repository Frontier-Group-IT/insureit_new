import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type Action = "request_otp" | "verify_otp" | "submit_enquiry";
type GuestSource = "guest_login" | "guest_signup";
type ServiceType = "insurance_quote" | "challan_assistance";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse({}, 200);
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const providerKey = Deno.env.get("TWOFACTOR_API_KEY");
  if (!supabaseUrl || !serviceRoleKey || !providerKey) {
    console.error("guest-service-enquiry missing required server configuration");
    return jsonResponse({ error: "Guest verification is temporarily unavailable." }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid request payload." }, 400);
  }

  const action = payload.action as Action | undefined;
  try {
    if (action === "request_otp") return await requestOtp(admin, providerKey, serviceRoleKey, payload);
    if (action === "verify_otp") return await verifyOtp(admin, serviceRoleKey, payload);
    if (action === "submit_enquiry") return await submitEnquiry(admin, serviceRoleKey, payload);
    return jsonResponse({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("guest-service-enquiry failure", error);
    return jsonResponse({ error: "We could not complete this request right now. Please try again." }, 500);
  }
});

async function requestOtp(admin: any, providerKey: string, secret: string, payload: Record<string, unknown>) {
  const phone = normalizeIndianPhone(payload.phone);
  if (!phone) return jsonResponse({ error: "Enter a valid 10 digit Indian mobile number." }, 400);

  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: recent, error: recentError } = await admin
    .from("guest_service_enquiry_otp_challenges")
    .select("created_at,last_sent_at")
    .eq("phone", phone)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(6);
  if (recentError) throw recentError;

  const latestSent = recent?.[0]?.last_sent_at ? new Date(recent[0].last_sent_at).getTime() : 0;
  if (latestSent && Date.now() - latestSent < 60_000) {
    return jsonResponse({ error: "Please wait a minute before requesting another OTP." }, 429);
  }
  if ((recent ?? []).length >= 5) {
    return jsonResponse({ error: "Too many OTP requests. Please try again after 15 minutes." }, 429);
  }

  const challengeId = crypto.randomUUID();
  const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
  const otpHash = await hmacHex(secret, `${challengeId}:${phone}:${otp}`);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

  const { error: insertError } = await admin
    .from("guest_service_enquiry_otp_challenges")
    .insert({
      id: challengeId,
      phone,
      otp_hash: otpHash,
      attempts: 0,
      expires_at: expiresAt,
      last_sent_at: now.toISOString(),
    });
  if (insertError) throw insertError;

  const endpoint = `https://2factor.in/API/V1/${encodeURIComponent(providerKey)}/SMS/${encodeURIComponent(phone)}/${encodeURIComponent(otp)}`;
  const response = await fetch(endpoint, { method: "GET" });
  const rawBody = await response.text();
  const result = parseJson(rawBody);
  if (!response.ok || result?.Status !== "Success") {
    console.error("guest-service-enquiry OTP provider failure", { status: response.status, phone: maskPhone(phone) });
    await admin.from("guest_service_enquiry_otp_challenges").delete().eq("id", challengeId);
    return jsonResponse({ error: "Could not send OTP. Please try again." }, 502);
  }

  return jsonResponse({ challengeId, phone: maskPhone(phone), expiresInSeconds: 600 });
}

async function verifyOtp(admin: any, secret: string, payload: Record<string, unknown>) {
  const challengeId = cleanText(payload.challengeId, 80);
  const otp = cleanText(payload.otp, 8);
  if (!challengeId || !/^\d{6}$/.test(otp)) return jsonResponse({ error: "Enter the 6 digit OTP." }, 400);

  const { data: challenge, error } = await admin
    .from("guest_service_enquiry_otp_challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();
  if (error) throw error;
  if (!challenge || challenge.used_at) return jsonResponse({ error: "This verification request is no longer available." }, 400);
  if (challenge.verified_at) return jsonResponse({ error: "This OTP has already been verified. Request a new OTP if needed." }, 400);
  if (new Date(challenge.expires_at).getTime() < Date.now()) return jsonResponse({ error: "The OTP has expired. Request a new code." }, 400);
  if ((challenge.attempts ?? 0) >= 5) return jsonResponse({ error: "Too many incorrect attempts. Request a new OTP." }, 429);

  const expected = await hmacHex(secret, `${challenge.id}:${challenge.phone}:${otp}`);
  if (!timingSafeEqual(expected, challenge.otp_hash)) {
    await admin.from("guest_service_enquiry_otp_challenges").update({ attempts: (challenge.attempts ?? 0) + 1 }).eq("id", challenge.id);
    return jsonResponse({ error: "The OTP is incorrect. Please try again." }, 400);
  }

  const verificationToken = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const tokenHash = await hmacHex(secret, `${challenge.id}:${verificationToken}`);
  const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error: updateError } = await admin
    .from("guest_service_enquiry_otp_challenges")
    .update({
      verified_at: new Date().toISOString(),
      verification_token_hash: tokenHash,
      verification_token_expires_at: tokenExpiresAt,
    })
    .eq("id", challenge.id);
  if (updateError) throw updateError;

  return jsonResponse({ verificationToken, expiresInSeconds: 900 });
}

async function submitEnquiry(admin: any, secret: string, payload: Record<string, unknown>) {
  const challengeId = cleanText(payload.challengeId, 80);
  const token = cleanText(payload.verificationToken, 160);
  const serviceType = payload.serviceType as ServiceType | undefined;
  const source = payload.source as GuestSource | undefined;

  if (!challengeId || !token) return jsonResponse({ error: "Verify your mobile number before submitting." }, 400);
  if (!["insurance_quote", "challan_assistance"].includes(serviceType ?? "")) return jsonResponse({ error: "Invalid service type." }, 400);
  if (!["guest_login", "guest_signup"].includes(source ?? "")) return jsonResponse({ error: "Invalid enquiry source." }, 400);

  const { data: challenge, error } = await admin
    .from("guest_service_enquiry_otp_challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();
  if (error) throw error;
  if (!challenge?.verified_at || challenge.used_at || !challenge.verification_token_hash) {
    return jsonResponse({ error: "Verify your mobile number before submitting." }, 400);
  }
  if (!challenge.verification_token_expires_at || new Date(challenge.verification_token_expires_at).getTime() < Date.now()) {
    return jsonResponse({ error: "Mobile verification expired. Please verify again." }, 400);
  }

  const tokenHash = await hmacHex(secret, `${challenge.id}:${token}`);
  if (!timingSafeEqual(tokenHash, challenge.verification_token_hash)) {
    return jsonResponse({ error: "Mobile verification is invalid. Please verify again." }, 400);
  }

  const guestName = cleanText(payload.guestName, 120);
  const guestEmail = cleanEmail(payload.guestEmail);
  const vehicleNo = normalizeVehicleNo(payload.vehicleNo);
  const subject = cleanText(payload.subject, 160);
  const description = cleanText(payload.description, 3000);
  const details = isRecord(payload.details) ? payload.details : {};

  if (guestName.length < 2) return jsonResponse({ error: "Enter your full name." }, 400);
  if (payload.guestEmail && !guestEmail) return jsonResponse({ error: "Enter a valid email address or leave it blank." }, 400);
  if (subject.length < 3 || description.length < 3) return jsonResponse({ error: "Please complete the enquiry details." }, 400);
  if (!vehicleNo) return jsonResponse({ error: "Enter a valid vehicle number." }, 400);

  const { data: enquiry, error: insertError } = await admin
    .from("service_enquiries")
    .insert({
      enquiry_no: "",
      service_type: serviceType,
      source,
      customer_id: null,
      created_by: null,
      guest_name: guestName,
      guest_phone: challenge.phone,
      guest_email: guestEmail || null,
      vehicle_id: null,
      vehicle_no: vehicleNo,
      subject,
      description,
      details,
      status: "open",
    })
    .select("id,enquiry_no,status")
    .single();
  if (insertError) throw insertError;

  await admin
    .from("guest_service_enquiry_otp_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("id", challenge.id);

  return jsonResponse({ enquiry });
}

function normalizeIndianPhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

function normalizeVehicleNo(value: unknown) {
  const raw = String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return raw.length >= 6 && raw.length <= 12 ? raw : null;
}

function cleanText(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 160).toLowerCase();
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return diff === 0;
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as { Status?: string; Details?: string };
  } catch {
    return null;
  }
}

function maskPhone(value: string) {
  return value.replace(/(\+91)\d{5}(\d{3})$/, "$1*****$2");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
