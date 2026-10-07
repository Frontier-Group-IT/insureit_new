import { NextResponse } from "next/server";
import {
  accessTokenCookie,
  refreshTokenCookie,
  sessionRoleCookie,
} from "@/lib/auth-config";
import { createSupabaseWithAccessToken } from "@/lib/auth";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

type CustomerSessionProfile = {
  role: string;
  is_active: boolean;
};

async function verifyCustomerSession(accessToken: string) {
  try {
    const supabase = createSupabaseWithAccessToken(accessToken);

    // Use Supabase Auth's server verification endpoint instead of the shared
    // getClaims() helper. This Customer-only path is compatible with the
    // Cloudflare/OpenNext runtime while still validating the token server-side.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return { user: null, profile: null, error: "invalid_token" as const };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle<CustomerSessionProfile>();

    if (profileError || !profile) {
      return { user, profile: null, error: "profile_lookup_failed" as const };
    }

    return { user, profile, error: null };
  } catch (error) {
    console.error("customer_web_session_verification_failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { user: null, profile: null, error: "session_service_unavailable" as const };
  }
}

export async function POST(request: Request) {
  let body: { access_token?: string; refresh_token?: string; expires_in?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Invalid session payload", code: "customer_session_bad_payload" },
      { status: 400 },
    );
  }

  if (!body.access_token || !body.refresh_token) {
    return NextResponse.json(
      { error: "Missing session tokens", code: "customer_session_missing_tokens" },
      { status: 400 },
    );
  }

  const { user, profile, error } = await verifyCustomerSession(body.access_token);

  if (error === "session_service_unavailable") {
    return NextResponse.json(
      { error: "Customer session service is temporarily unavailable", code: "customer_session_unavailable" },
      { status: 503 },
    );
  }

  if (error || !user || !profile) {
    return NextResponse.json(
      { error: "Invalid customer session", code: "customer_session_invalid" },
      { status: 401 },
    );
  }

  if (!profile.is_active || profile.role !== "customer") {
    return NextResponse.json(
      { error: "This account is not authorized for Customer Web", code: "customer_session_forbidden" },
      { status: 403 },
    );
  }

  const expiresIn = Number.isFinite(body.expires_in)
    ? Math.max(60, Math.min(Math.trunc(body.expires_in as number), 60 * 60))
    : 60 * 60;

  const response = NextResponse.json({ ok: true });
  response.cookies.set(accessTokenCookie, body.access_token, { ...cookieOptions, maxAge: expiresIn });
  response.cookies.set(refreshTokenCookie, body.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set(sessionRoleCookie, "customer", { ...cookieOptions, maxAge: expiresIn });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(accessTokenCookie, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(refreshTokenCookie, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(sessionRoleCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
