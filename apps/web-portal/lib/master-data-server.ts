import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canAccessIntermediaryApplication } from "@/lib/employee-access-scope";
import { canManageMasterData, canManagePospMispOnboarding, hasCapability, type Capability } from "@/lib/roles";

export async function requireCapability(capability: Capability) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!hasCapability(profile?.role, capability)) redirect("/access-denied");
  return profile;
}

export async function requireMasterDataManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!canManageMasterData(profile?.role)) redirect("/access-denied");
  return profile;
}

export async function getPospMispManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  return profile?.id && canManagePospMispOnboarding(profile.role) ? profile : null;
}

export async function requirePospMispManager() {
  const profile = await getPospMispManager();
  if (!profile) redirect("/access-denied");
  return profile;
}

export async function getScopedPospMispManager(applicationId: string) {
  const profile = await getPospMispManager();
  if (!profile) return null;

  const allowed = await canAccessIntermediaryApplication(profile.id, profile.role, applicationId);
  return allowed ? profile : null;
}

export async function requireScopedPospMispManager(applicationId: string) {
  const profile = await getScopedPospMispManager(applicationId);
  if (!profile) redirect("/access-denied");
  return profile;
}

export async function requireApplicationReviewer(applicationId: string) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id) redirect("/access-denied");

  const canOpen = hasCapability(profile.role, "view_intermediaries")
    || hasCapability(profile.role, "create_intermediary_application")
    || hasCapability(profile.role, "review_intermediary_application");
  if (!canOpen) redirect("/access-denied");

  const allowed = await canAccessIntermediaryApplication(profile.id, profile.role, applicationId);
  if (!allowed) redirect("/access-denied");
  return profile;
}
