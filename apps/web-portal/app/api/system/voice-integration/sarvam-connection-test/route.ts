import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { checkSarvamRenewalConnection } from "@/lib/sarvam-renewal-readiness";

export async function POST(request: NextRequest) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  const result = await checkSarvamRenewalConnection();
  const target = new URL("/system/voice-integration", request.url);
  target.searchParams.set("sarvam_test", result.ok ? "ok" : "failed");
  if (result.status !== null) target.searchParams.set("sarvam_status", String(result.status));

  return NextResponse.redirect(target, 303);
}
