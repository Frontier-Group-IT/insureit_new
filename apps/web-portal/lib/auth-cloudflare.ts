import type { Profile } from "./auth-config";
import { createSupabaseWithAccessToken } from "./auth";

export async function getAuthenticatedProfileViaUser(accessToken?: string) {
  if (!accessToken) {
    return { user: null, profile: null, error: "Missing session" };
  }

  try {
    const supabase = createSupabaseWithAccessToken(accessToken);
    const {
      data: { user: verifiedUser },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !verifiedUser) {
      return { user: null, profile: null, error: userError?.message ?? "Missing user" };
    }

    const user = {
      id: verifiedUser.id,
      email: verifiedUser.email ?? undefined,
    };

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("id", verifiedUser.id)
      .maybeSingle<Profile>();

    if (profileError) {
      return { user, profile: null, error: profileError.message };
    }

    return { user, profile, error: null };
  } catch (error) {
    return {
      user: null,
      profile: null,
      error: error instanceof Error ? error.message : "User verification failed",
    };
  }
}
