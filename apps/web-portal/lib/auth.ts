import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isAuthorizedProfile, type Profile } from "./auth-config";

function getSupabaseEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnvironment();

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export function createSupabaseWithAccessToken(accessToken?: string) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnvironment();

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      : undefined
  });
}

export async function getAuthenticatedProfile(accessToken?: string) {
  if (!accessToken) {
    return { user: null, profile: null, error: "Missing session" };
  }

  const startedAt = performance.now();
  const supabase = createSupabaseWithAccessToken(accessToken);

  let userId: string | null = null;
  let userEmail: string | undefined;
  let authError: string | null = null;

  try {
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(accessToken);
    const claims = claimsData?.claims;
    userId = typeof claims?.sub === "string" ? claims.sub : null;
    userEmail = typeof claims?.email === "string" ? claims.email : undefined;
    authError = claimsError?.message ?? null;
  } catch (error) {
    authError = error instanceof Error ? error.message : "Claims verification failed";
  }

  const afterClaims = performance.now();

  // OpenNext/Cloudflare can fail Supabase getClaims() even when the token is valid.
  // Fall back to Supabase Auth's server-side getUser() verification rather than
  // rejecting a valid session. Vercel keeps the fast claims path when it succeeds.
  if (!userId) {
    try {
      const {
        data: { user: verifiedUser },
        error: userError,
      } = await supabase.auth.getUser(accessToken);

      if (userError || !verifiedUser) {
        return {
          user: null,
          profile: null,
          error: userError?.message ?? authError ?? "Missing user",
        };
      }

      userId = verifiedUser.id;
      userEmail = verifiedUser.email ?? undefined;
      authError = null;
    } catch (error) {
      return {
        user: null,
        profile: null,
        error: error instanceof Error ? error.message : authError ?? "Missing user",
      };
    }
  }

  const user = {
    id: userId,
    email: userEmail,
  };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", userId)
    .maybeSingle<Profile>();
  const finishedAt = performance.now();

  if (process.env.NODE_ENV === "production") {
    console.info("portal_auth_perf", {
      claims_ms: Math.max(0, Math.round(afterClaims - startedAt)),
      profile_ms: Math.max(0, Math.round(finishedAt - afterClaims)),
      total_ms: Math.max(0, Math.round(finishedAt - startedAt)),
    });
  }

  if (profileError) {
    return { user, profile: null, error: profileError.message };
  }

  return { user, profile, error: null };
}

export { isAuthorizedProfile };

