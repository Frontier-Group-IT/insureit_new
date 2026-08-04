import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canAccessCustomer, canAccessIntermediaryApplication } from "@/lib/employee-access-scope";
import { hasAnyEffectiveCapability, hasEffectiveCapability } from "@/lib/effective-permissions";
import type { Capability } from "@/lib/roles";

export async function requireCapability(capability: Capability, minimumAccess?: "view" | "edit" | "approve") {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!(await hasEffectiveCapability(profile, capability, minimumAccess))) redirect("/access-denied");
  return profile;
}

export async function requireMasterDataManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!(await hasEffectiveCapability(profile, "manage_master_data"))) redirect("/access-denied");
  return profile;
}

export async function getCustomerViewer(customerId: string) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !(await hasEffectiveCapability(profile, "view_customers"))) return null;
  return await canAccessCustomer(profile.id, profile.role, customerId, "view_customers") ? profile : null;
}

export async function requireCustomerViewer(customerId: string) {
  const profile = await getCustomerViewer(customerId);
  if (!profile) redirect("/access-denied");
  return profile;
}

export async function getCustomerManager(customerId: string) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !(await hasEffectiveCapability(profile, "manage_customers"))) return null;
  return await canAccessCustomer(profile.id, profile.role, customerId, "manage_customers") ? profile : null;
}

export async function requireCustomerManager(customerId: string) {
  const profile = await getCustomerManager(customerId);
  if (!profile) redirect("/access-denied");
  return profile;
}

export async function getPospMispManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  return profile?.id && await hasAnyEffectiveCapability(profile, ["create_intermediary_application", "review_intermediary_application"]) ? profile : null;
}

export async function requirePospMispManager() {
  const profile = await getPospMispManager();
  if (!profile) redirect("/access-denied");
  return profile;
}

export async function getScopedPospMispManager(applicationId: string) {
  const profile = await getPospMispManager();
  if (!profile) return null;

  const allowed = await canAccessIntermediaryApplication(profile.id, profile.role, applicationId, "review_intermediary_application");
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

  const canOpen = await hasAnyEffectiveCapability(profile, [
    "view_intermediaries",
    "create_intermediary_application",
    "review_intermediary_application",
  ]);
  if (!canOpen) redirect("/access-denied");

  const allowed = await canAccessIntermediaryApplication(profile.id, profile.role, applicationId, "view_intermediaries");
  if (!allowed) redirect("/access-denied");
  return profile;
}
