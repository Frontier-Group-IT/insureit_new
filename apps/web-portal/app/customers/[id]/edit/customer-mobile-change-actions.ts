"use server";

import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { getCustomerManager } from "@/lib/master-data-server";
import { sendResendEmail } from "@/lib/resend-email";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { updateCustomerProfile } from "./actions";

const MOBILE_PATTERN = /^[6-9][0-9]{9}$/;
const OTP_TTL_MS = 5 * 60 * 1000;
const AUTHORIZATION_TTL_MS = 10 * 60 * 1000;
const OTP_ATTEMPTS = 5;

type ChallengePayload = {
  kind: "customer-mobile-otp";
  editorId: string;
  customerId: string;
  newMobile: string;
  otpHash: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  attemptsRemaining: number;
};

type AuthorizationPayload = {
  kind: "customer-mobile-authorized";
  editorId: string;
  customerId: string;
  newMobile: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
};

type RequestResult =
  | { ok: true; challengeToken: string; maskedEmail: string; expiresInSeconds: number }
  | { ok: false; error: string };

type VerifyResult =
  | { ok: true; authorizationToken: string }
  | { ok: false; error: string; challengeToken?: string; attemptsRemaining?: number };

function normalizeMobile(value: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

function signingSecret() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return value;
}

function signEncodedPayload(encoded: string) {
  return createHmac("sha256", signingSecret()).update(encoded).digest("base64url");
}

