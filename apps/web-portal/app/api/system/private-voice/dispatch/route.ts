import { NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

/**
 * Phase 1 execution boundary.
 * This route intentionally cannot place a call yet. Keeping a separate private
 * dispatch surface now prevents future private-agent work from reusing the
 * production Sarvam dispatch endpoint by convenience.
 */
export async function POST() {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(
    {
      error: "Private voice dispatch is locked during Phase 1.",
      phase: 1,
      live_calling_implemented: false,
      sarvam_fallback_isolated: true,
    },
    { status: 409 },
  );
}
