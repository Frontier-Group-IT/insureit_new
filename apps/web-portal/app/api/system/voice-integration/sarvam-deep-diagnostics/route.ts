import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { runSarvamDeepDiagnostics } from "@/lib/sarvam-deep-diagnostics";

function safeParam(value: string | null) {
  if (!value) return null;
  return value.slice(0, 80);
}

export async function POST(request: NextRequest) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  const target = new URL("/system/voice-integration/diagnostics", request.url);

  try {
    const result = await runSarvamDeepDiagnostics();
    target.searchParams.set("sarvam_diag", "done");
    result.probes.forEach((probe) => {
      target.searchParams.set(`diag_${probe.key}_status`, probe.status === null ? "none" : String(probe.status));
      target.searchParams.set(`diag_${probe.key}_class`, probe.classification);
      const code = safeParam(probe.errorCode);
      const requestId = safeParam(probe.requestId);
      if (code) target.searchParams.set(`diag_${probe.key}_code`, code);
      if (requestId) target.searchParams.set(`diag_${probe.key}_request`, requestId);
    });
  } catch {
    target.searchParams.set("sarvam_diag", "config_error");
  }

  return NextResponse.redirect(target, 303);
}
