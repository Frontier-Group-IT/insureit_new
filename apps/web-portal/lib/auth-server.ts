import { cache } from "react";
import { cookies } from "next/headers";
import { accessTokenCookie } from "./auth-config";
import { createSupabaseWithAccessToken, getAuthenticatedProfile as getAuthenticatedProfileUncached, isAuthorizedProfile } from "./auth";

export const getServerAccessToken = cache(async () => {
  const cookieStore = await cookies();
  return cookieStore.get(accessTokenCookie)?.value;
});

export async function createServerSupabaseClient() {
  return createSupabaseWithAccessToken(await getServerAccessToken());
}

export const getAuthenticatedProfile = cache(async (accessToken?: string) => {
  return getAuthenticatedProfileUncached(accessToken);
});

export { isAuthorizedProfile };
