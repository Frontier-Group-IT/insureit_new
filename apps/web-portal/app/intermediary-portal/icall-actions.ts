"use server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getIcallSso } from "@/lib/icall-training-api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PortalAccount = {
  intermediary_id: string;
  application_id: string | null;
  status: string;
};

type Application = {
  id: string;
  final_type: string | null;
  partner_record_id: string | null;
};

type TrainingProfile = {
  application_id: string;
  partner_type: "posp" | "misp";
  training_login_id: string | null;
  pan_number: string | null;
  dp_pan_number: string | null;
};

export async function launchPortalIcallTrainingSso() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || profile.role !== "intermediary" || !profile.is_active) {
    return { ok: false as const, message: "Your portal session is not authorized for training." };
  }

  const admin = createSupabaseAdminClient();
  const { data: portal } = await admin
    .from("intermediary_portal_accounts")
    .select("intermediary_id,application_id,status")
    .eq("auth_user_id", profile.id)
    .maybeSingle<PortalAccount>();

  if (!portal?.application_id || portal.status === "disabled") {
    return { ok: false as const, message: "Training is not available for this portal account." };
  }

  const application = await resolveQualificationApplication(admin, portal.application_id);
  if (!application) {
    return { ok: false as const, message: "No linked POSP or MISP training account was found." };
  }

  const { data: trainingProfile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("application_id,partner_type,training_login_id,pan_number,dp_pan_number")
    .eq("application_id", application.id)
    .maybeSingle<TrainingProfile>();

  if (!trainingProfile) {
    return { ok: false as const, message: "The training profile could not be found." };
  }

  const loginId = normalizePan(
    trainingProfile.training_login_id ||
      (trainingProfile.partner_type === "misp" ? trainingProfile.dp_pan_number : trainingProfile.pan_number),
  );

  if (!loginId) {
    return { ok: false as const, message: "The iCall training account has not been registered yet." };
  }

  try {
    const response = await getIcallSso(loginId);
    const redirectUrl = response.data?.redirectUrl?.trim();
    if (response.statusCode !== 200 || !redirectUrl) {
      return { ok: false as const, message: "iCall did not return a valid training session." };
    }

    const parsed = new URL(redirectUrl);
    if (parsed.protocol !== "https:" || parsed.hostname !== "www.icallinsurance.com") {
      return { ok: false as const, message: "iCall returned an unexpected training URL." };
    }

    return { ok: true as const, redirectUrl };
  } catch (error) {
    console.error("Portal iCall SSO launch failed", {
      portalIntermediaryId: portal.intermediary_id,
      qualificationApplicationId: application.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { ok: false as const, message: "Unable to open iCall training right now." };
  }
}

async function resolveQualificationApplication(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  portalApplicationId: string,
) {
  const { data: current } = await admin
    .from("intermediary_onboarding_applications")
    .select("id,final_type,partner_record_id")
    .eq("id", portalApplicationId)
    .maybeSingle<Application>();

  if (!current) return null;
  if (current.final_type === "posp" || current.final_type === "misp") return current;
  if (current.final_type !== "partner" || !current.partner_record_id) return null;

  const { data: child } = await admin
    .from("intermediary_onboarding_applications")
    .select("id,final_type,partner_record_id")
    .eq("partner_record_id", current.partner_record_id)
    .in("final_type", ["posp", "misp"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<Application>();

  return child ?? null;
}

function normalizePan(value: string | null | undefined) {
  const normalized = String(value || "").trim().toUpperCase();
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized) ? normalized : null;
}
