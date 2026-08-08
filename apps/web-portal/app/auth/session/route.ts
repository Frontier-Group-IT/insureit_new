import { NextResponse } from "next/server";
import { accessTokenCookie, refreshTokenCookie, isAuthorizedProfile, sessionRoleCookie, type Profile } from "@/lib/auth-config";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Authentication service is unavailable" }, { status: 503 });
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${body.access_token}`
    },
    cache: "no-store"
  });
  if (!userResponse.ok) {
    return NextResponse.json({ error: "Invalid session tokens" }, { status: 401 });
  }
  const user = (await userResponse.json()) as { id?: string };
  if (!user.id) return NextResponse.json({ error: "Invalid session tokens" }, { status: 401 });

  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,role,is_active`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? body.access_token}`
      },
      cache: "no-store"
    }
  );
  if (!profileResponse.ok) {
    return NextResponse.json({ error: "Unable to verify profile" }, { status: 401 });
  }
  const profiles = (await profileResponse.json()) as Profile[];
  const profile = profiles[0] ?? null;
  if (!isAuthorizedProfile(profile)) {
    return NextResponse.json({ error: "Account is not authorized" }, { status: 403 });
  }

  const expiresIn = Number.isFinite(body.expires_in)
    ? Math.max(60, Math.min(Math.trunc(body.expires_in as number), 60 * 60))
    : 60 * 60;
  const response = NextResponse.json({ ok: true });
  response.cookies.set(accessTokenCookie, body.access_token, {
    ...cookieOptions,
    maxAge: expiresIn
  });
  response.cookies.set(refreshTokenCookie, body.refresh_token, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30
  });
  response.cookies.set(sessionRoleCookie, profile.role, {
    ...cookieOptions,
    maxAge: expiresIn
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(accessTokenCookie, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(refreshTokenCookie, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(sessionRoleCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
