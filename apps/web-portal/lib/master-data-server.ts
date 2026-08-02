import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canAccessCustomer, canAccessIntermediaryApplication } from "@/lib/employee-access-scope";
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

export async function getCustomerViewer(customerId: string) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !hasCapability(profile.role, "view_customers")) return null;
  return await canAccessCustomer(profile.id, profile.role, customerId) ? profile : null;
}

export async function requireCustomerViewer(customerId: string) {
  const profile = await getCustomerViewer(customerId);
  if (!profile) redirect("/access-denied");
  return profile;
}

export async function getCustomerManager(customerId: string) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !hasCapability(profile.role, "manage_customers")) return null;
  return await canAccessCustomer(profile.id, profile.role, customerId) ? profile : null;
}

export async function requireCustomerManager(customerId: string) {
  const profile = await getCustomerManager(customerId);
  if (!profile) redirect("/access-denied");
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
