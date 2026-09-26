import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { stageHistoricalTrainingCandidates } from "@/lib/private-voice/training-library";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  const form = await request.formData();
  const requestedLimit = Number(form.get("limit") ?? 200);
  const target = new URL("/system/voice-integration/insureit-agent", request.url);

  try {
    const result = await stageHistoricalTrainingCandidates(requestedLimit);
    target.searchParams.set("training_stage", "success");
    target.searchParams.set("staged", String(result.staged));
    target.searchParams.set("skipped", String(result.skippedExisting));
    target.searchParams.set("screened_out", String(result.screenedOut));
  } catch (error) {
    target.searchParams.set("training_stage", "failed");
    target.searchParams.set(
      "training_error",
      error instanceof Error ? error.message.slice(0, 180) : "Could not stage historical training examples.",
    );
  }

  target.hash = "training-library";
  return NextResponse.redirect(target, 303);
}
