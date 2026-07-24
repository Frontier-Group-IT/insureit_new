import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManageMasterData, canManagePospMispOnboarding } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function requireMasterDataManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);

  if (!canManageMasterData(profile?.role)) {
    redirect("/access-denied");
  }

  return profile;
}

export async function requirePospMispManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);

  if (!canManagePospMispOnboarding(profile?.role)) {
    redirect("/access-denied");
  }

  return profile;
}

export async function requireApplicationReviewer(applicationId: string) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);

  if (canManageMasterData(profile?.role)) return profile;

  if (profile?.id && canManagePospMispOnboarding(profile.role)) {
    const admin = createSupabaseAdminClient();
    const { data: application } = await admin
      .from("customer_onboarding_applications")
      .select("partner_type")
      .eq("id", applicationId)
      .maybeSingle<{ partner_type: string | null }>();

    if (application?.partner_type === "posp" || application?.partner_type === "misp") {
      return profile;
    }
  }

  redirect("/access-denied");
}
