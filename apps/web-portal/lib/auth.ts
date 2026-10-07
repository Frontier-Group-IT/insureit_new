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
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(accessToken);
  const afterClaims = performance.now();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (claimsError || !userId) {
    return { user: null, profile: null, error: claimsError?.message ?? "Missing user" };
  }

  const user = {
    id: userId,
    email: typeof claims?.email === "string" ? claims.email : undefined,
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

