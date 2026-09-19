import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { quickAddVoiceProspect } from "@/lib/voice-quick-add";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  const form = await request.formData();
  const registrationNumber = String(form.get("registration_no") ?? "").trim();
  const mobile = String(form.get("mobile") ?? "").trim();

  try {
    const result = await quickAddVoiceProspect({
      registrationNumber,
      mobile,
      requestedByAuthUserId: viewer.id,
    });

    const target = new URL(`/system/voice-integration/prospects/${result.opportunityId}`, request.url);
    target.searchParams.set("quick_add", result.created ? "created" : "existing");
    target.searchParams.set("rc_enrichment", result.enrichmentStatus);
    if (result.enrichmentStatus === "failed" && result.enrichmentError) {
      target.searchParams.set("rc_enrichment_error", result.enrichmentError.slice(0, 160));
    }
    return NextResponse.redirect(target, 303);
  } catch (error) {
    const target = new URL("/system/voice-integration", request.url);
    target.searchParams.set("quick_add", "failed");
    target.searchParams.set(
      "quick_add_error",
      error instanceof Error ? error.message.slice(0, 180) : "Could not add this RC to the calling queue.",
    );
    target.hash = "voice-queue";
    return NextResponse.redirect(target, 303);
  }
}
