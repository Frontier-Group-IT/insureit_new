import { NextResponse, type NextRequest } from "next/server";
import { accessTokenCookie, customerAccessTokenCookie, customerRefreshTokenCookie, customerSessionRoleCookie, isAuthorizedProfile, refreshTokenCookie, sessionRoleCookie, type Profile } from "@/lib/auth-config";
import { internalLaunchHome, isIntermediaryLaunchPath, isIntermediaryOnlyLaunch } from "@/lib/launch-scope";
import { isAccountsRolePortalPath, isProtectedPortalPath, safePortalReturnPath } from "@/lib/portal-routes";
import { hasCapability } from "@/lib/roles";

type SessionStatus = "authorized" | "customer" | "forbidden" | "invalid";
type SessionCheck = { status: SessionStatus; role: string | null; denialReason?: "profile_missing" | "account_inactive" | "role_not_enabled" };
type RefreshedSession = { access_token: string; refresh_token: string; expires_in: number };
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
const accountsHome = "/accounts";
const salesExecutiveHome = "/policies";
const operationsHeadLifeHome = "/dashboard";
function isOperationsHeadLifePath(pathname: string) {
  return pathname === "/dashboard" || pathname === "/policies" ||
    pathname === "/policies/new" ||
    new RegExp("^/policies/[0-9a-fA-F-]{36}$").test(pathname) ||
    new RegExp("^/policies/[0-9a-fA-F-]{36}/(edit|document)$").test(pathname) ||
    new RegExp("^/policies/documents/[0-9a-fA-F-]{36}/(open|download)$").test(pathname) ||
    pathname === "/policies/new/non-motor" ||
    pathname === "/policy-intakes" ||
    pathname === "/policy-intakes/new" ||
    new RegExp("^/policy-intakes/[0-9a-fA-F-]{36}$").test(pathname) ||
    pathname === "/policies/life-health-cases" ||
    new RegExp("^/policies/life-health-cases/[^/]+$").test(pathname) ||
    new RegExp("^/policies/life-health-case-documents/[0-9a-fA-F-]{36}/view$").test(pathname) ||
    pathname === "/intermediaries" ||
    pathname === "/intermediaries/partner" ||
    pathname === "/intermediaries/posp" ||
    pathname === "/intermediaries/misp" ||
    pathname === "/intermediaries/posp/new" ||
    pathname === "/intermediaries/misp/new" ||
    pathname === "/customers/posp-misp/new" ||
    pathname === "/customers/posp-misp/new/submit" ||
    new RegExp("^/intermediaries/applications/[0-9a-fA-F-]{36}(/workflow)?$").test(pathname) ||
    pathname === "/access-denied";
}
const claimsHeadHome = "/claims";

function isClaimsHeadPortalPath(pathname: string) {
  // Restricted module routing is an additional boundary; server actions and RLS must still authorize the record.
  return pathname === "/claims" || pathname.startsWith("/claims/") ||
    pathname === "/claim-documents" || pathname.startsWith("/claim-documents/") ||
    pathname === "/reports/claims" || pathname === "/reports/export/claims" ||
    pathname === "/policy-intakes" || pathname.startsWith("/policy-intakes/") ||
    pathname === "/notifications" || pathname.startsWith("/notifications/") ||
    pathname === "/access-denied";
}

const canonicalPortalHost = "portal.insureit.in";

function isSalesExecutivePortalPath(pathname: string) {
  if (pathname === "/policies") return true;
  if (/^\/policies\/[^/]+$/.test(pathname)) return true;
  if (/^\/policies\/[^/]+\/document$/.test(pathname)) return true;
  if (pathname === "/policy-intakes" || pathname === "/policy-intakes/new") return true;
  if (/^\/policy-intakes\/[^/]+$/.test(pathname)) return true;
  return pathname === "/access-denied";
}

