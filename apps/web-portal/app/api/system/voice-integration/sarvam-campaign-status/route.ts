import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import {
  type SarvamCampaignAction,
  updateSarvamRenewalCampaignStatus,
} from "@/lib/sarvam-campaign-lifecycle";

const ALLOWED_ACTIONS = new Set<SarvamCampaignAction>(["pause", "resume"]);

export async function POST(request: NextRequest) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  const form = await request.formData();
  const action = String(form.get("action") ?? "").trim().toLowerCase() as SarvamCampaignAction;

  const target = new URL("/system/voice-integration", request.url);
  if (!ALLOWED_ACTIONS.has(action)) {
    target.searchParams.set("campaign_action", "failed");
    return NextResponse.redirect(target, 303);
  }

  const result = await updateSarvamRenewalCampaignStatus(action);
  target.searchParams.set("campaign_action", result.ok ? "ok" : "failed");
  target.searchParams.set("campaign_action_name", action);
  target.searchParams.set("campaign_state", result.status);
  if (result.httpStatus !== null) {
    target.searchParams.set("campaign_status", String(result.httpStatus));
  }
  return NextResponse.redirect(target, 303);
}
