import { NextResponse, type NextRequest } from "next/server";
import { accessTokenCookie, isAuthorizedProfile, type Profile } from "@/lib/auth-config";

const protectedRoutes = [
  "/dashboard",
  "/customers",
  "/vehicles",
  "/policies",
  "/claims",
  "/documents",
  "/timeline",
  "/tasks",
  "/reports",
  "/organization",
  "/users"
];

function isProtectedPath(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function redirect(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

function getSupabaseEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey };
}

async function hasAuthorizedSession(accessToken: string) {
  const env = getSupabaseEnvironment();

  if (!env) {
    return false;
  }

  const authResponse = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!authResponse.ok) {
    return false;
  }

  const user = (await authResponse.json()) as { id?: string };

  if (!user.id) {
    return false;
  }

  const profileResponse = await fetch(`${env.supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=id,full_name,role,is_active`, {
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!profileResponse.ok) {
    return false;
  }

  const profiles = (await profileResponse.json()) as Profile[];
  return isAuthorizedProfile(profiles[0] ?? null);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(accessTokenCookie)?.value;

  if (pathname === "/") {
    if (!accessToken) {
      return redirect(request, "/login");
    }

    return (await hasAuthorizedSession(accessToken)) ? redirect(request, "/dashboard") : redirect(request, "/access-denied");
  }

  if (pathname === "/login" && accessToken && (await hasAuthorizedSession(accessToken))) {
    return redirect(request, "/dashboard");
  }

  if (isProtectedPath(pathname)) {
    if (!accessToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!(await hasAuthorizedSession(accessToken))) {
      return redirect(request, "/access-denied");
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/customers/:path*", "/vehicles/:path*", "/policies/:path*", "/claims/:path*", "/documents/:path*", "/timeline/:path*", "/tasks/:path*", "/reports/:path*", "/organization/:path*", "/users/:path*"]
};

