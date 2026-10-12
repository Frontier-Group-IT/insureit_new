import type { Session } from "@supabase/supabase-js";

export function normalizeCustomerPhone10(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("91")) return digits.slice(2, 12);
  return digits.slice(0, 10);
}

export function customerPhoneE164(value: string) {
  const phone10 = normalizeCustomerPhone10(value);
  return phone10.length === 10 ? `+91${phone10}` : "";
}

export function customerSessionErrorMessage(status: number, code?: string) {
  if (status === 503 || code === "customer_session_unavailable") {
    return "Customer Web session service is temporarily unavailable. Please try again.";
  }
  if (status === 403 || code === "customer_session_forbidden") {
    return "This account is not authorized for Customer Web.";
  }
  if (status === 401 || code === "customer_session_invalid") {
    return "OTP was verified, but the secure Customer Web session could not be validated.";
  }
  return `Signed in, but the secure Customer Web session could not be created. (CW-${status || "ERR"})`;
}

export async function establishCustomerWebSession(session: Session) {
  const response = await fetch("/api/customer/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
    }),
  });

  if (response.ok) return;

  let code: string | undefined;
  try {
    const body = (await response.json()) as { code?: string };
    code = body.code;
  } catch {
    code = undefined;
  }
  throw new Error(customerSessionErrorMessage(response.status, code));
}
