import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { reviewTrainingExample, type TrainingReviewDecision } from "@/lib/private-voice/training-governance";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const exampleId = String(form.get("example_id") ?? "").trim();
  const decision = String(form.get("decision") ?? "").trim() as TrainingReviewDecision;
  if (!exampleId || (decision !== "approve" && decision !== "exclude")) {
    return NextResponse.redirect(new URL("/system/voice-integration/insureit-agent?review_state=failed&review_error=Invalid+review+request", request.url), 303);
  }

  try {
    await reviewTrainingExample({ exampleId, decision, reviewerId: viewer.id });
    return NextResponse.redirect(new URL(`/system/voice-integration/insureit-agent?review_state=success&review_decision=${decision}`, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Training review failed.";
    return NextResponse.redirect(new URL(`/system/voice-integration/insureit-agent?review_state=failed&review_error=${encodeURIComponent(message)}`, request.url), 303);
  }
}
