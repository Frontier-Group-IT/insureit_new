"use server";

import { createServerSupabaseClient } from "@/lib/auth-server";
import { getIcallSso } from "@/lib/icall-training-api";

type TrainingContext =
  | { available: false; account_label: string }
  | { available: true; login_id: string; account_label: string };

export async function launchPartnerIcallTrainingSso() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_training_sso_context");

  if (error || !data) {
    return { ok: false as const, message: "Training is not available for this Partner account." };
  }

  const context = data as TrainingContext;
  if (!context.available || !("login_id" in context)) {
    return { ok: false as const, message: "The iCall training account has not been registered yet." };
  }

  const loginId = String(context.login_id || "").trim().toUpperCase();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(loginId)) {
    return { ok: false as const, message: "The iCall training account is not valid." };
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

    return { ok: true as const, redirectUrl, accountLabel: context.account_label };
  } catch (cause) {
    console.error("Partner iCall SSO launch failed", {
      error: cause instanceof Error ? cause.message : "Unknown error",
    });
    return { ok: false as const, message: "Unable to open iCall training right now." };
  }
}
