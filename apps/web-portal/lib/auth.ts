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

  const supabase = createSupabaseWithAccessToken(accessToken);
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
    return { user: null, profile: null, error: userError?.message ?? "Missing user" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", userData.user.id)
    .maybeSingle<Profile>();

  if (profileError) {
    return { user: userData.user, profile: null, error: profileError.message };
  }

  return { user: userData.user, profile, error: null };
}

export { isAuthorizedProfile };

