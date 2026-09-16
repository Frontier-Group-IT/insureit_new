import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { runSarvamControlCampaignDiagnostic } from "@/lib/sarvam-control-campaign-diagnostic";

function safeParam(value: string | null) {
  if (!value) return null;
  return value.slice(0, 80);
}

function appendProbe(target: URL, prefix: string, probe: Awaited<ReturnType<typeof runSarvamControlCampaignDiagnostic>>["webhookList"]) {
  target.searchParams.set(`${prefix}_status`, probe.status === null ? "none" : String(probe.status));
  target.searchParams.set(`${prefix}_class`, probe.classification);
  const code = safeParam(probe.errorCode);
  const requestId = safeParam(probe.requestId);
  if (code) target.searchParams.set(`${prefix}_code`, code);
  if (requestId) target.searchParams.set(`${prefix}_request`, requestId);
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
    appendProbe(target, "webhook", result.webhookList);
    appendProbe(target, "stream_validation", result.streamValidation);
  } catch {
    target.searchParams.set("control_diag", "config_error");
  }

  return NextResponse.redirect(target, 303);
}