function isCustomerPortalPath(pathname: string) {
  return pathname === "/customer" || pathname.startsWith("/customer/");
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
  if (profile?.is_active && profile.role === "customer") return { status: "customer", role: "customer" };
  if (!profile) return { status: "forbidden", role: null, denialReason: "profile_missing" };
  if (!profile.is_active) return { status: "forbidden", role: profile.role, denialReason: "account_inactive" };
  return { status: isAuthorizedProfile(profile) ? "authorized" : "forbidden", role: profile.role, denialReason: "role_not_enabled" };
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

type SessionScope = "customer" | "team";
const cookieNames = (scope: SessionScope) => scope === "customer"
  ? { access: customerAccessTokenCookie, refresh: customerRefreshTokenCookie, role: customerSessionRoleCookie }
  : { access: accessTokenCookie, refresh: refreshTokenCookie, role: sessionRoleCookie };

function applySessionCookies(response: NextResponse, session: RefreshedSession, role: string | null | undefined, scope: SessionScope) {
  const names = cookieNames(scope);
  response.cookies.set(names.access, session.access_token, { ...cookieOptions, maxAge: session.expires_in });
  response.cookies.set(names.refresh, session.refresh_token, { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
  if (role) response.cookies.set(names.role, role, { ...cookieOptions, maxAge: session.expires_in });
  return response;
}

function clearSessionCookies(response: NextResponse, scope: SessionScope) {
  const names = cookieNames(scope);
  response.cookies.set(names.access, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(names.refresh, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(names.role, "", { ...cookieOptions, maxAge: 0 });
  return response;
}

function setRoleCookie(response: NextResponse, role: string | null | undefined, scope: SessionScope) {
  if (role) response.cookies.set(cookieNames(scope).role, role, { ...cookieOptions, maxAge: 60 * 60 });
  return response;
}

function redirect(request: NextRequest, pathname: string, session?: RefreshedSession | null, role?: string | null) {
  const response = NextResponse.redirect(new URL(pathname, request.url));
  const scope = isCustomerPortalPath(request.nextUrl.pathname) ? "customer" : "team";
  return session ? applySessionCookies(response, session, role, scope) : setRoleCookie(response, role, scope);
}

function denialPath(reason: "profile_missing" | "account_inactive" | "role_not_enabled" | "customer_workspace" | "staff_workspace" | "module_permission") {
  return `/access-denied?reason=${reason}`;
}

function continueRequest(request: NextRequest, session?: RefreshedSession | null, role?: string | null) {
  const scope = isCustomerPortalPath(request.nextUrl.pathname) ? "customer" : "team";
  if (!session) return setRoleCookie(NextResponse.next(), role, scope);
  const names = cookieNames(scope);
  request.cookies.set(names.access, session.access_token);
  request.cookies.set(names.refresh, session.refresh_token);
  if (role) request.cookies.set(names.role, role);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("cookie", request.cookies.toString());
  return applySessionCookies(NextResponse.next({ request: { headers: requestHeaders } }), session, role, scope);
}

export async function middleware(request: NextRequest) {
  const canonicalRedirect = canonicalPortalRedirect(request);
  if (canonicalRedirect) return canonicalRedirect;

  const { pathname } = request.nextUrl;

  // Customer Web session creation/deletion is the authentication bootstrap itself.
  // Let the dedicated route validate Supabase tokens/role and set or clear secure
  // cookies; requiring an existing Customer cookie here would create a redirect loop
  // and turn the POST into a 405 on /customer/login.
  if (pathname === "/customer/auth/session") {
    return NextResponse.next();
  }

  const isRenewalVoiceLab = pathname === "/partner/renewals/voice-lab";
  // Select the appropriate independently authenticated session based on the
  // requested workspace, never by the cached role cookie or another workspace.
  const scope: SessionScope = isCustomerPortalPath(pathname) ? "customer" : "team";
  const names = cookieNames(scope);
  let accessToken = request.cookies.get(names.access)?.value;
  const refreshToken = request.cookies.get(names.refresh)?.value;
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
    if (check.status === "customer") return redirect(request, "/customer/home", refreshedSession, check.role);
    if (check.status === "authorized" && check.role === "accounts") return redirect(request, accountsHome, refreshedSession, check.role);
    if (check.status === "authorized" && check.role === "sales_executive") return redirect(request, salesExecutiveHome, refreshedSession, check.role);
    if (check.status === "authorized" && check.role === "operations_head_life") return redirect(request, operationsHeadLifeHome, refreshedSession, check.role);
    if (check.status === "authorized" && check.role === "claims_head") return redirect(request, claimsHeadHome, refreshedSession, check.role);
    return continueRequest(request, refreshedSession, check.role);
  }

  if (pathname === "/login") {
    if (check.status === "customer") return redirect(request, "/customer/home", refreshedSession, check.role);
    if (check.status === "authorized") {
      if (check.role === "accounts") return redirect(request, accountsHome, refreshedSession, check.role);
      if (check.role === "sales_executive") return redirect(request, salesExecutiveHome, refreshedSession, check.role);
      if (check.role === "operations_head_life") return redirect(request, operationsHeadLifeHome, refreshedSession, check.role);
      if (check.role === "claims_head") return redirect(request, claimsHeadHome, refreshedSession, check.role);
      return redirect(request, check.role === "intermediary" ? "/partner" : internalLaunchHome, refreshedSession, check.role);
    }
    if (check.status === "forbidden") return redirect(request, denialPath(check.denialReason ?? "role_not_enabled"), refreshedSession, check.role);
    return clearSessionCookies(continueRequest(request), scope);
  }

  // Signup is a public Customer authentication-entry page, not a protected Customer workspace.
  // Reuse the Login authorization boundary without changing Operations or Partner routing.
  if (pathname === "/customer/login" || pathname === "/customer/signup") {
    if (check.status === "customer") return redirect(request, "/customer/home", refreshedSession, check.role);
    if (check.status === "authorized" || check.status === "forbidden") {
      return redirect(request, denialPath(check.status === "forbidden" ? (check.denialReason ?? "role_not_enabled") : "staff_workspace"), refreshedSession, check.role);
    }
    return clearSessionCookies(continueRequest(request), scope);
  }

  if (isCustomerPortalPath(pathname)) {
    if (check.status === "invalid") {
      return clearSessionCookies(redirect(request, "/customer/login"), scope);
    }
    if (check.status !== "customer") {
      return redirect(request, denialPath(check.status === "forbidden" ? (check.denialReason ?? "role_not_enabled") : "staff_workspace"), refreshedSession, check.role);
    }
    return continueRequest(request, refreshedSession, check.role);
  }

  if (isProtectedPortalPath(pathname)) {
    if (check.status === "customer") return redirect(request, denialPath("customer_workspace"), refreshedSession, check.role);
    if (check.status === "invalid") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", safePortalReturnPath(`${pathname}${request.nextUrl.search}`));
      return clearSessionCookies(NextResponse.redirect(loginUrl), scope);
    }
    if (check.status === "forbidden") return redirect(request, denialPath(check.denialReason ?? "role_not_enabled"), refreshedSession, check.role);
    if (check.role === "accounts" && !isAccountsRolePortalPath(pathname)) {
      return redirect(request, accountsHome, refreshedSession, check.role);
    }
    if (check.role === "operations_head_life" && !isOperationsHeadLifePath(pathname)) {
      return redirect(request, operationsHeadLifeHome, refreshedSession, check.role);
    }
    if (check.role === "sales_executive" && !isSalesExecutivePortalPath(pathname)) {
      return redirect(request, salesExecutiveHome, refreshedSession, check.role);
    }
    if (check.role === "claims_head" && !isClaimsHeadPortalPath(pathname)) {
      return redirect(request, claimsHeadHome, refreshedSession, check.role);
    }
    if (check.role === "intermediary" && !pathname.startsWith("/partner") && !pathname.startsWith("/intermediary-portal")) {
      return redirect(request, "/partner", refreshedSession, check.role);
    }
    if (!isRenewalVoiceLab && check.role !== "intermediary" && (pathname.startsWith("/partner") || pathname.startsWith("/intermediary-portal"))) {
      return redirect(request, internalLaunchHome, refreshedSession, check.role);
    }

    if (isIntermediaryOnlyLaunch && check.role !== "intermediary") {
      if (!hasCapability(check.role, "view_intermediaries")) return redirect(request, denialPath("module_permission"), refreshedSession, check.role);
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
    "/customer/:path*",
    "/customer-kyc/:path*",
    "/customers/:path*",
    "/dashboard/:path*",
    "/dashboard-v2/:path*",
    "/development/:path*",
    "/documents/:path*",
    "/employees/:path*",
    "/exchange/:path*",
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