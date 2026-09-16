import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { runSarvamControlCampaignDiagnostic } from "@/lib/sarvam-control-campaign-diagnostic";

function safeParam(value: string | null) {
  if (!value) return null;
  return value.slice(0, 80);
}

export async function POST(request: NextRequest) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  const target = new URL("/system/voice-integration/control-campaign-diagnostic", request.url);

  try {
    const result = await runSarvamControlCampaignDiagnostic();
    target.searchParams.set("control_diag", "done");
    target.searchParams.set("status", result.status === null ? "none" : String(result.status));
    target.searchParams.set("class", result.classification);
    const code = safeParam(result.errorCode);
    const requestId = safeParam(result.requestId);
    if (code) target.searchParams.set("code", code);
    if (requestId) target.searchParams.set("request", requestId);
  } catch {
    target.searchParams.set("control_diag", "config_error");
  }

  return NextResponse.redirect(target, 303);
}
