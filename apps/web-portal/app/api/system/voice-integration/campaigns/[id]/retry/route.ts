import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { requeueRetryableVoiceCampaignFailures } from "@/lib/voice-campaigns";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (
    !viewer?.id ||
    viewer.role !== "it_super_user" ||
    !(await hasEffectiveCapability(viewer, "manage_system", "approve"))
  ) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  try {
    const { id: campaignId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const opportunityId =
      body && typeof body.opportunityId === "string" && body.opportunityId.trim()
        ? body.opportunityId.trim()
        : null;

    const result = await requeueRetryableVoiceCampaignFailures(campaignId, opportunityId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign retry could not be prepared." },
      { status: 400 },
    );
  }
}
