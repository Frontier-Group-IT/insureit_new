import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { setVoiceCampaignStatus } from "@/lib/voice-campaigns";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const body = await request.json() as { action?: string };
    if (!["start", "pause", "resume"].includes(body.action ?? "")) throw new Error("Invalid campaign action.");
    return NextResponse.json(await setVoiceCampaignStatus(id, body.action as "start" | "pause" | "resume"));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Campaign update failed." }, { status: 400 });
  }
}
