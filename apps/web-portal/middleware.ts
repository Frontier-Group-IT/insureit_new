import { NextResponse, type NextRequest } from "next/server";
import { accessTokenCookie, isAuthorizedProfile, refreshTokenCookie, sessionRoleCookie, type Profile } from "@/lib/auth-config";
import { internalLaunchHome, isIntermediaryLaunchPath, isIntermediaryOnlyLaunch } from "@/lib/launch-scope";
import { isAccountsRolePortalPath, isProtectedPortalPath, safePortalReturnPath } from "@/lib/portal-routes";
import { hasCapability } from "@/lib/roles";

type SessionStatus = "authorized" | "forbidden" | "invalid";
type SessionCheck = { status: SessionStatus; role: string | null };
type RefreshedSession = { access_token: string; refresh_token: string; expires_in: number };
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
const accountsHome = "/accounts";
const salesExecutiveHome = "/policies";
const canonicalPortalHost = "portal.insureit.in";

function isSalesExecutivePortalPath(pathname: string) {
  if (pathname === "/policies") return true;
  if (/^\/policies\/[^/]+$/.test(pathname)) return true;
  if (/^\/policies\/[^/]+\/document$/.test(pathname)) return true;
  if (pathname === "/policy-intakes" || pathname === "/policy-intakes/new") return true;
  if (/^\/policy-intakes\/[^/]+$/.test(pathname)) return true;
  return pathname === "/access-denied";
}

function canonicalPortalRedirect(request: NextRequest) {
  const hostname = request.nextUrl.hostname.toLowerCase();
  const isProductionVercelAlias =
    process.env.VERCEL_ENV === "production" &&
    hostname.endsWith(".vercel.app") &&
    hostname !== canonicalPortalHost;

  if (!isProductionVercelAlias) return null;

  const canonicalUrl = request.nextUrl.clone();
  canonicalUrl.protocol = "https:";
  canonicalUrl.hostname = canonicalPortalHost;
  canonicalUrl.port = "";
  return NextResponse.redirect(canonicalUrl, 307);
}

function getSupabaseEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } : null;
}

async function checkSession(accessToken: string): Promise<SessionCheck> {
  const env = getSupabaseEnvironment();
  if (!env) return { status: "invalid", role: null };

  const authResponse = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!authResponse.ok) return { status: "invalid", role: null };

  const user = (await authResponse.json()) as { id?: string };
  if (!user.id) return { status: "invalid", role: null };

  const profileApiKey = env.supabaseServiceRoleKey ?? env.supabaseAnonKey;
  const profileBearer = env.supabaseServiceRoleKey ?? accessToken;
  const profileResponse = await fetch(
    `${env.supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,full_name,role,is_active`,
    {
      headers: { apikey: profileApiKey, Authorization: `Bearer ${profileBearer}` },
      cache: "no-store",
    },
  );
  if (!profileResponse.ok) return { status: "invalid", role: null };

  const profiles = (await profileResponse.json()) as Profile[];
  const profile = profiles[0] ?? null;
  return { status: isAuthorizedProfile(profile) ? "authorized" : "forbidden", role: profile?.role ?? null };
}