function signPayload(payload: ChallengePayload | AuthorizationPayload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signEncodedPayload(encoded)}`;
}

function readSignedPayload<T extends ChallengePayload | AuthorizationPayload>(token: string | null): T | null {
  if (!token) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  const expected = signEncodedPayload(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function hashOtp(nonce: string, otp: string) {
  return createHmac("sha256", signingSecret()).update(`customer-mobile-otp:${nonce}:${otp}`).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your registered email";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function maskMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  return `******${digits.slice(-4)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

async function loadEditorAndCustomer(customerId: string) {
  const profile = await getCustomerManager(customerId);
  if (!profile?.id) return { error: "You are not authorized to update this customer." } as const;

  const admin = createSupabaseAdminClient();
  const [{ data: customer }, { data: editorRecord }, editorAuth] = await Promise.all([
    admin.from("customers").select("id, customer_code, contact_name, company_name, phone, profile_id").eq("id", customerId).maybeSingle<{ id: string; customer_code: string; contact_name: string; company_name: string | null; phone: string; profile_id: string | null }>(),
    admin.from("profiles").select("id, full_name, email").eq("id", profile.id).maybeSingle<{ id: string; full_name: string; email: string | null }>(),
    admin.auth.admin.getUserById(profile.id),
  ]);
  if (!customer) return { error: "Customer could not be loaded." } as const;

  const editorEmail = editorRecord?.email?.trim() || editorAuth.data.user?.email?.trim() || null;
  if (!editorEmail) return { error: "Your portal account needs an email address before changing a customer login mobile." } as const;

  return {
    profile,
    admin,
    customer,
    editorEmail,
    editorName: editorRecord?.full_name?.trim() || profile.full_name || "INSUREIT user",
  } as const;
}

async function validateDuplicateMobile(customerId: string, customerProfileId: string | null, newMobile: string) {
  const admin = createSupabaseAdminClient();
  const [{ data: memberships }, { data: duplicateCustomers }, { data: duplicateProfiles }] = await Promise.all([
    admin.from("customer_memberships").select("profile_id").eq("customer_id", customerId).eq("status", "active").returns<Array<{ profile_id: string }>>(),
    admin.from("customers").select("id, phone").neq("id", customerId).not("phone", "is", null).returns<Array<{ id: string; phone: string }>>(),
    admin.from("profiles").select("id, phone").neq("id", customerProfileId ?? "00000000-0000-0000-0000-000000000000").eq("role", "customer").not("phone", "is", null).returns<Array<{ id: string; phone: string | null }>>(),
  ]);

  if ((duplicateCustomers ?? []).some((customer) => normalizeMobile(customer.phone) === newMobile)) {
    return "That mobile number is already assigned to another customer.";
  }
  const linkedProfileIds = new Set([customerProfileId, ...(memberships ?? []).map((membership) => membership.profile_id)].filter((value): value is string => Boolean(value)));
  if ((duplicateProfiles ?? []).some((customerProfile) => !linkedProfileIds.has(customerProfile.id) && normalizeMobile(customerProfile.phone) === newMobile)) {
    return "That mobile number is already assigned to another customer login.";
  }
  return null;
}

export async function requestCustomerMobileChangeOtp(customerId: string, proposedMobile: string): Promise<RequestResult> {
  const newMobile = normalizeMobile(proposedMobile);
  if (!MOBILE_PATTERN.test(newMobile)) return { ok: false, error: "Enter a valid 10-digit Indian login mobile number." };

  const context = await loadEditorAndCustomer(customerId);
  if ("error" in context) return { ok: false, error: context.error };

  const currentMobile = normalizeMobile(context.customer.phone);
  if (currentMobile === newMobile) return { ok: false, error: "The login mobile number has not changed." };

  const duplicateError = await validateDuplicateMobile(customerId, context.customer.profile_id, newMobile);
  if (duplicateError) return { ok: false, error: duplicateError };

  const otp = String(randomInt(100000, 1000000));
  const nonce = randomUUID();
  const now = Date.now();
  const challenge: ChallengePayload = {
    kind: "customer-mobile-otp",
    editorId: context.profile.id,
    customerId,
    newMobile,
    otpHash: hashOtp(nonce, otp),
    nonce,
    issuedAt: now,
    expiresAt: now + OTP_TTL_MS,
    attemptsRemaining: OTP_ATTEMPTS,
  };

  const customerName = context.customer.company_name || context.customer.contact_name || "Customer";
  const subject = "Verify Customer Login Mobile Change | INSUREIT";
  const text = [
    "INSUREIT",
    "",
    "Verify Customer Login Mobile Change",
    "",
    `Hello ${context.editorName},`,
    `Use this OTP to authorize the login mobile change for ${customerName} (${context.customer.customer_code}).`,
    "",
    `OTP: ${otp}`,
    `New Login Mobile: ${maskMobile(newMobile)}`,
    "",
    "This OTP expires in 5 minutes. Do not share it with anyone.",
    "The customer will not receive this OTP.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #dbe4ef;border-radius:18px;overflow:hidden"><tr><td style="background:#071d49;padding:22px 26px;color:#fff"><div style="font-size:24px;font-weight:800">INSUREIT</div><div style="margin-top:4px;font-size:11px;color:#bfdbfe;text-transform:uppercase;letter-spacing:.08em">Your Safety, Our Promise</div></td></tr><tr><td style="padding:28px"><h1 style="margin:0;font-size:21px;color:#0f2d5c">Verify Customer Login Mobile Change</h1><p style="margin:10px 0 18px;font-size:14px;line-height:1.6;color:#475569">Hello ${escapeHtml(context.editorName)}, use this OTP to authorize the login mobile change for <strong>${escapeHtml(customerName)}</strong> (${escapeHtml(context.customer.customer_code)}).</p><div style="margin:18px 0;padding:18px;border-radius:12px;background:#eef4ff;text-align:center"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.12em">One-time password</div><div style="margin-top:6px;font-size:30px;font-weight:800;letter-spacing:.22em;color:#071d49">${otp}</div></div><p style="margin:0;font-size:13px;color:#475569">New Login Mobile: <strong>${escapeHtml(maskMobile(newMobile))}</strong></p><p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#64748b">This OTP expires in 5 minutes. Do not share it with anyone. The customer will not receive this OTP.</p></td></tr></table></td></tr></table></body></html>`;

  try {
    await sendResendEmail({
      to: context.editorEmail,
      subject,
      text,
      html,
      idempotencyKey: `customer-mobile-change-otp-${customerId}-${nonce}`,
    });
  } catch (error) {
    console.error("customer_mobile_change_otp_email_failed", { customerId, editorProfileId: context.profile.id, error: error instanceof Error ? error.message : "unknown" });
    return { ok: false, error: "OTP could not be sent to your registered email. Please try again." };
  }

  return {
    ok: true,
    challengeToken: signPayload(challenge),
    maskedEmail: maskEmail(context.editorEmail),
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
  };
}

export async function verifyCustomerMobileChangeOtp(customerId: string, challengeToken: string, otp: string): Promise<VerifyResult> {
  const context = await loadEditorAndCustomer(customerId);
  if ("error" in context) return { ok: false, error: context.error };

  const challenge = readSignedPayload<ChallengePayload>(challengeToken);
  if (!challenge || challenge.kind !== "customer-mobile-otp" || challenge.customerId !== customerId || challenge.editorId !== context.profile.id) {
    return { ok: false, error: "This OTP request is invalid. Please request a new OTP." };
  }
  if (Date.now() > challenge.expiresAt) return { ok: false, error: "This OTP has expired. Please request a new OTP." };
  if (challenge.attemptsRemaining <= 0) return { ok: false, error: "Too many incorrect attempts. Please request a new OTP." };

  const submittedOtp = otp.replace(/\D/g, "");
  const matches = submittedOtp.length === 6 && safeEqual(hashOtp(challenge.nonce, submittedOtp), challenge.otpHash);
  if (!matches) {
    const attemptsRemaining = challenge.attemptsRemaining - 1;
    const nextChallenge = { ...challenge, attemptsRemaining };
    return {
      ok: false,
      error: attemptsRemaining > 0 ? `Incorrect OTP. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} remaining.` : "Too many incorrect attempts. Please request a new OTP.",
      challengeToken: attemptsRemaining > 0 ? signPayload(nextChallenge) : undefined,
      attemptsRemaining,
    };
  }

  const now = Date.now();
  const authorization: AuthorizationPayload = {
    kind: "customer-mobile-authorized",
    editorId: context.profile.id,
    customerId,
    newMobile: challenge.newMobile,
    nonce: challenge.nonce,
    issuedAt: now,
    expiresAt: now + AUTHORIZATION_TTL_MS,
  };
  return { ok: true, authorizationToken: signPayload(authorization) };
}

function editErrorUrl(id: string, message: string, field?: string) {
  const params = new URLSearchParams({ error: message });
  if (field) params.set("field", field);
  return `/customers/${id}/edit?${params.toString()}`;
}

export async function updateCustomerProfileWithMobileVerification(id: string, formData: FormData) {
  const profile = await getCustomerManager(id);
  if (!profile?.id) redirect(editErrorUrl(id, "You are not authorized to update this customer."));

  const newMobile = normalizeMobile(typeof formData.get("phone") === "string" ? String(formData.get("phone")) : null);
  if (!MOBILE_PATTERN.test(newMobile)) return updateCustomerProfile(id, formData);

  const admin = createSupabaseAdminClient();
  const { data: customer } = await admin.from("customers").select("phone").eq("id", id).maybeSingle<{ phone: string }>();
  if (!customer) redirect(editErrorUrl(id, "Customer could not be loaded."));

  const mobileChanged = normalizeMobile(customer.phone) !== newMobile;
  if (mobileChanged) {
    const tokenValue = formData.get("mobile_change_verification");
    const authorization = readSignedPayload<AuthorizationPayload>(typeof tokenValue === "string" ? tokenValue : null);
    const valid = authorization
      && authorization.kind === "customer-mobile-authorized"
      && authorization.editorId === profile.id
      && authorization.customerId === id
      && authorization.newMobile === newMobile
      && Date.now() <= authorization.expiresAt;
    if (!valid) redirect(editErrorUrl(id, "Verify the login mobile change with the OTP sent to your registered email before saving.", "phone"));
  }

  return updateCustomerProfile(id, formData);
}
