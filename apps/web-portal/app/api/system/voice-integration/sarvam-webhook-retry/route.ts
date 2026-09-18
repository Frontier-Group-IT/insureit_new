import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { retrySarvamCampaignWebhookDelivery } from "@/lib/sarvam-webhook-recovery";

export async function POST(request: NextRequest) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  const form = await request.formData();
  const providerAttemptId = String(form.get("provider_attempt_id") ?? "").trim();
  const result = await retrySarvamCampaignWebhookDelivery(providerAttemptId);

  const target = new URL("/system/voice-integration", request.url);
  target.searchParams.set("webhook_retry", result.ok ? "accepted" : "failed");
  if (result.status !== null) target.searchParams.set("webhook_retry_status", String(result.status));
  return NextResponse.redirect(target, 303);
}