async function refreshSession(refreshToken: string): Promise<RefreshedSession | null> {
  const env = getSupabaseEnvironment();
  if (!env) return null;
  const response = await fetch(`${env.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: env.supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const session = (await response.json()) as Partial<RefreshedSession>;
  if (!session.access_token || !session.refresh_token) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: Math.max(60, Math.min(session.expires_in ?? 3600, 3600)),
  };
}

function applySessionCookies(response: NextResponse, session: RefreshedSession, role?: string | null) {
  response.cookies.set(accessTokenCookie, session.access_token, { ...cookieOptions, maxAge: session.expires_in });
  response.cookies.set(refreshTokenCookie, session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  if (role) response.cookies.set(sessionRoleCookie, role, { ...cookieOptions, maxAge: session.expires_in });
  return response;
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.set(accessTokenCookie, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(refreshTokenCookie, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(sessionRoleCookie, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

function setRoleCookie(response: NextResponse, role?: string | null) {
  if (role) response.cookies.set(sessionRoleCookie, role, { ...cookieOptions, maxAge: 60 * 60 });
  return response;
}

function redirect(request: NextRequest, pathname: string, session?: RefreshedSession | null, role?: string | null) {
  const response = NextResponse.redirect(new URL(pathname, request.url));
  return session ? applySessionCookies(response, session, role) : setRoleCookie(response, role);
}

function continueRequest(request: NextRequest, session?: RefreshedSession | null, role?: string | null) {
  if (!session) return setRoleCookie(NextResponse.next(), role);
  request.cookies.set(accessTokenCookie, session.access_token);
  request.cookies.set(refreshTokenCookie, session.refresh_token);
  if (role) request.cookies.set(sessionRoleCookie, role);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("cookie", request.cookies.toString());
  return applySessionCookies(NextResponse.next({ request: { headers: requestHeaders } }), session, role);
}

export async function middleware(request: NextRequest) {
  const canonicalRedirect = canonicalPortalRedirect(request);
  if (canonicalRedirect) return canonicalRedirect;

  const { pathname } = request.nextUrl;
  const isRenewalVoiceLab = pathname === "/partner/renewals/voice-lab";
  let accessToken = request.cookies.get(accessTokenCookie)?.value;
  const refreshToken = request.cookies.get(refreshTokenCookie)?.value;
  let refreshedSession: RefreshedSession | null = null;

  // Never authorize or route from the cached role cookie alone. The role cookie is
  // only a response-side cache for downstream rendering; the access token must
  // always resolve to the current active profile so role changes and shared-browser
  // sessions cannot leave a user stuck on stale authorization state.
  let check: SessionCheck = accessToken
    ? await checkSession(accessToken)
    : { status: "invalid", role: null };

  if (check.status === "invalid" && refreshToken) {
    refreshedSession = await refreshSession(refreshToken);
    if (refreshedSession) {
      accessToken = refreshedSession.access_token;
      check = await checkSession(accessToken);
    }
  }

  if (pathname === "/") {
    if (check.status === "authorized" && check.role === "accounts") return redirect(request, accountsHome, refreshedSession, check.role);
    if (check.status === "authorized" && check.role === "sales_executive") return redirect(request, salesExecutiveHome, refreshedSession, check.role);
    return continueRequest(request, refreshedSession, check.role);
  }

  if (pathname === "/login") {
    if (check.status === "authorized") {
      if (check.role === "accounts") return redirect(request, accountsHome, refreshedSession, check.role);
      if (check.role === "sales_executive") return redirect(request, salesExecutiveHome, refreshedSession, check.role);
      return redirect(request, check.role === "intermediary" ? "/partner" : internalLaunchHome, refreshedSession, check.role);
    }
    if (check.status === "forbidden") return redirect(request, "/access-denied", refreshedSession, check.role);
    return clearSessionCookies(continueRequest(request));
  }

  if (isProtectedPortalPath(pathname)) {
    if (check.status === "invalid") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", safePortalReturnPath(`${pathname}${request.nextUrl.search}`));
      return clearSessionCookies(NextResponse.redirect(loginUrl));
    }
    if (check.status === "forbidden") return redirect(request, "/access-denied", refreshedSession, check.role);
    if (check.role === "accounts" && !isAccountsRolePortalPath(pathname)) {
      return redirect(request, accountsHome, refreshedSession, check.role);
    }
    if (check.role === "sales_executive" && !isSalesExecutivePortalPath(pathname)) {
      return redirect(request, salesExecutiveHome, refreshedSession, check.role);
    }
    if (check.role === "intermediary" && !pathname.startsWith("/partner") && !pathname.startsWith("/intermediary-portal")) {
      return redirect(request, "/partner", refreshedSession, check.role);
    }
    if (!isRenewalVoiceLab && check.role !== "intermediary" && (pathname.startsWith("/partner") || pathname.startsWith("/intermediary-portal"))) {
      return redirect(request, internalLaunchHome, refreshedSession, check.role);
    }

    if (isIntermediaryOnlyLaunch && check.role !== "intermediary") {
      if (!hasCapability(check.role, "view_intermediaries")) return redirect(request, "/access-denied", refreshedSession, check.role);
      if (!isRenewalVoiceLab && !isIntermediaryLaunchPath(pathname)) return redirect(request, internalLaunchHome, refreshedSession, check.role);
    }

    return continueRequest(request, refreshedSession, check.role);
  }

  return continueRequest(request, refreshedSession, check.role);
}

export const config = {
  // Keep this list in parity with protectedPortalRoots. The session coverage regression enforces it.
  matcher: [
    "/",
    "/access-denied",
    "/login",
    "/accounts/:path*",
    "/claim-documents/:path*",
    "/claims/:path*",
    "/customer-kyc/:path*",
    "/customers/:path*",
    "/dashboard/:path*",
    "/dashboard-v2/:path*",
    "/development/:path*",
    "/documents/:path*",
    "/employees/:path*",
    "/insurance-companies/:path*",
    "/intermediaries/:path*",
    "/intermediary-portal/:path*",
    "/master-data/:path*",
    "/notifications/:path*",
    "/organization/:path*",
    "/partner/:path*",
    "/policies/:path*",
    "/policy-intakes/:path*",
    "/reconciliation/:path*",
    "/reports/:path*",
    "/rm-performance/:path*",
    "/service-enquiries/:path*",
    "/settings/:path*",
    "/system/:path*",
    "/tasks/:path*",
    "/timeline/:path*",
    "/users/:path*",
    "/vehicles/:path*",
  ],
};
