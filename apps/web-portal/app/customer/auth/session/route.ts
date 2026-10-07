import { NextResponse } from "next/server";
import {
  accessTokenCookie,
  refreshTokenCookie,
  sessionRoleCookie,
} from "@/lib/auth-config";
import { getAuthenticatedProfile } from "@/lib/auth";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function POST(request: Request) {
  let body: { access_token?: string; refresh_token?: string; expires_in?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid session payload" }, { status: 400 });
  }

  if (!body.access_token || !body.refresh_token) {
    return NextResponse.json({ error: "Missing session tokens" }, { status: 400 });
  }

  const { user, profile, error } = await getAuthenticatedProfile(body.access_token);
  if (error || !user || !profile) {
    return NextResponse.json({ error: "Invalid customer session" }, { status: 401 });
  }

  if (!profile.is_active || profile.role !== "customer") {
    return NextResponse.json({ error: "This account is not authorized for Customer Web" }, { status: 403 });
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
