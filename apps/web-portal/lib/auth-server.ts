import { cache } from "react";
import { cookies } from "next/headers";
import { accessTokenCookie, customerAccessTokenCookie } from "./auth-config";
import { getVerifiedPartnerApiToken } from "./partner-ai-studio-api-context";
import { createSupabaseWithAccessToken, getAuthenticatedProfile as getAuthenticatedProfileUncached, isAuthorizedProfile } from "./auth";
import { getAuthenticatedProfileViaUser } from "./auth-cloudflare";

export const getServerAccessToken = cache(async () => {
  // The narrow native Partner route has already verified its bearer token.
  // Prefer that request-scoped identity even if a browser cookie is present.
  // Every other route retains its existing cookie-only session behavior.
  const mobileToken=getVerifiedPartnerApiToken();
  if(mobileToken)return mobileToken;
  const cookieStore = await cookies();
  return cookieStore.get(accessTokenCookie)?.value;
});

export const getCustomerServerAccessToken = cache(async () => {
  const cookieStore = await cookies();
  return cookieStore.get(customerAccessTokenCookie)?.value;
});

export async function createServerSupabaseClient() {
  return createSupabaseWithAccessToken(await getServerAccessToken());
}

export async function createCustomerServerSupabaseClient() {
  return createSupabaseWithAccessToken(await getCustomerServerAccessToken());
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
