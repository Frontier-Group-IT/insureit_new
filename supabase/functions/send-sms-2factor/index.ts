import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type SmsHookPayload = {
  user?: {
    phone?: string | null;
  } | null;
  sms?: {
    otp?: string | null;
  } | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse({}, 200);
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("TWOFACTOR_API_KEY");
  if (!apiKey) {
    console.error("send-sms-2factor missing TWOFACTOR_API_KEY");
    return jsonResponse({ error: "SMS provider is not configured." }, 500);
  }

  const rawPayload = await request.text();
  const payload = parseHookPayload(rawPayload, request.headers);
  const phone = normalizeIndianPhone(payload?.user?.phone);
  const otp = normalizeOtp(payload?.sms?.otp);

  if (!phone || !otp) {
    console.error("send-sms-2factor invalid payload", {
      hasPhone: Boolean(payload?.user?.phone),
      hasOtp: Boolean(payload?.sms?.otp),
    });
    return jsonResponse({ error: "Invalid SMS hook payload." }, 400);
  }

  const endpoint = `https://2factor.in/API/V1/${encodeURIComponent(apiKey)}/SMS/${encodeURIComponent(phone)}/${encodeURIComponent(otp)}`;
  const response = await fetch(endpoint, { method: "GET" });
  const rawBody = await response.text();
  const result = parseJson(rawBody);

  if (!response.ok || result?.Status !== "Success") {
    console.error("send-sms-2factor provider failure", {
      status: response.status,
      phone: maskPhone(phone),
      body: rawBody,
    });
    return jsonResponse({ error: "Could not send OTP." }, 502);
  }

  console.info("send-sms-2factor OTP accepted", {
    phone: maskPhone(phone),
    details: result.Details ?? null,
  });

  return jsonResponse({}, 200);
});

function normalizeIndianPhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

function normalizeOtp(value: string | null | undefined) {
  const otp = value?.trim() ?? "";
  return /^\d{4,8}$/.test(otp) ? otp : null;
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as { Status?: string; Details?: string };
  } catch {
    return null;
  }
}

function parseHookPayload(rawPayload: string, headers: Headers) {
  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  if (!hookSecret) return parseJson(rawPayload) as SmsHookPayload | null;

  try {
    const secret = hookSecret.replace("v1,whsec_", "");
    return new Webhook(secret).verify(rawPayload, Object.fromEntries(headers)) as SmsHookPayload;
  } catch (error) {
    console.error("send-sms-2factor invalid hook signature", error);
    return null;
  }
}

function maskPhone(value: string) {
  return value.replace(/(\+91)\d{5}(\d{3})$/, "$1*****$2");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
