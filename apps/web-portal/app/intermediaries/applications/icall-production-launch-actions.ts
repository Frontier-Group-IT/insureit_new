"use server";

import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getIcallSso } from "@/lib/icall-training-api";

export async function launchIcallProductionTraining(applicationId: string) {
  if (!applicationId) return { ok: false as const, message: "You are not authorized to open this training session." };
  const reviewer = await requireScopedPospMispManager(applicationId);
  if (!reviewer?.id) return { ok: false as const, message: "You are not authorized to open this training session." };

  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: assignment }] = await Promise.all([
    admin
      .from("posp_misp_onboarding_profiles")
      .select("training_login_id")
      .eq("application_id", applicationId)
      .maybeSingle<{ training_login_id: string | null }>(),
    admin
      .from("intermediary_training_exam_assignments")
      .select("icall_environment,icall_login_id")
      .eq("application_id", applicationId)
      .maybeSingle<{ icall_environment: string | null; icall_login_id: string | null }>(),
  ]);

  if (!profile || assignment?.icall_environment !== "production") {
    return { ok: false as const, message: "Production iCall training has not been started for this application." };
  }

  const loginId = assignment.icall_login_id || profile.training_login_id;
  if (!loginId) return { ok: false as const, message: "The production iCall training account is not linked yet." };

  try {
    const response = await getIcallSso(loginId);
    const redirectUrl = response.data?.redirectUrl?.trim();
    if (response.statusCode !== 200 || !redirectUrl) {
      return { ok: false as const, message: response.message || "iCall did not return a valid training session." };
    }

    const parsed = new URL(redirectUrl);
    if (parsed.protocol !== "https:" || parsed.hostname !== "www.icallinsurance.com") {
      return { ok: false as const, message: "iCall returned an unexpected training URL." };
    }

    return { ok: true as const, redirectUrl };
  } catch (error) {
    console.error("iCall production SSO launch failed", { applicationId, error });
    return { ok: false as const, message: "Unable to open iCall production training right now." };
  }
}
