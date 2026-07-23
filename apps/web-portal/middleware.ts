import { NextResponse, type NextRequest } from "next/server";
import { accessTokenCookie, isAuthorizedProfile, refreshTokenCookie, type Profile } from "@/lib/auth-config";
import { isProtectedPortalPath, safePortalReturnPath } from "@/lib/portal-routes";

type SessionStatus = "authorized" | "forbidden" | "invalid";
type RefreshedSession = { access_token: string; refresh_token: string; expires_in: number };

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/"
};

function getSupabaseEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

async function checkSession(accessToken: string): Promise<SessionStatus> {
  const env = getSupabaseEnvironment();

  if (!env) {
    return "invalid";
  }

  const authResponse = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!authResponse.ok) return "invalid";

  const user = (await authResponse.json()) as { id?: string };

  if (!user.id) return "invalid";

  const profileResponse = await fetch(`${env.supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=id,full_name,role,is_active`, {
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!profileResponse.ok) return "invalid";

  const profiles = (await profileResponse.json()) as Profile[];
  return isAuthorizedProfile(profiles[0] ?? null) ? "authorized" : "forbidden";
}

async function refreshSession(refreshToken: string): Promise<RefreshedSession | null> {
  const env = getSupabaseEnvironment();
  if (!env) return null;

  const response = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: env.supabaseAnonKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store"
  });
  if (!response.ok) return null;

  const session = (await response.json()) as Partial<RefreshedSession>;
  if (!session.access_token || !session.refresh_token) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: Math.max(60, Math.min(session.expires_in ?? 60 * 60, 60 * 60))
  };
}

function applySessionCookies(response: NextResponse, session: RefreshedSession) {
  response.cookies.set(accessTokenCookie, session.access_token, { ...cookieOptions, maxAge: session.expires_in });
  response.cookies.set(refreshTokenCookie, session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  return response;
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(accessTokenCookie, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(refreshTokenCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

function redirect(request: NextRequest, pathname: string, session?: RefreshedSession | null) {
  const response = NextResponse.redirect(new URL(pathname, request.url));
  return session ? applySessionCookies(response, session) : response;
}

function continueRequest(request: NextRequest, session?: RefreshedSession | null) {
  if (!session) return NextResponse.next();

  request.cookies.set(accessTokenCookie, session.access_token);
  request.cookies.set(refreshTokenCookie, session.refresh_token);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("cookie", request.cookies.toString());
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return applySessionCookies(response, session);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let accessToken = request.cookies.get(accessTokenCookie)?.value;
  const refreshToken = request.cookies.get(refreshTokenCookie)?.value;
  let refreshedSession: RefreshedSession | null = null;
  let status: SessionStatus = accessToken ? await checkSession(accessToken) : "invalid";

  if (status === "invalid" && refreshToken) {
    refreshedSession = await refreshSession(refreshToken);
    if (refreshedSession) {
      accessToken = refreshedSession.access_token;
      status = await checkSession(accessToken);
    }
  }

  if (pathname === "/") {
    if (status === "authorized") return redirect(request, "/dashboard", refreshedSession);
    if (status === "forbidden") return redirect(request, "/access-denied", refreshedSession);
    return clearSessionCookies(redirect(request, "/login"));
  }

  if (pathname === "/login") {
    if (status === "authorized") return redirect(request, "/dashboard", refreshedSession);
    if (status === "forbidden") return redirect(request, "/access-denied", refreshedSession);
    return clearSessionCookies(continueRequest(request));
  }

  if (isProtectedPortalPath(pathname)) {
    if (status === "invalid") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", safePortalReturnPath(`${pathname}${request.nextUrl.search}`));
      return clearSessionCookies(NextResponse.redirect(loginUrl));
    }

    if (status === "forbidden") return redirect(request, "/access-denied", refreshedSession);
    return continueRequest(request, refreshedSession);
  }

  return continueRequest(request, refreshedSession);
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/customers/:path*", "/vehicles/:path*", "/policies/:path*", "/claims/:path*", "/documents/:path*", "/timeline/:path*", "/tasks/:path*", "/reports/:path*", "/organization/:path*", "/users/:path*", "/notifications/:path*", "/settings/:path*", "/claim-documents/:path*"]
};

