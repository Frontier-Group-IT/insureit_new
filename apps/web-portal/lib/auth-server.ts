import { cache } from "react";
import { cookies } from "next/headers";
import { accessTokenCookie } from "./auth-config";
import { createSupabaseWithAccessToken, getAuthenticatedProfile as getAuthenticatedProfileUncached, isAuthorizedProfile } from "./auth";
import { getAuthenticatedProfileViaUser } from "./auth-cloudflare";

export const getServerAccessToken = cache(async () => {
  const cookieStore = await cookies();
  return cookieStore.get(accessTokenCookie)?.value;
});

export async function createServerSupabaseClient() {
  return createSupabaseWithAccessToken(await getServerAccessToken());
}

export const getAuthenticatedProfile = cache(async (accessToken?: string) => {
  const result = await getAuthenticatedProfileUncached(accessToken);
  if (result.user && result.profile) return result;

  // OpenNext/Cloudflare can reject getClaims() for a valid token. Fall back to
  // Supabase Auth's server-verified getUser() path only after the normal claims
  // path fails, preserving the existing fast path on Vercel and other runtimes.
  return getAuthenticatedProfileViaUser(accessToken);
});

export { isAuthorizedProfile };
