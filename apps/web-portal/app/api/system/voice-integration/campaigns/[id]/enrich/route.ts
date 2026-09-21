import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { enrichVoiceCampaignBatch } from "@/lib/voice-campaigns";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    return NextResponse.json(await enrichVoiceCampaignBatch(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign enrichment failed." }, { status: 400 });
  }
}
